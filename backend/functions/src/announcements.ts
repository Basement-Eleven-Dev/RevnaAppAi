import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { auth, db } from './admin';
import { requireAdmin } from './guards';
import { sendPush } from './push';

/**
 * Comunicazioni di Revna ai clienti: avvisi, annunci, novità.
 *
 * Sono il verso opposto delle richieste di contatto — lì è il cliente che chiama, qui
 * è Revna che parla — e per questo il modello dei dati è rovesciato. Una richiesta è
 * una sola cosa che si guarda in due; una comunicazione è **una cosa scritta una volta
 * e consegnata a molti**, e le due metà hanno bisogni opposti: il consulente vuole
 * vedere «la comunicazione e chi l'ha letta», il cliente vuole vedere «i miei avvisi».
 *
 * Perciò ci sono due posti e non uno:
 *
 * - `announcements/{id}` è l'originale, riservato ai referenti Revna: testo,
 *   destinatari e conteggi delle letture;
 * - `users/{uid}/announcements/{id}` è la **copia consegnata**, con lo stesso id, che
 *   il cliente legge insieme al suo `lettoAt`.
 *
 * La copia costa una scrittura per destinatario a ogni invio, e in cambio evita la
 * cosa che conta di più: senza di essa il client dovrebbe leggere la collezione
 * originale filtrando su un elenco di destinatari, e quell'elenco — cioè chi sono gli
 * altri clienti Revna e quanti sono — finirebbe sul telefono di ciascuno. La
 * riservatezza della base clienti vale più di qualche scrittura.
 *
 * Nessuno scrive direttamente, da nessuna delle due parti: le regole negano la
 * scrittura e tutto passa da qui, dove i destinatari si risolvono sul server e lo
 * stato «inviato» può significare soltanto che la consegna è avvenuta davvero.
 */

/** Oltre questo il titolo non è più un titolo: nell'elenco dell'app viene tagliato. */
const MAX_TITLE_CHARS = 120;

/** Una comunicazione, non un documento: per un allegato lungo ci sono i Documenti. */
const MAX_BODY_CHARS = 20_000;

/** Quanto testo entra nell'anteprima dell'elenco e nel corpo della notifica. */
const EXCERPT_CHARS = 200;

/**
 * Quante scritture per batch nella consegna. Il limite di Firestore è 500: 400 lascia
 * margine per l'aggiornamento dell'originale nello stesso giro.
 */
const BATCH_SIZE = 400;

/** Canale Android delle notifiche: lo crea l'app con lo stesso nome. */
const PUSH_CHANNEL = 'avvisi';

/**
 * A chi va la comunicazione.
 *
 * `tutti` non è una scorciatoia per «l'elenco di adesso»: viene risolto al momento
 * dell'invio, e chi diventa cliente domani non riceverà gli avvisi di ieri. È il
 * comportamento giusto — un avviso è datato, e recapitarlo a chi non c'era quando è
 * stato scritto confonde più che informare.
 */
export type Destinatari = { modo: 'tutti' | 'selezione'; uids: string[] };

export type Announcement = {
  titolo: string;
  /** Markdown, prodotto dall'editor del backoffice e reso dall'app. */
  corpo: string;
  /** Prime righe in chiaro: elenco nell'app, anteprima nel backoffice, testo della notifica. */
  estratto: string;
  destinatari: Destinatari;
  stato: 'bozza' | 'inviato';
  /** I destinatari veri, risolti all'invio: è la lista su cui si consegna e si corregge. */
  inviatoA: string[];
  destinatariCount: number;
  lettiCount: number;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  inviatoAt?: string;
  inviatoBy?: string | null;
};

function collectionRef() {
  return db.collection('announcements');
}

function deliveryRef(uid: string, id: string) {
  return db.collection('users').doc(uid).collection('announcements').doc(id);
}

type SaveRequest = {
  /**
   * L'id della comunicazione. Assente solo per una bozza creata senza immagini:
   * l'editor del backoffice ne genera uno prima del primo salvataggio, perché le
   * immagini che si incollano nel testo vanno da qualche parte — e quel «qualche
   * parte» è `announcements/{id}/` su Storage, che l'id lo pretende subito.
   */
  id?: string;
  titolo: string;
  corpo: string;
  destinatari: Destinatari;
};

/**
 * Salva una comunicazione, nuova o esistente.
 *
 * Passa da una function e non da una scrittura diretta come le schede dei documenti
 * per una ragione sola: `stato` e `destinatariCount` sono il resoconto di una consegna,
 * e devono poter essere scritti soltanto da chi la consegna. Se il backoffice potesse
 * scriverli, «inviato a 42 clienti» sarebbe un'affermazione senza garanzie.
 *
 * Su una comunicazione **già inviata** si correggono titolo e testo — un errore in un
 * avviso già letto va potuto rimediare, e la correzione raggiunge subito chi l'ha
 * ricevuto — ma non i destinatari: quelli restano quelli della consegna. Allargare il
 * pubblico di un avviso già partito farebbe arrivare a metà dei clienti una notifica e
 * all'altra metà no, per la stessa comunicazione. Per altri destinatari se ne scrive
 * una nuova.
 */
export const saveAnnouncement = onCall<SaveRequest, Promise<{ id: string }>>(
  { region: 'europe-west1' },
  async (request) => {
    requireAdmin(request);

    const titolo = (request.data.titolo ?? '').trim();
    const corpo = (request.data.corpo ?? '').trim();

    if (!titolo) {
      throw new HttpsError('invalid-argument', 'Il titolo è necessario.');
    }
    if (titolo.length > MAX_TITLE_CHARS) {
      throw new HttpsError('invalid-argument', 'Il titolo è troppo lungo.');
    }
    if (!corpo) {
      throw new HttpsError('invalid-argument', 'Il testo della comunicazione è vuoto.');
    }
    if (corpo.length > MAX_BODY_CHARS) {
      throw new HttpsError('invalid-argument', 'Il testo è troppo lungo per una comunicazione.');
    }

    const now = new Date().toISOString();
    const by = request.auth?.token['email'] ?? request.auth?.uid ?? null;
    const estratto = excerptOf(corpo);
    const ref = request.data.id?.trim()
      ? collectionRef().doc(request.data.id.trim())
      : collectionRef().doc();
    const id = ref.id;
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      await ref.set({
        titolo,
        corpo,
        estratto,
        destinatari: sanitizeDestinatari(request.data.destinatari),
        stato: 'bozza',
        inviatoA: [],
        destinatariCount: 0,
        lettiCount: 0,
        createdAt: now,
        createdBy: by,
        updatedAt: now,
        updatedBy: by,
      } satisfies Announcement);

      logger.info('Comunicazione creata', { id, by });
      return { id };
    }

    const inviata = snapshot.get('stato') === 'inviato';
    await ref.update({
      titolo,
      corpo,
      estratto,
      // I destinatari di una bozza si cambiano fino all'ultimo; dopo l'invio no.
      ...(inviata ? {} : { destinatari: sanitizeDestinatari(request.data.destinatari) }),
      updatedAt: now,
      updatedBy: by,
    });

    // Una correzione deve arrivare a chi ha già ricevuto: le copie consegnate
    // vengono riscritte, senza toccare chi l'aveva già letta.
    if (inviata) {
      const uids = (snapshot.get('inviatoA') as string[] | undefined) ?? [];
      await deliver(uids, id, { titolo, corpo, estratto }, { consegna: false });
      logger.info('Comunicazione corretta e riconsegnata', { id, destinatari: uids.length, by });
    }

    return { id };
  }
);

/**
 * Consegna la comunicazione e manda la notifica.
 *
 * Prima la consegna dentro l'app, poi la notifica: la notifica è un avviso che
 * qualcosa è arrivato, e non deve poter arrivare prima della cosa. Se il servizio push
 * è giù la consegna resta valida — il cliente trova l'avviso con il pallino rosso al
 * prossimo avvio — e l'invio non fallisce per questo (vedi `sendPush`).
 *
 * Si invia una volta sola. Una seconda consegna della stessa comunicazione
 * significherebbe una seconda notifica per un avviso già letto: se serve dire qualcosa
 * di nuovo, si scrive una comunicazione nuova.
 */
export const sendAnnouncement = onCall<
  { id: string },
  Promise<{ destinatari: number; notificati: number; dispositivi: number }>
>({ region: 'europe-west1' }, async (request) => {
  requireAdmin(request);

  const id = request.data.id?.trim();
  if (!id) {
    throw new HttpsError('invalid-argument', 'id mancante.');
  }

  const ref = collectionRef().doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new HttpsError('not-found', 'Questa comunicazione non esiste più.');
  }
  if (snapshot.get('stato') === 'inviato') {
    throw new HttpsError(
      'failed-precondition',
      'Questa comunicazione è già stata inviata. Per correggerla, salva le modifiche.'
    );
  }

  const destinatari = sanitizeDestinatari(snapshot.get('destinatari'));
  const uids = await resolveRecipients(destinatari);

  if (uids.length === 0) {
    throw new HttpsError(
      'failed-precondition',
      'Nessun destinatario: scegli almeno un cliente attivo.'
    );
  }

  const titolo = snapshot.get('titolo') as string;
  const corpo = snapshot.get('corpo') as string;
  const estratto = (snapshot.get('estratto') as string) || excerptOf(corpo);
  const now = new Date().toISOString();
  const by = request.auth?.token['email'] ?? request.auth?.uid ?? null;

  await deliver(uids, id, { titolo, corpo, estratto }, { consegna: true });

  await ref.update({
    stato: 'inviato',
    inviatoA: uids,
    destinatariCount: uids.length,
    lettiCount: 0,
    inviatoAt: now,
    inviatoBy: by,
    updatedAt: now,
    updatedBy: by,
  });

  logger.info('Comunicazione inviata', { id, destinatari: uids.length, by });

  const push = await sendPush(uids, {
    title: titolo,
    body: estratto,
    // L'id serve al tocco sulla notifica: apre quell'avviso, non l'elenco.
    data: { avvisoId: id },
    channelId: PUSH_CHANNEL,
  });

  return { destinatari: uids.length, notificati: push.sent, dispositivi: push.devices };
});

/**
 * Ritira una comunicazione: via l'originale e via tutte le copie consegnate.
 *
 * Cancellare davvero e non nascondere: un avviso mandato per errore — al cliente
 * sbagliato, con il dato sbagliato — deve poter sparire dall'app, e uno «ritirato» che
 * resta leggibile non risolve il problema per cui lo si ritira. Le notifiche già
 * arrivate sul telefono non si riprendono: quello che si toglie è il contenuto.
 */
export const deleteAnnouncement = onCall<{ id: string }, Promise<{ ok: true }>>(
  { region: 'europe-west1' },
  async (request) => {
    requireAdmin(request);

    const id = request.data.id?.trim();
    if (!id) {
      throw new HttpsError('invalid-argument', 'id mancante.');
    }

    const ref = collectionRef().doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return { ok: true };

    const uids = (snapshot.get('inviatoA') as string[] | undefined) ?? [];

    for (let i = 0; i < uids.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const uid of uids.slice(i, i + BATCH_SIZE)) batch.delete(deliveryRef(uid, id));
      await batch.commit();
    }

    await ref.delete();

    // Anche le immagini che stavano nel testo: restare su Storage senza più niente
    // che le indichi vorrebbe dire un bucket che cresce di file irraggiungibili, e
    // il loro download URL resterebbe valido per chiunque l'avesse copiato.
    await getStorage()
      .bucket()
      .deleteFiles({ prefix: `announcements/${id}/` })
      .catch((cause: unknown) => logger.warn('Immagini della comunicazione non rimosse', { id, cause }));

    logger.info('Comunicazione ritirata', {
      id,
      destinatari: uids.length,
      by: request.auth?.token['email'] ?? request.auth?.uid,
    });

    return { ok: true };
  }
);

/**
 * Segna una comunicazione come letta. La chiama il cliente aprendola.
 *
 * Non è una scrittura diretta del client su `lettoAt` per un motivo che non è la
 * sicurezza — falsificare la propria lettura non porta niente a nessuno — ma la
 * contabilità: la lettura va contata anche sull'originale, che il cliente non può
 * vedere né toccare. In transazione perché il conteggio deve crescere una volta sola,
 * e aprire due volte lo stesso avviso è la cosa più normale del mondo.
 */
export const markAnnouncementRead = onCall<{ id: string }, Promise<{ ok: true }>>(
  { region: 'europe-west1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Accesso riservato ai clienti Revna.');
    }

    const id = request.data.id?.trim();
    if (!id) {
      throw new HttpsError('invalid-argument', 'id mancante.');
    }

    const delivery = deliveryRef(uid, id);

    const original = collectionRef().doc(id);

    await db.runTransaction(async (transaction) => {
      const [copia, originale] = await transaction.getAll(delivery, original);

      if (!copia.exists) {
        throw new HttpsError('not-found', 'Questo avviso non è più disponibile.');
      }
      if (copia.get('lettoAt')) return;

      transaction.update(delivery, { lettoAt: new Date().toISOString() });

      // L'originale si legge per sapere se c'è ancora: può essere stato ritirato
      // mentre il cliente leggeva, e un `set` cieco lo farebbe **rinascere** con il
      // solo conteggio dentro — una comunicazione fantasma nell'elenco del backoffice.
      if (originale.exists) {
        transaction.update(original, { lettiCount: FieldValue.increment(1) });
      }
    });

    return { ok: true };
  }
);

/**
 * Scrive (o riscrive) la copia consegnata a ciascun destinatario.
 *
 * `merge` e non `set` pieno perché la stessa funzione serve due momenti: la consegna,
 * dove la copia non c'è, e la correzione, dove c'è già e porta il `lettoAt` del
 * cliente — che non è nostro da azzerare.
 *
 * Per questo `inviatoAt` e `lettoAt` si scrivono **solo alla consegna**: riscriverli su
 * una correzione rimetterebbe in cima all'elenco un avviso di tre settimane fa e lo
 * farebbe tornare non letto a chi l'aveva già letto. Il `lettoAt: null` iniziale è
 * esplicito di proposito: è il campo su cui l'app conta i non letti e su cui il server
 * calcola il pallino sull'icona, e un campo assente non si può interrogare.
 */
async function deliver(
  uids: string[],
  id: string,
  content: { titolo: string; corpo: string; estratto: string },
  { consegna }: { consegna: boolean }
): Promise<void> {
  const inviatoAt = new Date().toISOString();

  for (let i = 0; i < uids.length; i += BATCH_SIZE) {
    const batch = db.batch();

    for (const uid of uids.slice(i, i + BATCH_SIZE)) {
      batch.set(
        deliveryRef(uid, id),
        { ...content, ...(consegna ? { inviatoAt, lettoAt: null } : {}) },
        { merge: true }
      );
    }

    await batch.commit();
  }
}

/**
 * I destinatari veri, risolti ora sull'anagrafica.
 *
 * Sempre filtrati sui clienti attivi, anche quando sono stati scelti a mano: un
 * cliente disattivato non deve ricevere comunicazioni, e una selezione salvata in
 * bozza tre settimane fa può contenere qualcuno che nel frattempo è uscito.
 *
 * Come `listClients`, si fermano a 1000 utenti: è il tetto di una pagina di
 * `listUsers` e la base utenti Revna è lontana da lì.
 */
async function resolveRecipients(destinatari: Destinatari): Promise<string[]> {
  const { users } = await auth.listUsers(1000);
  const clienti = users
    .filter((user) => user.customClaims?.['revnaAdmin'] !== true && !user.disabled)
    .map((user) => user.uid);

  if (destinatari.modo === 'tutti') return clienti;

  const scelti = new Set(destinatari.uids);
  return clienti.filter((uid) => scelti.has(uid));
}

function sanitizeDestinatari(value: unknown): Destinatari {
  const raw = (value ?? {}) as Partial<Destinatari>;
  const modo = raw.modo === 'selezione' ? 'selezione' : 'tutti';
  const uids = Array.isArray(raw.uids)
    ? [...new Set(raw.uids.filter((uid): uid is string => typeof uid === 'string' && uid !== ''))]
    : [];

  // Su `tutti` l'elenco non si conserva: sarebbe un dato che sembra dire chi
  // riceverà, mentre chi riceverà lo decide l'anagrafica al momento dell'invio.
  return modo === 'tutti' ? { modo, uids: [] } : { modo, uids };
}

/**
 * Le prime righe in chiaro, senza i marcatori del markdown.
 *
 * Servono in tre posti — l'elenco nell'app, l'anteprima nel backoffice, il corpo della
 * notifica — e in tutti e tre `**Attenzione**` scritto così sarebbe rumore. Si calcola
 * al salvataggio e non alla lettura perché la notifica parte dal server, dove il
 * renderer del markdown non c'è.
 */
export function excerptOf(markdown: string): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    // Un'immagine in apertura è frequente e non ha testo da mostrare: via del tutto,
    // altrimenti l'anteprima comincerebbe con la sua didascalia.
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '• ')
    .replace(/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/gm, ' ')
    .replace(/(\*\*|__|[*_`])/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return plain.length > EXCERPT_CHARS ? `${plain.slice(0, EXCERPT_CHARS - 1).trimEnd()}…` : plain;
}
