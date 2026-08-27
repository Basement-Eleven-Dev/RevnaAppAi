import type { Dictionary } from '@/lib/i18n';

/**
 * La memoria dell'assistente, dal lato dell'app.
 *
 * Tiene **le preferenze di chi scrive** — come vuole le risposte, cosa l'assistente
 * non deve fare, come va trattato — e non i dati della struttura, che cambiano e
 * starebbero qui solo per contraddirsi (quelli stanno nel profilo). Le scrive il
 * backend (`backend/functions/src/memory.ts`) man mano che il cliente parla; qui si
 * leggono, si correggono una per una e si cancellano. La forma è la stessa dei
 * documenti Firestore: questo file non è un modello a parte, è il contratto con quel
 * modulo.
 */

/** Chi ha scritto la riga per ultimo: l'assistente parlando, o il cliente correggendo. */
export type MemoryOrigin = 'assistente' | 'cliente';

export type MemoryEntry = {
  id: string;
  /** La preferenza in una frase: l'unica cosa che il cliente può modificare. */
  testo: string;
  /** Quando l'assistente l'ha imparato, in ISO. */
  at: string;
  /** Quando è stato riscritto l'ultima volta. */
  updatedAt: string;
  /** Il titolo della conversazione in cui è emerso, copiato all'epoca. */
  conversazione?: string;
  origine: MemoryOrigin;
};

/** Lo stesso limite di `MAX_ENTRY_CHARS` nel backend e nelle regole Firestore. */
export const MAX_ENTRY_CHARS = 280;

/**
 * La riga sotto una preferenza: quando l'assistente l'ha imparata, e da dove.
 *
 * La data per esteso e non «2 giorni fa»: serve a riconoscere la preferenza — «questo
 * l'ho chiesto io, a marzo» — e una data lo fa meglio di una distanza. Il riferimento
 * alla conversazione c'è solo se la riga se lo porta dietro.
 */
export function entryMeta(entry: MemoryEntry, t: Dictionary): string {
  const date = new Date(entry.at);
  const quando = Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(t.dateLocale, { day: 'numeric', month: 'long', year: 'numeric' });

  const parts = [t.impostazioni.memoria.imparato(quando)];

  if (entry.origine === 'cliente') parts.push(t.impostazioni.memoria.corretto);
  if (entry.conversazione) parts.push(t.impostazioni.memoria.da(entry.conversazione));

  return parts.join(' · ');
}
