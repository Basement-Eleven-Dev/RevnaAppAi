import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { auth, db } from './admin';
import type { Source } from './agent';
import type { StoredTurn } from './conversations';
import { requireAdmin } from './guards';
import { respond } from './model';
import { describeProfile, sanitizeProfile } from './profile';

/**
 * Quanti turni di prova rimandare indietro.
 *
 * Lo storico lo tiene il backoffice, non Firestore, quindi arriva dal client: va
 * limitato qui, perché è l'unico punto in cui possiamo farlo.
 */
const MAX_PREVIEW_TURNS = 40;

/** Cosa è stato messo a disposizione del modello, e cosa ne ha fatto. */
type Diagnostics = {
  /** Le voci in contesto, con l'indicazione di quali sono state davvero citate. */
  conoscenza: { titolo: string; citata: boolean }[];
  /** Voci attive in totale: se sono più di quelle in contesto, è entrata la selezione. */
  disponibili: number;
  /** Il profilo così come lo legge il modello. */
  profilo: string;
  /** Il prompt di sistema completo, per capire perché ha risposto così. */
  systemInstruction: string;
};

type Request = {
  /** Il cliente di cui usare il profilo struttura. */
  uid: string;
  message: string;
  /** I turni precedenti della prova: qui non si salva niente, li tiene il backoffice. */
  history?: StoredTurn[];
};

type Response = { text: string; sources: Source[]; diagnostics: Diagnostics };
type Chunk = { text: string };

/**
 * Prova l'assistente dal backoffice, con il profilo di un cliente vero.
 *
 * Serve a chi scrive la personalità e la base di conoscenza: senza questa, per vedere
 * l'effetto di una modifica bisognerebbe entrare nell'app come cliente.
 *
 * **Non scrive niente.** Nessuna conversazione finisce sotto il cliente — non deve
 * comparire nel suo storico una chat che non ha avuto — né sotto il referente Revna.
 * Per questo lo storico della prova viaggia nella richiesta invece di stare su
 * Firestore: è l'unico caso in cui il contesto lo tiene il client, e va bene perché
 * qui il client è il backoffice e la conversazione non è di nessuno.
 *
 * Il profilo, invece, si legge dal server: si indica quale cliente impersonare, non
 * si manda un profilo inventato. Provare l'assistente su dati finti direbbe poco.
 */
export const previewAssistant = onCall<Request, Promise<Response>, Chunk>(
  { region: 'europe-west1', timeoutSeconds: 120 },
  async (request, streamed) => {
    requireAdmin(request);

    const { uid } = request.data;
    const message = request.data.message?.trim();

    if (!uid) {
      throw new HttpsError('invalid-argument', 'Indica il cliente da impersonare.');
    }
    if (!message) {
      throw new HttpsError('invalid-argument', 'Messaggio vuoto.');
    }

    // Che sia un cliente e non un altro referente Revna: i referenti non hanno un
    // profilo struttura, e impersonarli non vorrebbe dire niente.
    const target = await auth.getUser(uid).catch(() => null);
    if (!target) {
      throw new HttpsError('not-found', 'Utente inesistente.');
    }
    if (target.customClaims?.['revnaAdmin'] === true) {
      throw new HttpsError('permission-denied', 'I referenti Revna non hanno una struttura.');
    }

    const snapshot = await db.collection('users').doc(uid).get();
    const profile = sanitizeProfile(snapshot.data()?.['profile']);

    const history = (Array.isArray(request.data.history) ? request.data.history : [])
      .filter(
        (turn): turn is StoredTurn =>
          (turn?.role === 'user' || turn?.role === 'model') &&
          typeof turn?.text === 'string' &&
          turn.text.trim() !== '',
      )
      .map((turn) => ({ role: turn.role, text: turn.text }))
      .slice(-MAX_PREVIEW_TURNS);

    const answer = await respond({
      profile,
      history,
      message,
      onChunk: (text) => streamed?.sendChunk({ text }) ?? Promise.resolve(),
    });

    const citate = new Set(answer.sources.map((source) => source.titolo));

    // Traccia dell'accesso: la prova legge il profilo di un cliente, e su dati di un
    // cliente serve sapere chi ha guardato cosa.
    logger.info('Prova assistente', {
      uid,
      by: request.auth?.token['email'] ?? request.auth?.uid,
      fonti: answer.sources.length,
      conoscenzaInContesto: answer.selected.length,
    });

    return {
      text: answer.text,
      sources: answer.sources,
      diagnostics: {
        conoscenza: answer.selected.map((entry) => ({
          titolo: entry.titolo,
          citata: citate.has(entry.titolo),
        })),
        disponibili: answer.disponibili,
        profilo: describeProfile(profile),
        systemInstruction: answer.systemInstruction,
      },
    };
  },
);
