import { signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

import { getFirebaseAuth, getFirebaseFunctions } from '@/lib/firebase';
import { unregisterPushToken } from '@/lib/push';

/** Lunghezza minima della password che l'app impone quando la fa scegliere. */
export const MIN_PASSWORD = 8;

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

/**
 * Esce dall'account, dopo aver dimenticato questo dispositivo.
 *
 * Prima il token e poi la sessione, perché cancellare il token è una scrittura su
 * Firestore e la vogliono fare le regole di chi è ancora dentro. La cancellazione ha
 * un tempo massimo (vedi `unregisterPushToken`): offline si esce lo stesso.
 */
export async function signOutDevice(): Promise<void> {
  await unregisterPushToken();
  await signOut(getFirebaseAuth());
}
