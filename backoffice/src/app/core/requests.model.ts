/**
 * Richieste di contatto, così come le legge Revna.
 *
 * Sono la coda di quello che l'assistente non ha potuto risolvere. I tipi ricalcano
 * quelli del backend (`backend/functions/src/requests.ts`), come già fanno profilo,
 * documenti e conversazioni: poche righe duplicate invece di un pacchetto condiviso.
 */

export const STATI = ['inviata', 'visualizzata', 'chiusa'] as const;

export type Stato = (typeof STATI)[number];

export type Origine = 'assistente' | 'richieste';

/** Il recapito del cliente al momento della richiesta, congelato dal server. */
export type Contatto = {
  email: string;
  nome: string;
  ruolo: string;
  telefono: string;
  struttura: string;
};

export type ContactRequest = {
  id: string;
  uid: string;
  stato: Stato;
  messaggio: string;
  origine: Origine;
  /** La conversazione da cui è nata, quando è nata dalla chat. */
  conversationId?: string;
  contatto: Contatto;
  createdAt: string;
  updatedAt: string;
  statoAt?: string;
  statoBy?: string;
};

/** Etichette degli stati, nell'ordine in cui una richiesta li attraversa. */
export const STATO_LABEL: Record<Stato, string> = {
  inviata: 'Inviata',
  visualizzata: 'Visualizzata',
  chiusa: 'Chiusa',
};

/** Cosa vuol dire ogni stato per chi lavora la coda, non per il cliente. */
export const STATO_HINT: Record<Stato, string> = {
  inviata: 'Nessuno l\'ha ancora aperta.',
  visualizzata: 'Letta: il cliente sa che qualcuno la sta seguendo.',
  chiusa: 'Chiusa. Il cliente vede che la partita è finita.',
};

export const ORIGINE_LABEL: Record<Origine, string> = {
  assistente: 'Nata dalla chat con l\'assistente',
  richieste: 'Aperta dal cliente dalla sezione Richieste',
};

/**
 * Le richieste ancora da lavorare.
 *
 * È il filtro di partenza della pagina: la coda serve per quello che è aperto, e
 * chi la apre la mattina non vuole scorrere sei mesi di richieste chiuse.
 */
export function isAperta(request: ContactRequest): boolean {
  return request.stato !== 'chiusa';
}

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

/** Quanto è ferma: su una richiesta di contatto l'attesa è il dato che conta. */
export function daysAgo(iso: string): number {
  if (!iso) return 0;
  const millis = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(millis / 86_400_000));
}

/** L'attesa in parole, per la riga di elenco. */
export function attesa(iso: string): string {
  const giorni = daysAgo(iso);
  if (giorni === 0) return 'oggi';
  if (giorni === 1) return 'ieri';
  return `${giorni} giorni`;
}
