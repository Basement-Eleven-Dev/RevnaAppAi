import { logger } from 'firebase-functions';

import { db } from './admin';

/**
 * Notifiche push, tramite il servizio push di Expo.
 *
 * Non passiamo da FCM con l'Admin SDK anche se Firebase c'è già: l'app è una build
 * Expo e i suoi token sono token Expo, non token FCM. Il servizio di Expo è il
 * ponte fra i due — prende un `ExponentPushToken[…]` e lo consegna via APNs o FCM
 * a seconda del dispositivo — e ci risparmia di portare in casa certificati APNs e
 * `google-services.json`. Non serve nessuna chiave: il token è già il segreto.
 *
 * I token li scrive l'app in `pushTokens/{id}`, con l'id ricavato dal token e l'`uid`
 * di chi è entrato: è l'unica a conoscerli. Stanno in una collezione sola e non sotto
 * ciascun utente perché un telefono deve ricevere gli avvisi di un account solo — il
 * documento è uno per dispositivo, e chi accede per ultimo lo fa suo. Qui si leggono,
 * si usano e — quando sono malformati o Expo li dichiara morti — si cancellano.
 */

/** Endpoint del servizio push di Expo. Node 22 ha `fetch` di serie. */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Quanti messaggi per richiesta: è il tetto documentato da Expo. */
const CHUNK = 100;

/**
 * La forma di un token Expo. Un solo `to` fuori forma fa rifiutare a Expo l'intera
 * richiesta, cioè le notifiche di altri 99 dispositivi: si scarta prima.
 */
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

/**
 * Quanti destinatari alla volta si interrogano per token e non letti.
 *
 * Sono due letture per cliente: con la base utenti di oggi (decine, forse centinaia)
 * è un costo trascurabile, e va fatta comunque una richiesta per destinatario perché
 * i token stanno sotto ciascun utente. Se un giorno i clienti diventassero migliaia,
 * questo è il punto da trasformare in un lavoro asincrono.
 */
const FETCH_CONCURRENCY = 25;

export type PushMessage = {
  title: string;
  body: string;
  /** Finisce in `notification.request.content.data` sul telefono: serve al tocco. */
  data: Record<string, string>;
  /** Canale Android da usare; sul canale dipende il suono e l'importanza. */
  channelId?: string;
};

type Recipient = { uid: string; tokens: TokenDoc[]; badge: number };

type TokenDoc = { id: string; uid: string; token: string; updatedAt: string };

type ExpoTicket = {
  status?: string;
  message?: string;
  details?: { error?: string };
};

/**
 * Manda la stessa notifica a più clienti. Non solleva mai.
 *
 * L'invio è il corollario di qualcosa che è già successo — una comunicazione
 * pubblicata, e quindi già consegnata dentro l'app — e non deve poterlo far
 * fallire: se il servizio push è giù, il cliente trova l'avviso con il pallino
 * rosso al prossimo avvio, che è esattamente il comportamento che deve avere un
 * telefono con le notifiche negate. Per questo l'esito torna come numeri e va
 * nei log, invece di diventare un errore per chi ha premuto «Invia».
 */
export async function sendPush(
  uids: string[],
  message: PushMessage
): Promise<{ sent: number; failed: number; devices: number }> {
  const recipients = await loadRecipients(uids);
  const { tokens, discarded } = screenTokens(
    recipients.flatMap((recipient) =>
      recipient.tokens.map((token) => ({ token, badge: recipient.badge }))
    )
  );

  if (discarded.length > 0) {
    logger.warn('Token push malformati o doppi scartati', { quanti: discarded.length });
    await Promise.all(discarded.map(({ token }) => removeToken(token)));
  }

  if (tokens.length === 0) {
    logger.info('Nessun dispositivo registrato: notifica non inviata', { destinatari: uids.length });
    return { sent: 0, failed: 0, devices: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < tokens.length; i += CHUNK) {
    const chunk = tokens.slice(i, i + CHUNK);
    const tickets = await postChunk(
      chunk.map(({ token, badge }) => ({
        to: token.token,
        title: message.title,
        body: message.body,
        data: message.data,
        sound: 'default',
        badge,
        priority: 'high',
        ...(message.channelId ? { channelId: message.channelId } : {}),
      }))
    );

    // Nessuna risposta utile: l'invio è andato male tutto insieme (rete, 5xx).
    // I token non si toccano — non è colpa loro.
    if (!tickets) {
      failed += chunk.length;
      continue;
    }

    for (let k = 0; k < chunk.length; k++) {
      const ticket = tickets[k];
      if (ticket?.status === 'ok') {
        sent++;
        continue;
      }

      failed++;
      const error = ticket?.details?.error;
      logger.warn('Notifica non accettata', { error, message: ticket?.message });

      // `DeviceNotRegistered` vuol dire app disinstallata o notifiche revocate:
      // il token è morto e riprovarci non lo resuscita. Gli altri errori possono
      // essere temporanei, quindi il token resta.
      if (error === 'DeviceNotRegistered') await removeToken(chunk[k].token);
    }
  }

  logger.info('Notifiche inviate', { sent, failed, devices: tokens.length });
  return { sent, failed, devices: tokens.length };
}

/**
 * I token da usare, uno per dispositivo, e quelli da cancellare.
 *
 * Si cancellano quelli fuori forma e i doppioni. Lo stesso token in due documenti vuol
 * dire lo stesso telefono sotto due account: vale il documento scritto per ultimo, cioè
 * chi vi ha acceduto dopo, e gli altri non devono più ricevere niente lì.
 */
export function screenTokens<T extends { token: TokenDoc }>(
  entries: T[]
): { tokens: T[]; discarded: T[] } {
  const latest = new Map<string, T>();
  const discarded: T[] = [];

  for (const entry of entries) {
    const { token, updatedAt } = entry.token;
    const kept = latest.get(token);

    if (!EXPO_TOKEN.test(token)) discarded.push(entry);
    else if (!kept) latest.set(token, entry);
    else if (updatedAt > kept.token.updatedAt) {
      discarded.push(kept);
      latest.set(token, entry);
    } else discarded.push(entry);
  }

  return { tokens: [...latest.values()], discarded };
}

/** Una richiesta al servizio Expo. `null` se la risposta non è utilizzabile. */
async function postChunk(messages: unknown[]): Promise<ExpoTicket[] | null> {
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      logger.error('Servizio push Expo non raggiungibile', { status: response.status });
      return null;
    }

    const payload = (await response.json()) as { data?: ExpoTicket[]; errors?: unknown };
    if (payload.errors) logger.error('Errore dal servizio push Expo', { errors: payload.errors });

    return Array.isArray(payload.data) ? payload.data : null;
  } catch (cause) {
    logger.error('Invio delle notifiche fallito', { cause });
    return null;
  }
}

/**
 * Token e non letti di ogni destinatario.
 *
 * Il numero dei non letti diventa il pallino sull'icona dell'app: va contato ora,
 * perché la notifica lo porta con sé. Contarlo dopo l'invio significherebbe un'icona
 * che dice «1» quando gli avvisi da leggere sono tre — e l'app lo corregge solo
 * quando viene aperta, cioè quando quel numero non serve più a niente.
 */
async function loadRecipients(uids: string[]): Promise<Recipient[]> {
  const recipients: Recipient[] = [];

  for (let i = 0; i < uids.length; i += FETCH_CONCURRENCY) {
    const chunk = uids.slice(i, i + FETCH_CONCURRENCY);
    recipients.push(
      ...(await Promise.all(
        chunk.map(async (uid) => {
          const [tokens, unread] = await Promise.all([tokensOf(uid), unreadCount(uid)]);
          return { uid, tokens, badge: unread };
        })
      ))
    );
  }

  return recipients;
}

async function tokensOf(uid: string): Promise<TokenDoc[]> {
  const snapshot = await db.collection('pushTokens').where('uid', '==', uid).get();

  return snapshot.docs.map((document) => {
    const token: unknown = document.get('token');
    const updatedAt: unknown = document.get('updatedAt');
    return {
      id: document.id,
      uid,
      token: typeof token === 'string' ? token : '',
      updatedAt: typeof updatedAt === 'string' ? updatedAt : '',
    };
  });
}

async function unreadCount(uid: string): Promise<number> {
  const snapshot = await db
    .collection('users')
    .doc(uid)
    .collection('announcements')
    .where('lettoAt', '==', null)
    .count()
    .get();

  return snapshot.data().count;
}

async function removeToken(token: TokenDoc): Promise<void> {
  await db
    .collection('pushTokens')
    .doc(token.id)
    .delete()
    .catch((cause: unknown) => logger.warn('Token non rimosso', { cause }));

  logger.info('Token push rimosso', { uid: token.uid });
}
