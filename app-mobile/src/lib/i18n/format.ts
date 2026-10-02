import type { Dictionary } from './it';

/**
 * Date e misure nella lingua dell'interfaccia, in un posto solo: la stessa data
 * non deve leggersi in tre modi diversi passando da una sezione all'altra.
 */

const DATE_STYLES = {
  /** «12 mar 2026»: negli elenchi fitti, dove la data è una nota a margine. */
  breve: { day: 'numeric', month: 'short', year: 'numeric' },
  /** «12 marzo 2026»: dove la data è un'informazione da leggere. */
  lunga: { day: 'numeric', month: 'long', year: 'numeric' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

/** Una data ISO; vuota se manca o non è una data. */
export function formatDate(iso: string, t: Dictionary, style: keyof typeof DATE_STYLES): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(t.dateLocale, DATE_STYLES[style]);
}

/** L'ora di una data ISO: «09:41». */
export function formatTime(iso: string, t: Dictionary): string {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(t.dateLocale, { hour: '2-digit', minute: '2-digit' });
}

/** Il peso di un file, senza decimali inutili sui file piccoli: «820 KB», «1,5 MB». */
export function formatSize(bytes: number, t: Dictionary): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const megabytes = (bytes / (1024 * 1024)).toLocaleString(t.dateLocale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
  return `${megabytes} MB`;
}
