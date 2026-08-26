/**
 * Conversazioni fra il cliente e l'assistente, così come le rilegge Revna.
 *
 * Il backoffice le vede in sola lettura: le scrive solo `askAssistant`, e
 * cancellarle resta del cliente (vedi `backend/firestore.rules`). Qui servono
 * a chi sta per parlare con la struttura — sapere cosa ha già chiesto
 * all'assistente evita di ripartire da zero, o di ripetere un consiglio.
 *
 * I tipi ricalcano quelli del backend (`backend/functions/src/conversations.ts`)
 * come già fanno profilo e documenti: poche righe, nessun pacchetto condiviso.
 */

/** Fonte Revna citata in una risposta: i numeri sono i marcatori `[1]` nel testo. */
export type Source = {
  n: number;
  titolo: string;
};

export type Turn = {
  role: 'user' | 'model';
  text: string;
  sources?: Source[];
  /** Ora del turno, in ISO. Manca sui turni salvati prima che il campo esistesse. */
  at?: string;
};

export type Conversation = {
  id: string;
  /** Può essere vuoto sulle conversazioni più vecchie: chi lo mostra ripiega. */
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Turn[];
};

/** Data e ora complete: qui non c'è il «oggi/ieri» dell'app, si legge uno storico. */
export function formatDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso: string): string {
  return iso ? new Date(iso).toLocaleDateString('it-IT') : '—';
}

export function formatTime(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

/** Quante domande ha fatto il cliente: è la misura di quanto è andata avanti. */
export function domande(conversation: Conversation): number {
  return conversation.messages.filter((turn) => turn.role === 'user').length;
}

/**
 * Le conversazioni raggruppate per giorno, nell'ordine in cui arrivano.
 *
 * Il raggruppamento sta qui e non nel template perché serve a entrambi gli
 * elenchi: le date fanno da intestazioni nella colonna di sinistra.
 */
export function byDay(conversations: Conversation[]): { day: string; items: Conversation[] }[] {
  const groups: { day: string; items: Conversation[] }[] = [];

  for (const conversation of conversations) {
    const day = formatDate(conversation.updatedAt);
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(conversation);
    else groups.push({ day, items: [conversation] });
  }

  return groups;
}
