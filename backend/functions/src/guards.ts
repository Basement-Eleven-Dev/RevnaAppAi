import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

import { auth } from './admin';

/** Solo i referenti Revna (custom claim `revnaAdmin`) possono usare il backoffice. */
export function requireAdmin(request: CallableRequest<unknown>): void {
  if (request.auth?.token['revnaAdmin'] !== true) {
    throw new HttpsError('permission-denied', 'Riservato ai referenti Revna.');
  }
}

/** Gli errori di Auth che vogliono dire «questa utenza non può più entrare». */
const UTENZA_CHIUSA = new Set([
  'auth/user-disabled',
  'auth/id-token-revoked',
  'auth/user-not-found',
]);

/**
 * Chi chiama, con un'utenza ancora attiva: restituisce l'uid.
 *
 * Il token che arriva con la richiesta è già verificato, ma solo nella firma: vale
 * fino a un'ora anche dopo che il backoffice ha disattivato il cliente. Il controllo
 * di revoca costa una lettura su Auth, la stessa che costerebbe leggere l'utente e
 * confrontare le date a mano, e copre in un colpo disattivazione, revoca e utenza
 * cancellata.
 */
export async function requireUser(request: CallableRequest<unknown>): Promise<string> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Accesso riservato ai clienti Revna.');
  }

  try {
    await auth.verifyIdToken(request.auth.rawToken, true);
  } catch (cause) {
    if (UTENZA_CHIUSA.has((cause as { code?: string }).code ?? '')) {
      throw new HttpsError('unauthenticated', 'Questa utenza non è più attiva.');
    }
    throw cause;
  }

  return request.auth.uid;
}

/**
 * Come `requireUser`, ma solo per i clienti: le callable dell'app non hanno senso per
 * un referente Revna, che non ha una struttura né conversazioni sue.
 */
export async function requireClient(request: CallableRequest<unknown>): Promise<string> {
  if (request.auth?.token['revnaAdmin'] === true) {
    throw new HttpsError('permission-denied', 'Riservato ai clienti Revna.');
  }
  return requireUser(request);
}

/** Il campo `nome` di quello che ha mandato il client, qualunque cosa abbia mandato. */
function campo(data: unknown, nome: string): unknown {
  return typeof data === 'object' && data !== null
    ? (data as Record<string, unknown>)[nome]
    : undefined;
}

/**
 * Un testo mandato dal client, senza spazi ai bordi. Assente vale `''`: se il vuoto
 * va bene lo decide chi chiama. Un tipo diverso è un errore del client, non nostro.
 */
export function stringa(data: unknown, nome: string): string {
  const value = campo(data, nome);
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${nome} non è un testo.`);
  }
  return value.trim();
}

/**
 * Un id di documento mandato dal client, se c'è.
 *
 * Una `/` dentro l'id sposterebbe la lettura o la scrittura su un altro percorso di
 * Firestore, `.` e `..` Firestore non li accetta: tutti rifiutati prima di arrivarci.
 */
export function idDocFacoltativo(data: unknown, nome: string): string | undefined {
  const value = campo(data, nome);
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.includes('/') || value === '.' || value === '..') {
    throw new HttpsError('invalid-argument', `${nome} non valido.`);
  }
  return value;
}

/** Come `idDocFacoltativo`, ma l'id è necessario. */
export function idDoc(data: unknown, nome: string): string {
  const value = idDocFacoltativo(data, nome);
  if (!value) {
    throw new HttpsError('invalid-argument', `${nome} mancante.`);
  }
  return value;
}
