import { Injectable } from '@angular/core';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';

import { getFirebaseDb } from './firebase';
import type { Conversation, Turn } from './conversations.model';

/** Oltre questo non si scorre più: lo storico utile è quello recente. */
const MAX_LISTED = 200;

@Injectable({ providedIn: 'root' })
export class ConversationsService {
  /**
   * Le conversazioni del cliente, dalla più recente, messaggi compresi.
   *
   * Lettura diretta da Firestore, come il profilo e le schede dei documenti: le
   * regole aprono `users/{uid}/conversations` in lettura agli admin Revna. Una
   * conversazione di consulenza sta in pochi KB, quindi arrivano già complete e
   * aprirne una dall'elenco non costa una seconda lettura.
   */
  async list(uid: string): Promise<Conversation[]> {
    const snapshot = await getDocs(
      query(
        collection(getFirebaseDb(), 'users', uid, 'conversations'),
        orderBy('updatedAt', 'desc'),
        limit(MAX_LISTED)
      )
    );

    return snapshot.docs.map((document) => {
      const data = document.data();
      const updatedAt = (data['updatedAt'] as string) ?? '';
      return {
        id: document.id,
        title: (data['title'] as string) ?? '',
        // Le conversazioni aperte prima che `createdAt` esistesse non lo hanno.
        createdAt: (data['createdAt'] as string) ?? updatedAt,
        updatedAt,
        messages: (data['messages'] as Turn[]) ?? [],
      };
    });
  }
}
