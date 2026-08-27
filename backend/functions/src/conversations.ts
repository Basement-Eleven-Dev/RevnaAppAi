import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from './admin';
import type { Source } from './agent';

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
 * una conversazione si legge e si mostra sempre intera, e il limite di 1 MB
 * per documento è lontanissimo dalla lunghezza di una chat di consulenza.
 */
export function conversationsOf(uid: string) {
  return db.collection('users').doc(uid).collection('conversations');
}

/** Oltre questa soglia i turni più vecchi cadono, per non far crescere il documento. */
export const MAX_STORED_TURNS = 200;

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
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Accesso riservato ai clienti Revna.');
    }

    const { conversationId } = request.data;
    if (!conversationId) {
      throw new HttpsError('invalid-argument', 'conversationId mancante.');
    }

    await conversationsOf(uid).doc(conversationId).delete();
    return { ok: true };
  }
);
