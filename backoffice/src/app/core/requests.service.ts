import { Injectable } from '@angular/core';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { getFirebaseDb, getFirebaseFunctions } from './firebase';
import type { ContactRequest, Contatto, Stato } from './requests.model';

/** Oltre questo non si scorre più: la coda utile è quella recente. */
const MAX_LISTED = 300;

@Injectable({ providedIn: 'root' })
export class RequestsService {
  private readonly updateStatoFn = httpsCallable<{ requestId: string; stato: Stato }, { ok: true }>(
    getFirebaseFunctions(),
    'updateContactRequest'
  );

  /**
   * Le richieste, dalla più recente. Tutte, o quelle di un cliente solo.
   *
   * Lettura diretta da Firestore, come il profilo e le schede dei documenti: le
   * regole aprono `contactRequests` in lettura ai referenti Revna. Il filtro per
   * cliente sta nella query e non in memoria perché è l'unico caso in cui la coda
   * può essere lunga e ne interessa una fetta sola.
   */
  async list(uid?: string): Promise<ContactRequest[]> {
    const base = collection(getFirebaseDb(), 'contactRequests');
    const snapshot = await getDocs(
      uid
        ? query(base, where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(MAX_LISTED))
        : query(base, orderBy('createdAt', 'desc'), limit(MAX_LISTED))
    );

    return snapshot.docs.map((document) => {
      const data = document.data();
      const contatto = (data['contatto'] ?? {}) as Partial<Contatto>;
      const createdAt = (data['createdAt'] as string) ?? '';

      return {
        id: document.id,
        uid: (data['uid'] as string) ?? '',
        stato: (data['stato'] as Stato) ?? 'inviata',
        messaggio: (data['messaggio'] as string) ?? '',
        origine: data['origine'] === 'assistente' ? 'assistente' : 'richieste',
        ...(data['conversationId'] ? { conversationId: data['conversationId'] as string } : {}),
        contatto: {
          email: contatto.email ?? '',
          nome: contatto.nome ?? '',
          ruolo: contatto.ruolo ?? '',
          telefono: contatto.telefono ?? '',
          struttura: contatto.struttura ?? '',
        },
        createdAt,
        updatedAt: (data['updatedAt'] as string) ?? createdAt,
        ...(data['statoAt'] ? { statoAt: data['statoAt'] as string } : {}),
        ...(data['statoBy'] ? { statoBy: data['statoBy'] as string } : {}),
      } satisfies ContactRequest;
    });
  }

  /**
   * Cambia lo stato.
   *
   * Passa da una function e non da una scrittura diretta come le schede dei
   * documenti: lo stato è quello che il cliente vede nell'app, e chi l'ha mosso
   * deve restare scritto (vedi `updateContactRequest`).
   */
  async setStato(requestId: string, stato: Stato): Promise<void> {
    await this.updateStatoFn({ requestId, stato });
  }
}
