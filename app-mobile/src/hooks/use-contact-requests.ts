import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { getFirebaseDb, getFirebaseFunctions, isFirebaseConfigured } from '@/lib/firebase';
import { toStato, type ContactRequest } from '@/lib/contact-requests';

/** Quante richieste tenere nell'elenco: oltre, non è più uno storico che si scorre. */
const MAX_LISTED = 100;

/**
 * Le richieste di contatto di questo cliente, in ascolto live.
 *
 * Live e non a richiesta perché lo stato è la ragione per cui si torna in questa
 * schermata: quando il referente Revna apre una richiesta, il passaggio a
 * «visualizzata» deve comparire senza che il cliente debba ricaricare qualcosa.
 *
 * Il filtro su `uid` non è di comodo: le regole lo pretendono, perché la collezione
 * è di primo livello e senza quel filtro Firestore rifiuta la query (vedi
 * `backend/firestore.rules`).
 */
export function useContactRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isFirebaseConfigured || !user) {
      setRequests([]);
      setLoading(false);
      return;
    }

    const ref = query(
      collection(getFirebaseDb(), 'contactRequests'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(MAX_LISTED)
    );

    return onSnapshot(
      ref,
      (snapshot) => {
        setRequests(snapshot.docs.map((document) => toRequest(document.id, document.data())));
        setLoading(false);
      },
      (cause) => {
        setError(cause.message);
        setLoading(false);
      }
    );
  }, [user]);

  return { requests, loading, error };
}

/**
 * Apre una richiesta di contatto.
 *
 * Sta fuori dall'hook perché la chiama anche la chat, dove l'elenco non serve: la
 * richiesta nasce dalla risposta dell'assistente e il cliente non deve passare
 * dalla sezione «Richieste» per mandarla.
 *
 * Il testo è l'unica cosa che parte da qui. Nome, recapito e stato li mette il
 * server: sono la parte della richiesta di cui il consulente si deve fidare.
 */
export async function createContactRequest(input: {
  messaggio: string;
  conversationId?: string;
}): Promise<string> {
  const call = httpsCallable<{ messaggio: string; conversationId?: string }, { id: string }>(
    getFirebaseFunctions(),
    'createContactRequest'
  );
  const { data } = await call(input);
  return data.id;
}

function toRequest(id: string, data: DocumentData): ContactRequest {
  const contatto = (data['contatto'] ?? {}) as Record<string, string>;
  const createdAt = (data['createdAt'] as string) ?? '';

  return {
    id,
    stato: toStato(data['stato']),
    messaggio: (data['messaggio'] as string) ?? '',
    origine: data['origine'] === 'assistente' ? 'assistente' : 'richieste',
    ...(data['conversationId'] ? { conversationId: data['conversationId'] as string } : {}),
    contatto: {
      email: contatto['email'] ?? '',
      nome: contatto['nome'] ?? '',
      ruolo: contatto['ruolo'] ?? '',
      telefono: contatto['telefono'] ?? '',
      struttura: contatto['struttura'] ?? '',
    },
    createdAt,
    updatedAt: (data['updatedAt'] as string) ?? createdAt,
  };
}
