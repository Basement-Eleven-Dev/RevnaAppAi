import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { getFirebaseDb, getFirebaseFunctions, isFirebaseConfigured } from '@/lib/firebase';
import type { Dictionary } from '@/lib/i18n';

/**
 * Fonte Revna citata in una risposta. I numeri corrispondono ai marcatori `[1]`
 * dentro il testo: li assegna il backend, che li ricompatta prima di rispondere.
 */
export type Source = {
  n: number;
  titolo: string;
};

/**
 * Un turno di conversazione. Le fonti stanno sul turno perché sono parte della
 * risposta: riaprendo una conversazione dalla sidebar devono ricomparire anche loro.
 */
export type StoredTurn = {
  role: 'user' | 'model';
  text: string;
  sources?: Source[];
  /**
   * La richiesta di contatto che l'assistente ha proposto in questo turno, quando
   * ha capito di non potercela fare da solo. Sta sul turno come le fonti: riaprendo
   * la conversazione l'offerta di essere ricontattati deve essere ancora lì.
   */
  proposal?: string;
};

export type ConversationSummary = {
  id: string;
  /** Può essere vuoto: chi lo mostra ripiega su `t.conversazioni.senzaTitolo`. */
  title: string;
  updatedAt: string;
  messages: StoredTurn[];
};

/** Quante conversazioni tenere nell'elenco laterale. */
const MAX_LISTED = 50;

/**
 * Elenco live delle conversazioni del cliente, dalla più recente.
 *
 * Porta con sé anche i messaggi: una conversazione di consulenza sta in pochi KB
 * e averla già in memoria rende l'apertura dalla sidebar istantanea, senza una
 * seconda lettura.
 */
export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const ref = query(
      collection(getFirebaseDb(), 'users', user.uid, 'conversations'),
      orderBy('updatedAt', 'desc'),
      limit(MAX_LISTED)
    );

    return onSnapshot(
      ref,
      (snapshot) => {
        setConversations(snapshot.docs.map((document) => toSummary(document.id, document.data())));
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [user]);

  async function remove(conversationId: string) {
    const call = httpsCallable<{ conversationId: string }, { ok: true }>(
      getFirebaseFunctions(),
      'deleteConversation'
    );
    await call({ conversationId });
  }

  return { conversations, loading, remove };
}

function toSummary(id: string, data: DocumentData): ConversationSummary {
  return {
    id,
    title: (data['title'] as string) ?? '',
    updatedAt: (data['updatedAt'] as string) ?? '',
    messages: (data['messages'] as StoredTurn[]) ?? [],
  };
}

/** Etichetta temporale compatta per l'elenco: oggi, ieri, poi la data. */
export function whenLabel(iso: string, t: Dictionary): string {
  if (!iso) return '';

  const date = new Date(iso);
  const today = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (sameDay(date, today)) {
    return date.toLocaleTimeString(t.dateLocale, { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, yesterday)) return t.comune.ieri;

  return date.toLocaleDateString(t.dateLocale, { day: 'numeric', month: 'short' });
}
