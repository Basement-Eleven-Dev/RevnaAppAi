import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { useLiveData, type Subscribe } from '@/hooks/use-live-data';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
import { formatDate, formatTime, type Dictionary } from '@/lib/i18n';

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
  /** Cosa ne ha fatto il cliente: la scrive il server, e la card resta chiusa. */
  proposalStato?: ProposalStato;
  /** Quando il turno è stato scritto, in ISO: è con questa che si indica la proposta. */
  at?: string;
};

export type ProposalStato = 'inviata' | 'scartata';

export type ConversationSummary = {
  id: string;
  /** Può essere vuoto: chi lo mostra ripiega su `t.conversazioni.senzaTitolo`. */
  title: string;
  updatedAt: string;
  messages: StoredTurn[];
};

/** Come sul server (`backend/functions/src/conversations.ts`): oltre, la domanda è rifiutata. */
export const MAX_MESSAGE_CHARS = 4000;

/** Quante conversazioni tenere nell'elenco laterale. */
const MAX_LISTED = 50;

const NONE: ConversationSummary[] = [];

const subscribe: Subscribe<ConversationSummary[]> = (uid, onData, onError) =>
  onSnapshot(
    query(
      collection(getFirebaseDb(), 'users', uid, 'conversations'),
      orderBy('updatedAt', 'desc'),
      limit(MAX_LISTED)
    ),
    (snapshot) => onData(snapshot.docs.map((document) => toSummary(document.id, document.data()))),
    onError
  );

/**
 * Elenco live delle conversazioni del cliente, dalla più recente.
 *
 * Porta con sé anche i messaggi: una conversazione di consulenza sta in pochi KB
 * e averla già in memoria rende l'apertura dalla sidebar istantanea, senza una
 * seconda lettura.
 */
export function useConversations() {
  const { data: conversations, loading, error } = useLiveData(subscribe, NONE);

  async function remove(conversationId: string) {
    const call = httpsCallable<{ conversationId: string }, { ok: true }>(
      getFirebaseFunctions(),
      'deleteConversation'
    );
    await call({ conversationId });
  }

  return { conversations, loading, error, remove };
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

  if (sameDay(date, today)) return formatTime(iso, t);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, yesterday)) return t.comune.ieri;

  return formatDate(iso, t, 'breve');
}
