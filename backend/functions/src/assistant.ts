import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from './admin';
import type { Source } from './agent';
import { conversationsOf, MAX_STORED_TURNS, type StoredTurn } from './conversations';
import { complete, respond } from './model';
import { sanitizeProfile } from './profile';

type Request = { message: string; conversationId?: string };
type Response = {
  text: string;
  conversationId: string;
  title: string;
  sources: Source[];
  /** Il testo della richiesta di contatto proposta, quando l'assistente passa la mano. */
  proposal?: string;
};
/** Pezzo di risposta inviato man mano che il modello la produce. */
type Chunk = { text: string };

/**
 * Proxy verso il modello: l'app non parla mai direttamente con Gemini, così la
 * chiave resta lato server e ogni richiesta passa dal controllo di accesso.
 *
 * Il profilo della struttura e lo storico della conversazione vengono letti qui e
 * non arrivano dal client: è il cliente a fare la domanda, ma è il server a decidere
 * di chi sta parlando e cosa è già stato detto. La personalità dell'assistente e la
 * base di conoscenza arrivano dal backoffice (vedi `agent.ts`), non dal codice.
 *
 * Il lavoro sul modello lo fa `respond` in `model.ts`, condiviso con la prova dal
 * backoffice: qui restano solo le cose che riguardano il cliente vero, cioè chi è,
 * cosa si è già detti e la persistenza.
 *
 * La risposta viene inviata a pezzi mentre il modello la scrive. `sendChunk` non fa
 * nulla se il client non ha chiesto lo streaming, quindi il testo completo viene
 * comunque restituito alla fine.
 */
export const askAssistant = onCall<Request, Promise<Response>, Chunk>(
  { region: 'europe-west1', timeoutSeconds: 120 },
  async (request, streamed) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Accesso riservato ai clienti Revna.');
    }

    const message = request.data.message?.trim();
    if (!message) {
      throw new HttpsError('invalid-argument', 'Messaggio vuoto.');
    }

    const snapshot = await db.collection('users').doc(uid).get();
    const profile = sanitizeProfile(snapshot.data()?.['profile']);

    // Conversazione esistente o nuova. Lo storico viene dal documento, non dal
    // client: così non è manipolabile e sopravvive al riavvio dell'app.
    const conversationRef = request.data.conversationId
      ? conversationsOf(uid).doc(request.data.conversationId)
      : conversationsOf(uid).doc();
    const conversation = await conversationRef.get();
    const stored: StoredTurn[] = (conversation.data()?.['messages'] as StoredTurn[]) ?? [];

    const answer = await respond({
      profile,
      history: stored,
      message,
      onChunk: (text) => streamed?.sendChunk({ text }) ?? Promise.resolve(),
    });

    // Il titolo si genera solo alla prima risposta: serve a distinguere la
    // conversazione nell'elenco, non a riassumerla via via che cresce.
    const existingTitle = conversation.data()?.['title'] as string | undefined;
    const title = existingTitle ?? (await summarize(message));

    const now = new Date().toISOString();
    // Domanda e risposta portano l'ora del turno: `updatedAt` dice solo quando la
    // conversazione è stata toccata l'ultima volta, e chi la rilegge dal backoffice
    // deve poter vedere quando è stata detta ogni cosa.
    const messages = [
      ...stored,
      { role: 'user', text: message, at: now },
      // `sources` solo se ci sono: Firestore non accetta `undefined` nei documenti.
      {
        role: 'model',
        text: answer.text,
        at: now,
        ...(answer.sources.length ? { sources: answer.sources } : {}),
        ...(answer.proposal ? { proposal: answer.proposal } : {}),
      },
    ].slice(-MAX_STORED_TURNS);

    await conversationRef.set(
      {
        title,
        messages,
        updatedAt: now,
        ...(conversation.exists ? {} : { createdAt: now }),
      },
      { merge: true },
    );

    logger.info('Risposta assistente', {
      uid,
      chars: answer.text.length,
      fonti: answer.sources.length,
      conoscenzaInContesto: answer.selected.length,
    });

    return {
      text: answer.text,
      conversationId: conversationRef.id,
      title,
      sources: answer.sources,
      ...(answer.proposal ? { proposal: answer.proposal } : {}),
    };
  },
);

/**
 * Titolo breve per l'elenco delle conversazioni, ricavato dalla prima domanda.
 * Se la chiamata fallisce non deve far fallire la risposta: si ripiega sulla
 * domanda troncata, che come etichetta funziona quasi altrettanto bene.
 */
async function summarize(message: string): Promise<string> {
  const fallback = message.length > 48 ? `${message.slice(0, 45).trimEnd()}…` : message;

  try {
    const answer = await complete(
      'Riassumi questa domanda in un titolo di massimo 5 parole, in italiano, ' +
        'senza virgolette e senza punto finale. Rispondi solo con il titolo.\n\n' +
        message,
      { temperature: 0.2, maxOutputTokens: 32 },
    );

    const title = answer.replace(/^["'«»]|["'«».]$/g, '');
    return title && title.length <= 60 ? title : fallback;
  } catch (cause) {
    logger.warn('Titolo non generato', { cause });
    return fallback;
  }
}
