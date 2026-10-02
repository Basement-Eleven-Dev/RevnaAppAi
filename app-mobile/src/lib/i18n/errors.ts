import type { Dictionary } from './it';

/** Errori già scritti nel log: le schermate traducono a ogni render, il log va fatto una volta. */
const logged = new WeakSet<object>();

/**
 * Traduce un errore in una frase per il cliente, nella lingua dell'app.
 *
 * Il messaggio di un errore non arriva mai a schermo: quello di Firebase è in
 * inglese tecnico, quello delle nostre functions è in italiano anche con l'app in
 * inglese. Si guarda solo il codice, senza il prefisso `auth/` o `functions/`
 * (Firestore non ne ha).
 *
 * `fallback` è il modo in cui la singola schermata dice «non è andata»: vale per i
 * codici che non conosciamo e per gli errori senza codice. `specifici` dà a una
 * schermata una frase sua per un codice che lì ha un significato preciso — lo
 * stesso `resource-exhausted` è il limite di messaggi in chat e il tetto di
 * richieste aperte nella modale di contatto.
 *
 * Il dettaglio tecnico finisce nel log, e solo in sviluppo.
 */
export function errorMessage(
  t: Dictionary,
  cause: unknown,
  fallback: string,
  specifici: Partial<Record<string, string>> = {}
): string {
  if (__DEV__ && typeof cause === 'object' && cause !== null && !logged.has(cause)) {
    logged.add(cause);
    console.warn(cause);
  }

  const code = (cause as { code?: unknown } | null)?.code;
  if (typeof code !== 'string') return fallback;

  const key = code.replace(/^(auth|functions)\//, '');

  return specifici[key] ?? (t.errori as Record<string, string | undefined>)[key] ?? fallback;
}
