import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from './admin';
import type { Source } from './agent';
import { conversationsOf, MAX_STORED_TURNS, type StoredTurn } from './conversations';
import { loadMemory, updateMemory, type MemoryEntry } from './memory';
import { complete, decide, respond } from './model';
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

    // Conversazione esistente o nuova. Lo storico viene dal documento, non dal
    // client: così non è manipolabile e sopravvive al riavvio dell'app.
    const conversationRef = request.data.conversationId
      ? conversationsOf(uid).doc(request.data.conversationId)
      : conversationsOf(uid).doc();

    // Le tre letture insieme: sono su documenti diversi e nessuna dipende dall'altra.
    const [snapshot, conversation, memory] = await Promise.all([
      db.collection('users').doc(uid).get(),
      conversationRef.get(),
      loadMemory(uid),
    ]);

    const profile = sanitizeProfile(snapshot.data()?.['profile']);
    const stored: StoredTurn[] = (conversation.data()?.['messages'] as StoredTurn[]) ?? [];

    const answer = await respond({
      profile,
      history: stored,
      message,
      memory,
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

    // Il salvataggio e l'aggiornamento della memoria insieme: la conversazione è
    // salva appena la scrittura passa, e la memoria non la fa aspettare.
    const [, annotati] = await Promise.all([
      conversationRef.set(
        {
          title,
          messages,
          updatedAt: now,
          ...(conversation.exists ? {} : { createdAt: now }),
        },
        { merge: true },
      ),
      learn({
        uid,
        entries: memory,
        message,
        answer: answer.text,
        conversationId: conversationRef.id,
        conversazione: title,
      }),
    ]);

    logger.info('Risposta assistente', {
      uid,
      chars: answer.text.length,
      fonti: answer.sources.length,
      conoscenzaInContesto: answer.selected.length,
      memoriaInContesto: memory.length,
      memoriaAggiornata: annotati,
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

/**
 * Le risposte di cortesia, in italiano e in inglese.
 *
 * Un turno così non contiene preferenze, e scoprirlo non vale una chiamata al modello.
 * L'elenco è volutamente corto e chiuso, e non un conteggio di parole: da quando la
 * memoria tiene le preferenze, «no elenchi» sono due parole che valgono un giro e
 * «grazie mille davvero» sono tre che non valgono niente. Sbagliare per eccesso costa
 * una chiamata, sbagliare per difetto costa una preferenza persa.
 */
const CORTESIA = new Set([
  'ok', 'okay', 'va bene', 'vabbè', 'grazie', 'grazie mille', 'ti ringrazio', 'perfetto',
  'chiaro', 'chiarissimo', 'capito', 'ottimo', 'bene', 'benissimo', 'si', 'sì', 'no',
  'thanks', 'thank you', 'thanks a lot', 'great', 'perfect', 'got it', 'clear', 'yes',
  'no thanks', 'nope', 'sure',
]);

/**
 * Il turno di memoria: cosa si è imparato parlando, se si è imparato qualcosa.
 *
 * Aspettarlo prima di rispondere è una scelta, non una dimenticanza. Il lavoro dopo
 * la risposta su Cloud Functions non è garantito — l'istanza può venire congelata
 * appena la richiesta si chiude — quindi le alternative erano aspettare qualche
 * decimo di secondo in più a testo già scritto, o una memoria che si aggiorna
 * quando capita. Il testo, a questo punto, il cliente l'ha già davanti: è arrivato
 * in streaming mentre il modello lo scriveva.
 *
 * Un errore qui non deve mai diventare un errore sulla risposta: la conversazione è
 * già salva, e una memoria che si aggiorna al turno dopo non la nota nessuno.
 */
async function learn(input: {
  uid: string;
  /** La memoria com'era prima di questo turno. */
  entries: MemoryEntry[];
  message: string;
  answer: string;
  conversationId: string;
  conversazione: string;
}): Promise<number> {
  const asciutto = input.message.toLowerCase().replace(/[.!?…,;:\s]+/g, ' ').trim();
  if (asciutto === '' || CORTESIA.has(asciutto)) return 0;

  try {
    return await updateMemory({ ...input, decide });
  } catch (cause) {
    logger.warn('Memoria non aggiornata', { uid: input.uid, cause });
    return 0;
  }
}
