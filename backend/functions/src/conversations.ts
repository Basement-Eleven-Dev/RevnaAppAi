import { onCall } from 'firebase-functions/v2/https';

import { db } from './admin';
import type { Source } from './agent';
import { idDoc, requireClient } from './guards';

/**
 * Un turno di conversazione. Le fonti stanno sul turno e non a parte perché sono
 * parte della risposta: riaprendo la conversazione dalla sidebar il cliente deve
 * ritrovare sotto ogni risposta il materiale Revna su cui poggiava.
 */
export type StoredTurn = {
  role: 'user' | 'model';
  text: string;
  sources?: Source[];
  /**
   * La richiesta di contatto proposta dall'assistente in questo turno, se l'ha
   * proposta. Sta sul turno per lo stesso motivo delle fonti: riaprendo la
   * conversazione il cliente deve ritrovare l'offerta di essere ricontattato dov'era,
   * non solo finché la risposta è a schermo.
   */
  proposal?: string;
  /**
   * Quando il turno è stato scritto, in ISO.
   *
   * Facoltativo perché i turni salvati prima che il campo esistesse non lo hanno:
   * chi lo mostra ripiega sulla data della conversazione.
   */
  at?: string;
};

export type Conversation = {
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredTurn[];
};

/**
 * Le conversazioni stanno sotto l'utente: `users/{uid}/conversations/{id}`.
 * I messaggi sono un array dentro il documento e non una sottocollezione —
 * una conversazione si legge e si mostra sempre intera. Il limite di 1 MB per
 * documento lo tiene lontano `trimHistory`.
 */
export function conversationsOf(uid: string) {
  return db.collection('users').doc(uid).collection('conversations');
}

/**
 * Il messaggio più lungo che il cliente può mandare: una pagina e mezza, quanto
 * basta per una domanda con incollata una recensione o una mail. Lo stesso valore
 * sta nell'app, sul composer.
 */
export const MAX_MESSAGE_CHARS = 4000;

/** Oltre questa soglia i turni più vecchi cadono, per non far crescere il documento. */
export const MAX_STORED_TURNS = 200;

/**
 * Il peso massimo dei `messages`, in byte. Firestore rifiuta i documenti oltre 1 MB,
 * e una conversazione che non si salva più resta bloccata per sempre: il margine
 * copre titolo, date e la stima, che non è il conteggio esatto di Firestore.
 */
export const MAX_STORED_BYTES = 800_000;

/**
 * Lo storico da salvare: al massimo `MAX_STORED_TURNS` turni e `MAX_STORED_BYTES`,
 * scartando i più vecchi.
 *
 * Non comincia mai con una risposta: senza la sua domanda il modello la rileggerebbe
 * come un'uscita sua fuori contesto.
 */
export function trimHistory(turns: StoredTurn[]): StoredTurn[] {
  const kept = turns.slice(-MAX_STORED_TURNS);
  const sizes = kept.map((turn) => Buffer.byteLength(JSON.stringify(turn), 'utf8'));
  let total = sizes.reduce((sum, size) => sum + size, 0);

  let start = 0;
  while (start < kept.length && (total > MAX_STORED_BYTES || kept[start].role === 'model')) {
    total -= sizes[start];
    start++;
  }

  return kept.slice(start);
}

type DeleteRequest = { conversationId: string };

/**
 * Cancella una conversazione.
 *
 * Le regole Firestore permetterebbero al cliente di farlo da solo, ma passare
 * di qui tiene un unico punto in cui la cancellazione è tracciabile.
 *
 * Non tocca la memoria dell'assistente (vedi `memory.ts`), ed è voluto: un fatto
 * imparato in questa conversazione resta vero anche quando la chat non c'è più, e
 * dimenticare cinque mesi di dati perché si è cancellata una chat sarebbe una
 * sorpresa. Per lo stesso motivo i fatti si portano dietro una **copia** del titolo
 * della conversazione, non un rimando: il riferimento sopravvive alla cancellazione.
 * La memoria si cancella da dov'è, cioè dalle impostazioni dell'app.
 */
export const deleteConversation = onCall<DeleteRequest, Promise<{ ok: true }>>(
  { region: 'europe-west1' },
  async (request) => {
    const uid = await requireClient(request);
    const conversationId = idDoc(request.data, 'conversationId');

    await conversationsOf(uid).doc(conversationId).delete();
    return { ok: true };
  }
);
