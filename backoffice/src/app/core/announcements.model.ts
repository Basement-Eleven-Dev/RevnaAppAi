/**
 * Comunicazioni ai clienti, così come le scrive e le rilegge Revna.
 *
 * I tipi ricalcano quelli del backend (`backend/functions/src/announcements.ts`), come
 * già fanno profilo, documenti, conversazioni e richieste: poche righe duplicate
 * invece di un pacchetto condiviso.
 *
 * Il corpo è **markdown**, non HTML. La scelta viene da dove il testo va a finire:
 * l'app lo rende con il proprio renderer (`app-mobile/src/components/markdown.tsx`),
 * già in uso per le risposte dell'assistente, che non è un browser e non esegue tag.
 * Salvare HTML vorrebbe dire portare un parser HTML dentro React Native per mostrare
 * quattro tipi di blocco. L'editor del backoffice è WYSIWYG e traduce nei due versi
 * (vedi `components/rich-text`): chi scrive non vede un asterisco.
 */

export const STATI = ['bozza', 'inviato'] as const;

export type Stato = (typeof STATI)[number];

/** A chi va: tutti i clienti attivi al momento dell'invio, o una selezione. */
export type ModoDestinatari = 'tutti' | 'selezione';

export type Destinatari = { modo: ModoDestinatari; uids: string[] };

export type Announcement = {
  id: string;
  titolo: string;
  /** Markdown, prodotto dall'editor. */
  corpo: string;
  /** Prime righe in chiaro: anteprima nell'elenco e corpo della notifica. */
  estratto: string;
  destinatari: Destinatari;
  stato: Stato;
  /** I destinatari veri, risolti dal server all'invio. */
  inviatoA: string[];
  destinatariCount: number;
  lettiCount: number;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  inviatoAt?: string;
  inviatoBy?: string | null;
};

/** Come sul server: oltre, non è più un titolo da elenco. */
export const MAX_TITLE_CHARS = 120;

/** Come sul server: oltre, è un documento e non una comunicazione. */
export const MAX_BODY_CHARS = 20_000;

export const STATO_LABEL: Record<Stato, string> = {
  bozza: 'Bozza',
  inviato: 'Inviata',
};

export function isBozza(announcement: Announcement): boolean {
  return announcement.stato === 'bozza';
}

/**
 * Le letture in parole.
 *
 * «Nessuno l'ha ancora aperta» invece di «0 su 12» perché è la frase che dice cosa
 * fare: un avviso che nessuno apre dopo tre giorni è un avviso scritto male, o mandato
 * a un pubblico che non è quello giusto.
 */
export function lettureLabel(announcement: Announcement): string {
  const { lettiCount, destinatariCount } = announcement;
  if (destinatariCount === 0) return '—';
  if (lettiCount === 0) return `Nessuno l'ha ancora aperta · ${destinatariCount} destinatari`;
  if (lettiCount === destinatariCount) return `Letta da tutti · ${destinatariCount}`;
  return `Letta da ${lettiCount} su ${destinatariCount}`;
}

export function destinatariLabel(destinatari: Destinatari): string {
  if (destinatari.modo === 'tutti') return 'Tutti i clienti';
  const quanti = destinatari.uids.length;
  if (quanti === 0) return 'Nessun destinatario scelto';
  return quanti === 1 ? '1 cliente scelto' : `${quanti} clienti scelti`;
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

/** Il documento Firestore, con ripieghi: un campo mancante non deve rompere l'elenco. */
export function toAnnouncement(id: string, data: Record<string, unknown>): Announcement {
  const destinatari = (data['destinatari'] ?? {}) as Partial<Destinatari>;
  const createdAt = (data['createdAt'] as string) ?? '';

  return {
    id,
    titolo: (data['titolo'] as string) ?? '',
    corpo: (data['corpo'] as string) ?? '',
    estratto: (data['estratto'] as string) ?? '',
    destinatari: {
      modo: destinatari.modo === 'selezione' ? 'selezione' : 'tutti',
      uids: Array.isArray(destinatari.uids) ? destinatari.uids : [],
    },
    stato: data['stato'] === 'inviato' ? 'inviato' : 'bozza',
    inviatoA: Array.isArray(data['inviatoA']) ? (data['inviatoA'] as string[]) : [],
    destinatariCount: Number(data['destinatariCount'] ?? 0),
    lettiCount: Number(data['lettiCount'] ?? 0),
    createdAt,
    createdBy: (data['createdBy'] as string) ?? null,
    updatedAt: (data['updatedAt'] as string) ?? createdAt,
    updatedBy: (data['updatedBy'] as string) ?? null,
    ...(data['inviatoAt'] ? { inviatoAt: data['inviatoAt'] as string } : {}),
    ...(data['inviatoBy'] ? { inviatoBy: data['inviatoBy'] as string } : {}),
  };
}
