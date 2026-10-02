/**
 * Notifiche push: registrazione del dispositivo e pallino sull'icona.
 *
 * Tutto quello che tocca `expo-notifications` sta qui, e per un motivo pratico: le
 * notifiche remote non funzionano in ogni ambiente in cui gira l'app, e le chiamate
 * che fallirebbero devono avere un solo posto dove essere fermate.
 *
 * **In Expo Go non funzionano.** Da Expo SDK 53 il client di Expo Go non riceve più
 * notifiche remote: `getExpoPushTokenAsync` solleva, e chiedere il permesso al sistema
 * sarebbe solo un pannello di troppo per una cosa che non arriverebbe comunque. Servono
 * una development build o la build di store, e un `projectId` EAS in `app.json`.
 * Finché non ci sono, tutto qui dentro si arrende in silenzio e l'app resta intera: gli
 * avvisi si vedono nell'app con il loro pallino rosso, che è la stessa cosa che vede
 * chi ha negato le notifiche.
 *
 * Il token è **per dispositivo**: il documento su Firestore (`pushTokens/{id}`) è uno per
 * telefono, con l'id ricavato dal token stesso e l'`uid` di chi è entrato. Così riaprire
 * l'app non moltiplica i documenti, e un telefono passato a un altro cliente riceve solo
 * gli avvisi di chi vi ha acceduto per ultimo. I token di apparecchi che non ci sono più
 * li pota il server quando il servizio push li rifiuta (vedi `backend/functions/src/push.ts`).
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';

import { getFirebaseDb, isFirebaseConfigured } from '@/lib/firebase';

/** Canale Android delle notifiche: lo stesso nome che usa il server. */
const CHANNEL_ID = 'avvisi';

/** Il dato che il server mette nella notifica: quale avviso aprire al tocco. */
export const ANNOUNCEMENT_DATA_KEY = 'avvisoId';

/**
 * Quanto può durare la cancellazione del token all'uscita. Senza rete Firestore non
 * conferma mai la scrittura, e chi preme «Esci» non deve restare appeso.
 */
const UNREGISTER_TIMEOUT_MS = 3000;

export type PushState =
  /** Non ancora provato. */
  | 'sconosciuto'
  /** Registrato: le notifiche arrivano su questo dispositivo. */
  | 'attive'
  /** Il permesso è stato negato: si riattiva dalle impostazioni del telefono. */
  | 'negate'
  /** Emulatore, Expo Go, web, o `projectId` mancante: qui non possono funzionare. */
  | 'nonDisponibili';

/** Expo Go non riceve notifiche remote da SDK 53: si riconosce da qui. */
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Cosa fare di una notifica che arriva mentre l'app è aperta e in primo piano.
 *
 * Si mostra comunque il banner: l'avviso compare da sé nell'elenco — la lista è in
 * ascolto live — ma chi in quel momento sta chattando con l'assistente non guarda la
 * sezione Avvisi, e senza banner non saprebbe che è arrivato niente. Il numero
 * sull'icona lo teniamo noi allineato ai non letti (vedi `setBadgeCount`), quindi qui
 * non lo si tocca.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
});

/**
 * Registra questo dispositivo per le notifiche di questo cliente.
 *
 * Il permesso si chiede all'ingresso nell'area riservata e non alla prima apertura
 * dell'app: prima del login non c'è nessuno a cui mandare niente, e un pannello di
 * sistema davanti alla schermata di accesso è la richiesta fuori contesto per
 * eccellenza — quella che si nega per riflesso.
 */
export async function registerPushToken(uid: string, channelName: string): Promise<PushState> {
  if (!isFirebaseConfigured) return 'nonDisponibili';
  if (Platform.OS === 'web') return 'nonDisponibili';
  // Un emulatore non ha un apparecchio a cui recapitare: il token non esiste.
  if (!Device.isDevice) return 'nonDisponibili';
  if (inExpoGo) return 'nonDisponibili';

  const projectId = easProjectId();
  if (!projectId) return 'nonDisponibili';

  try {
    // Il canale va creato prima di chiedere il token: su Android è il canale a
    // portare importanza e suono, e una notifica senza canale arriva muta.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: channelName,
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    const granted =
      existing.granted || (await Notifications.requestPermissionsAsync()).granted;

    if (!granted) return 'negate';

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return 'nonDisponibili';

    // Riscritto per intero, senza `merge`: se il documento era di un altro account
    // passa a questo, e niente del precedente deve restarci dentro.
    await setDoc(doc(getFirebaseDb(), 'pushTokens', tokenId(token)), {
      uid,
      token,
      piattaforma: Platform.OS,
      dispositivo: (Device.modelName ?? '').slice(0, 100),
      updatedAt: new Date().toISOString(),
    });

    return 'attive';
  } catch {
    // Niente da dire all'utente: un avviso lo trova comunque nell'app. Il caso
    // tipico è proprio questo — un ambiente in cui le notifiche remote non esistono.
    return 'nonDisponibili';
  }
}

/**
 * Dimentica questo dispositivo. Si chiama all'uscita dall'account, e non dura mai più
 * di `UNREGISTER_TIMEOUT_MS`.
 *
 * Senza, il telefono continuerebbe a ricevere gli avvisi di chi non è più dentro: sono
 * comunicazioni di Revna a una struttura, e su un telefono passato di mano o condiviso
 * non devono più comparire. Se non riesce in tempo (offline) il documento resta, e
 * passa al prossimo cliente che accede da questo telefono.
 */
export async function unregisterPushToken(): Promise<void> {
  if (!isFirebaseConfigured || Platform.OS === 'web' || inExpoGo) return;

  await setBadgeCount(0);

  const projectId = easProjectId();
  if (!projectId) return;

  const forget = async () => {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (token) await deleteDoc(doc(getFirebaseDb(), 'pushTokens', tokenId(token)));
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, UNREGISTER_TIMEOUT_MS);
  });

  // Un errore non blocca l'uscita: restare dentro per un token è la reazione sbagliata.
  await Promise.race([forget().catch(() => {}), timeout]);
  clearTimeout(timer);
}

/**
 * Il numero sull'icona dell'app, tenuto uguale agli avvisi non letti.
 *
 * Lo scriviamo noi invece di lasciarlo alle notifiche perché il numero deve **scendere**
 * quando un avviso viene letto, e di quello le notifiche non sanno niente.
 */
export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.setBadgeCountAsync(count).catch(() => {});
}

/**
 * Da dove si tocca una notifica si arriva a un id: quello dell'avviso da aprire.
 * `null` se la notifica non è nostra o non lo porta.
 */
export function announcementIdOf(notification: Notifications.Notification): string | null {
  const data = notification.request.content.data as Record<string, unknown> | undefined;
  const id = data?.[ANNOUNCEMENT_DATA_KEY];
  return typeof id === 'string' && id !== '' ? id : null;
}

/**
 * Le notifiche già aperte in questa esecuzione dell'app, per identificativo.
 *
 * A livello di modulo e non di componente: chi le ascolta si smonta e si rimonta a ogni
 * uscita e nuovo accesso, e una notifica toccata ore prima non deve riaprire un avviso
 * a chi entra dopo — magari un altro cliente.
 */
const handledResponses = new Set<string>();

/**
 * Chiama `handler` quando si apre l'app toccando la notifica di un avviso.
 *
 * Copre i due casi in cui succede, che sono diversi: l'app era in memoria e la
 * notifica arriva come risposta, oppure l'app era chiusa ed è la notifica ad averla
 * aperta — e in quel caso non c'è nessun evento da ascoltare, c'è una risposta già
 * consumata da chiedere (`getLastNotificationResponse`). Usata, la si cancella.
 *
 * Torna la funzione per smettere di ascoltare.
 */
export function onAnnouncementOpened(handler: (id: string) => void): () => void {
  // Sul web non c'è nessuna notifica di sistema da cui si possa arrivare: l'app si
  // apre da un indirizzo, e chiedere a `expo-notifications` una risposta che non
  // esiste è solo un rischio in più su una piattaforma che non usa questa strada.
  if (Platform.OS === 'web') return () => {};

  const open = (response: Notifications.NotificationResponse) => {
    const key = response.notification.request.identifier;
    if (handledResponses.has(key)) return;
    handledResponses.add(key);

    try {
      Notifications.clearLastNotificationResponse();
    } catch {
      // Modulo nativo senza questa funzione: basta il ricordo qui sopra.
    }

    const id = announcementIdOf(response.notification);
    if (id) handler(id);
  };

  try {
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last);
  } catch {
    // Ambiente senza notifiche native (Expo Go, emulatore): niente da aprire.
  }

  const subscription = Notifications.addNotificationResponseReceivedListener(open);

  return () => subscription.remove();
}

/** L'id del progetto EAS, da cui il servizio push riconosce l'app. */
function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * L'id del documento su Firestore, ricavato dal token.
 *
 * Un token Expo è `ExponentPushToken[xxxxxxxx]`: ripulito dai caratteri che in un id
 * sono un fastidio, resta stabile per dispositivo — che è tutto quello che serve,
 * perché è ciò che rende la registrazione ripetibile senza creare doppioni. Le regole
 * di Firestore rifanno lo stesso conto: se cambia qui, cambia anche là.
 */
function tokenId(token: string): string {
  return token.replace(/[^A-Za-z0-9_-]/g, '');
}
