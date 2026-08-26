/**
 * Le lingue dell'interfaccia.
 *
 * Dizionari scritti a mano invece di una libreria di i18n: l'app ha due lingue e
 * qualche centinaio di stringhe, e un oggetto tipizzato dà quello che a una
 * libreria si chiederebbe comunque — chiavi verificate a compilazione,
 * interpolazione, plurali dove servono — senza un formato di file da imparare e
 * senza chiavi che si scoprono mancanti solo a runtime.
 *
 * `it.ts` è la forma autorevole (vedi `Dictionary`), `en.ts` la riempie.
 */

import { getLocales } from 'expo-localization';

import { en } from './en';
import { it, type Dictionary } from './it';

export type { Dictionary };

/** Prima lingua = quella di riferimento, usata anche come ripiego. */
export const LANGUAGES = ['it', 'en'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DICTIONARIES: Record<Language, Dictionary> = { it, en };

/**
 * Nome di ogni lingua nella lingua stessa: chi ha l'app in italiano e cerca
 * l'inglese cerca «English», non «Inglese».
 */
export const LANGUAGE_NAMES: Record<Language, string> = {
  it: 'Italiano',
  en: 'English',
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * Lingua da usare al primo avvio, dedotta dalle impostazioni del telefono.
 *
 * Si guardano tutte le lingue preferite del sistema e non solo la prima: chi ha
 * il telefono in tedesco con l'italiano come seconda lingua è meglio servito in
 * italiano che nel ripiego. Se nessuna è tra le nostre si ripiega sull'italiano:
 * i clienti Revna sono in gran parte italiani.
 */
export function deviceLanguage(): Language {
  for (const locale of getLocales()) {
    const code = locale.languageCode?.toLowerCase();
    if (isLanguage(code)) return code;
  }

  return LANGUAGES[0];
}

/**
 * Etichetta di un valore a lista chiusa (tipologia di struttura, servizio, canale…).
 *
 * Il ripiego sul valore grezzo serve ai dati storici: un documento scritto quando
 * la lista aveva una voce in più deve mostrare qualcosa, non una riga vuota.
 */
export function labelOf(labels: Record<string, string>, value: string): string {
  return (labels as Record<string, string | undefined>)[value] ?? value;
}

export function labelsOf(labels: Record<string, string>, values: string[]): string[] {
  return values.map((value) => labelOf(labels, value));
}
