import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from './admin';
import { requireAdmin } from './guards';
import { sanitizeProfile } from './profile';

/**
 * Richieste di contatto: quando l'assistente non basta, il cliente chiede una persona.
 *
 * Sono la valvola di sfogo dell'assistente. Un assistente che su una domanda fuori
 * dal suo perimetro può solo dire «non me ne occupo» lascia il cliente dov'era; qui
 * quella risposta diventa l'inizio di qualcosa — una richiesta che arriva in un posto
 * dove un consulente Revna la vede e la prende in mano.
 *
 * Stanno in una collezione di primo livello e non sotto l'utente, a differenza di
 * documenti e conversazioni: quelle si guardano sempre un cliente alla volta, queste
 * si guardano tutte insieme. Il backoffice ha bisogno di una coda unica ordinata per
 * data — «cosa è arrivato oggi» — e con una sottocollezione servirebbe una query di
 * gruppo per ottenere la stessa cosa. Il cliente vede le sue con un filtro su `uid`,
 * che le regole obbligano a mettere.
 */

/**
 * Il ciclo di vita di una richiesta, sempre in questo verso.
 *
 * Sono tre stati e non due perché al cliente serve sapere non solo se la richiesta è
 * partita, ma se qualcuno l'ha letta: è l'attesa fra l'invio e la prima risposta
 * quella che fa dubitare di essere stati ascoltati.
 */
export const STATI = ['inviata', 'visualizzata', 'chiusa'] as const;

export type Stato = (typeof STATI)[number];

/** Da dove è nata la richiesta: dalla chat con l'assistente o dalla sezione «Richieste». */
export type Origine = 'assistente' | 'richieste';

/**
 * Il recapito del cliente, congelato al momento della richiesta.
 *
 * È una copia di quello che c'era nel profilo, non un riferimento: chi apre la
 * richiesta fra due settimane deve vedere il numero a cui il cliente si aspettava
 * di essere richiamato, non quello che nel frattempo è stato corretto. Il profilo
 * vivo resta a un clic di distanza, nella scheda del cliente.
 */
export type Contatto = {
  email: string;
  /** Nome e cognome del referente, se il profilo li ha. */
  nome: string;
  ruolo: string;
  telefono: string;
  struttura: string;
};

export type ContactRequest = {
  uid: string;
  stato: Stato;
  messaggio: string;
  origine: Origine;
  /** La conversazione da cui è nata, quando è nata da lì: serve a leggere il contesto. */
  conversationId?: string;
  contatto: Contatto;
  createdAt: string;
  updatedAt: string;
  /** Quando e da chi lo stato è stato cambiato l'ultima volta. */
  statoAt?: string;
  statoBy?: string;
};

/** Oltre questa lunghezza non è più una richiesta di contatto, è un documento. */
const MAX_MESSAGE_CHARS = 2000;

/**
 * Quante richieste ancora aperte può avere un cliente.
 *
 * Non è una tariffa, è un argine: dieci richieste aperte sono già un segnale che
 * qualcosa non sta funzionando, e senza un limite un ciclo dell'app potrebbe
 * riempire la coda del backoffice.
 */
const MAX_OPEN = 10;

function collectionRef() {
  return db.collection('contactRequests');
}

type CreateRequest = {
  messaggio: string;
  /** Presente se la richiesta nasce dalla chat. */
  conversationId?: string;
};

type CreateResponse = { id: string };

/**
 * Apre una richiesta di contatto.
 *
 * Il testo arriva dal client perché è il cliente a scriverlo — l'assistente lo
 * propone, ma la parola finale è sua, e nella chat il testo passa da un campo
 * modificabile e da una conferma esplicita prima di arrivare qui.
 *
 * Tutto il resto lo mette il server: chi è, come lo si richiama, in che stato nasce.
 * Il recapito in particolare non si prende dalla richiesta anche se il client lo
 * conosce: sarebbe l'unico dato della coda del backoffice a poter essere scritto da
 * fuori, e un consulente che richiama un numero deve poter fidarsi di quel numero.
 */
export const createContactRequest = onCall<CreateRequest, Promise<CreateResponse>>(
  { region: 'europe-west1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Accesso riservato ai clienti Revna.');
    }

    const messaggio = request.data.messaggio?.trim();
    if (!messaggio) {
      throw new HttpsError('invalid-argument', 'La richiesta è vuota.');
    }
    if (messaggio.length > MAX_MESSAGE_CHARS) {
      throw new HttpsError('invalid-argument', 'La richiesta è troppo lunga.');
    }

    const aperte = await collectionRef()
      .where('uid', '==', uid)
      .where('stato', 'in', ['inviata', 'visualizzata'])
      .count()
      .get();

    if (aperte.data().count >= MAX_OPEN) {
      throw new HttpsError(
        'resource-exhausted',
        'Hai già diverse richieste aperte: il tuo referente Revna le sta guardando.'
      );
    }

    const snapshot = await db.collection('users').doc(uid).get();
    const profile = sanitizeProfile(snapshot.data()?.['profile']);
    const now = new Date().toISOString();

    // Da dove è nata lo dice il client, perché è l'unico a saperlo. L'id della
    // conversazione invece si verifica: nel backoffice diventa un link, e un link a
    // una chat inesistente è peggio che nessun link. Una richiesta nata dalla chat
    // resta «dalla chat» anche se il cliente ha cancellato la conversazione — quello
    // che si perde è il contesto, non la sua provenienza.
    const origine: Origine = request.data.conversationId ? 'assistente' : 'richieste';
    const conversationId = await resolveConversation(uid, request.data.conversationId);

    const document = await collectionRef().add({
      uid,
      stato: 'inviata' satisfies Stato,
      messaggio,
      origine,
      ...(conversationId ? { conversationId } : {}),
      contatto: {
        email: request.auth?.token['email'] ?? (snapshot.data()?.['email'] as string) ?? '',
        nome: `${profile.referente.nome} ${profile.referente.cognome}`.trim(),
        ruolo: profile.referente.ruolo,
        telefono: profile.referente.telefono,
        struttura: profile.struttura.nome,
      },
      createdAt: now,
      updatedAt: now,
    });

    logger.info('Richiesta di contatto aperta', { id: document.id, uid, origine });

    return { id: document.id };
  }
);

type UpdateRequest = { requestId: string; stato: Stato };

/**
 * Cambia lo stato di una richiesta. Solo i referenti Revna.
 *
 * Passa da una function e non da una scrittura diretta come le schede dei documenti
 * perché qui lo stato è quello che il cliente vede nell'app: chi l'ha mosso e quando
 * deve restare scritto, e la validazione dei valori ammessi non può stare nel client
 * che li propone.
 *
 * Qualsiasi passaggio è ammesso, compreso il ritorno indietro da «chiusa»: una
 * richiesta chiusa troppo presto si riapre, e obbligare a crearne una nuova
 * spezzerebbe la storia di una conversazione che il cliente ha già avuto.
 */
export const updateContactRequest = onCall<UpdateRequest, Promise<{ ok: true }>>(
  { region: 'europe-west1' },
  async (request) => {
    requireAdmin(request);

    const { requestId, stato } = request.data;
    if (!requestId) {
      throw new HttpsError('invalid-argument', 'requestId mancante.');
    }
    if (!STATI.includes(stato)) {
      throw new HttpsError('invalid-argument', 'Stato non ammesso.');
    }

    const ref = collectionRef().doc(requestId);
    if (!(await ref.get()).exists) {
      throw new HttpsError('not-found', 'Richiesta inesistente.');
    }

    const now = new Date().toISOString();
    const by = request.auth?.token['email'] ?? request.auth?.uid ?? null;

    await ref.update({ stato, updatedAt: now, statoAt: now, statoBy: by });

    logger.info('Stato richiesta aggiornato', { requestId, stato, by });
    return { ok: true };
  }
);

/** L'id della conversazione se esiste ed è di questo cliente, altrimenti niente. */
async function resolveConversation(
  uid: string,
  conversationId: string | undefined
): Promise<string | undefined> {
  if (!conversationId) return undefined;

  const snapshot = await db
    .collection('users')
    .doc(uid)
    .collection('conversations')
    .doc(conversationId)
    .get();

  return snapshot.exists ? conversationId : undefined;
}
