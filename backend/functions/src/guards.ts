import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

/** Solo i referenti Revna (custom claim `revnaAdmin`) possono usare il backoffice. */
export function requireAdmin(request: CallableRequest<unknown>): void {
  if (request.auth?.token['revnaAdmin'] !== true) {
    throw new HttpsError('permission-denied', 'Riservato ai referenti Revna.');
  }
}
