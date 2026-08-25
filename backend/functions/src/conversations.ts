import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from './admin';

export type StoredTurn = { role: 'user' | 'model'; text: string };

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
 * di qui tiene un unico punto in cui la cancellazione è tracciabile e in cui
 * potremo agganciare la rimozione della memoria dell'assistente.
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
