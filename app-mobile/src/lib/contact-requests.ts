/**
 * Richieste di contatto: quando l'assistente non basta, si chiede una persona.
 *
 * I tipi ricalcano quelli del backend (`backend/functions/src/requests.ts`), come già
 * fanno profilo e documenti: poche righe duplicate invece di un pacchetto condiviso.
 * Le etichette degli stati non stanno qui ma nei dizionari, come tutto il testo che
 * l'utente legge — qui ci sono i valori, che sono un contratto con il backend.
 */

export const STATI = ['inviata', 'visualizzata', 'chiusa'] as const;

export type Stato = (typeof STATI)[number];

/** Da dove è nata la richiesta: dalla chat con l'assistente o dalla sezione «Richieste». */
export type Origine = 'assistente' | 'richieste';

/** Il recapito con cui la richiesta è partita, congelato dal server. */
export type Contatto = {
  email: string;
  nome: string;
  ruolo: string;
  telefono: string;
  struttura: string;
};

export type ContactRequest = {
  id: string;
  stato: Stato;
  messaggio: string;
  origine: Origine;
  conversationId?: string;
  contatto: Contatto;
  createdAt: string;
  updatedAt: string;
};

/** Come sul server: oltre questo non è più una richiesta di contatto. */
export const MAX_MESSAGE_CHARS = 2000;

/** Lo stato letto da Firestore, con ripiego: un valore ignoto non deve rompere l'elenco. */
export function toStato(value: unknown): Stato {
  return STATI.includes(value as Stato) ? (value as Stato) : 'inviata';
}

/**
 * Toglie dal testo in arrivo il marcatore con cui l'assistente propone una richiesta.
 *
 * Serve solo durante lo streaming: la risposta finale arriva dal server già pulita
 * (vedi `extractContactProposal` in `backend/functions/src/agent.ts`), ma i pezzi
 * mentre il modello scrive no, e il marcatore non deve comparire nemmeno per un
 * istante. Si taglia al primo `<<` invece di cercare il marcatore intero perché
 * mentre arriva è incompleto — e `<<` in una risposta di consulenza non capita.
 */
export function stripHandoff(text: string): string {
  const cut = text.indexOf('<<');
  return (cut === -1 ? text : text.slice(0, cut)).trimEnd();
}
