import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { auth, db } from './admin';
import { buildActivationUrl } from './invites';
import { resendApiKey, sendEmail } from './mailer';
import { passwordResetEmail } from './templates';

/**
 * Recupero password richiesto dal cliente dall'app.
 *
 * Non usiamo `sendPasswordResetEmail` lato client: manderebbe il cliente sulla
 * pagina di reset di Firebase. Qui la password si sceglie dentro l'app, come per
 * l'attivazione, quindi ricicliamo lo stesso percorso — `buildActivationUrl` con
 * `reset`, email nostra, atterraggio su `/attiva`.
 *
 * Chiamabile senza autenticazione, per forza di cose: chi ha perso la password
 * non è dentro. Da questo discendono le due cautele qui sotto — la risposta cieca
 * e la pausa fra un invio e l'altro.
 */

/** Intervallo minimo fra due richieste per la stessa email. */
const COOLDOWN_MS = 60_000;

type Request = { email?: string };
type Response = { ok: true };

export const requestPasswordReset = onCall<Request, Promise<Response>>(
  { region: 'europe-west1', secrets: [resendApiKey] },
  async (request) => {
    const email = request.data.email?.trim().toLowerCase();

    if (!email || !email.includes('@')) {
      throw new HttpsError('invalid-argument', 'Email mancante o non valida.');
    }

    // La risposta è la stessa in ogni caso: email sconosciuta, invio in pausa,
    // invio riuscito. Da fuori non si deve poter distinguere, altrimenti questa
    // function diventa un modo per sapere chi è cliente Revna e chi no. Gli
    // errori veri restano nei log, dove li vede solo chi ha diritto di vederli.
    try {
      await sendResetLink(email);
    } catch (cause) {
      logger.warn('Recupero password non completato', { email, cause });
    }

    return { ok: true };
  }
);

async function sendResetLink(email: string): Promise<void> {
  if (!(await claimAttempt(email))) {
    logger.info('Recupero password ignorato: richiesto da poco', { email });
    return;
  }

  // Se l'utenza non esiste, `generatePasswordResetLink` solleva: è il caso in cui
  // non si manda niente e non si dice niente.
  const resetUrl = await buildActivationUrl(email, true);
  const user = await auth.getUserByEmail(email);

  const sent = await sendEmail({
    to: email,
    ...passwordResetEmail(resetUrl, user.displayName ?? undefined),
  });

  logger.info('Recupero password inviato', { uid: user.uid, sent });
}

/**
 * Registra il tentativo e dice se si può procedere.
 *
 * Serve perché la function è aperta: senza, chiunque conosca l'indirizzo di un
 * cliente può riempirgli la casella e — peggio — invalidargli in continuazione
 * il codice appena ricevuto, dato che ogni nuovo `oobCode` spegne il precedente.
 *
 * Una transazione e non una lettura seguita da una scrittura: due richieste
 * arrivate insieme leggerebbero entrambe «nessun tentativo recente» e passerebbero
 * tutte e due.
 */
async function claimAttempt(email: string): Promise<boolean> {
  const ref = db.collection('passwordResets').doc(encodeURIComponent(email));

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const last = snapshot.get('lastRequestedAt') as string | undefined;

    if (last && Date.now() - Date.parse(last) < COOLDOWN_MS) return false;

    tx.set(ref, { email, lastRequestedAt: new Date().toISOString() });
    return true;
  });
}
