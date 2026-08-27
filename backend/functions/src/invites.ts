import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { auth, db } from './admin';
import { appBaseUrl } from './config';
import { requireAdmin } from './guards';
import { resendApiKey, sendEmail } from './mailer';
import { profileDisplayName, sanitizeProfile } from './profile';
import { activationEmail } from './templates';

type Request = { email: string; profile: unknown };
type Response = { uid: string; activationUrl: string; emailSent: boolean };

/**
 * Crea l'utenza di un cliente e gli manda il link di attivazione.
 *
 * L'app non ha registrazione libera: gli utenti nascono solo da qui, chiamata
 * dal pannello interno Revna.
 *
 * Il link NON è quello di Firebase: estraiamo il solo `oobCode` e lo incapsuliamo
 * in una nostra pagina, che rimanda all'app. La password il cliente la sceglie
 * dentro l'app, non su una pagina Firebase.
 */
export const createInvite = onCall<Request, Promise<Response>>(
  { region: 'europe-west1', secrets: [resendApiKey] },
  async (request) => {
    requireAdmin(request);

    const email = request.data.email?.trim().toLowerCase();
    if (!email) {
      throw new HttpsError('invalid-argument', 'Email mancante.');
    }

    const profile = sanitizeProfile(request.data.profile);
    const displayName = profileDisplayName(profile) || undefined;

    const user = await auth
      .getUserByEmail(email)
      .catch(() => auth.createUser({ email, displayName }));

    // Il profilo è pronto prima ancora che il cliente entri: al primo accesso
    // non trova un questionario, trova la sua struttura già descritta.
    await db.collection('users').doc(user.uid).set(
      {
        email,
        profile,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: request.auth?.token['email'] ?? null,
      },
      { merge: true }
    );

    const activationUrl = await buildActivationUrl(email);
    const emailSent = await sendEmail({
      to: email,
      ...activationEmail(activationUrl, profile.referente.nome || displayName),
    });

    logger.info('Invito creato', { uid: user.uid, emailSent });

    return { uid: user.uid, activationUrl, emailSent };
  }
);

/**
 * Genera il codice di attivazione e lo incapsula in un URL nostro.
 * Firebase produce un link verso la propria pagina di reset: a noi interessa
 * solo il parametro `oobCode`, che l'app userà con `confirmPasswordReset`.
 *
 * `reset` distingue i due momenti che usano lo stesso identico codice: la prima
 * attivazione e il recupero della password. Firebase non li separa, quindi glielo
 * diciamo noi con un parametro in coda all'URL — l'app lo legge e cambia le
 * parole, non il meccanismo.
 */
export async function buildActivationUrl(email: string, reset = false): Promise<string> {
  const firebaseLink = await auth.generatePasswordResetLink(email);
  const code = new URL(firebaseLink).searchParams.get('oobCode');

  if (!code) {
    throw new HttpsError('internal', 'Codice di attivazione non ricavabile dal link Firebase.');
  }

  const suffix = reset ? '&reset=1' : '';
  return `${appBaseUrl.value()}/attiva?code=${encodeURIComponent(code)}${suffix}`;
}
