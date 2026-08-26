import { httpsCallable } from 'firebase/functions';

import { getFirebaseFunctions } from '@/lib/firebase';
import type { Dictionary } from '@/lib/i18n';

/** Lunghezza minima della password che l'app impone quando la fa scegliere. */
export const MIN_PASSWORD = 8;

/**
 * Traduce un errore di Firebase Auth in una frase per il cliente.
 *
 * `fallback` è il modo in cui la singola schermata dice «non è andata» (accesso,
 * attivazione, cambio password): il codice non basta a dedurlo, perché lo stesso
 * `auth/too-many-requests` capita in tre posti diversi.
 *
 * Su un codice che non conosciamo il codice resta in coda al messaggio. Non è
 * bello, ma è quello che rende assistibile una segnalazione: meglio un codice
 * leggibile che una spiegazione inventata.
 */
export function authErrorMessage(t: Dictionary, cause: unknown, fallback: string): string {
  const code = (cause as { code?: string }).code;

  if (typeof code !== 'string') {
    return cause instanceof Error ? cause.message : fallback;
  }

  const known = (t.erroriAuth as Record<string, string | undefined>)[
    code.replace(/^auth\//, '')
  ];

  return known ?? `${fallback} (${code})`;
}

/**
 * Chiede a Revna il link per rifare la password.
 *
 * Non usiamo `sendPasswordResetEmail` di Firebase: manderebbe il cliente sulla
 * pagina di reset di Firebase, mentre qui la password si sceglie dentro l'app —
 * stessa scelta già fatta per l'attivazione. La function `requestPasswordReset`
 * ricicla quel percorso: email nostra, codice nostro, atterraggio su `/attiva`.
 *
 * Risponde allo stesso modo per un'email registrata e per una che non lo è: da
 * qui non si deve poter scoprire chi è cliente Revna e chi no.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const call = httpsCallable<{ email: string }, { ok: true }>(
    getFirebaseFunctions(),
    'requestPasswordReset'
  );

  await call({ email });
}
