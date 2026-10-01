import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { auth, db } from './admin';
import { appBaseUrl } from './config';
import { idDoc, requireAdmin, stringa } from './guards';
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
 * Crea e basta: un'email che ha già un'utenza viene rifiutata. Riusarla vorrebbe
 * dire riscrivere il profilo di un cliente esistente e spegnergli il link che ha
 * in mano; per mandargli un link nuovo c'è `resendInvite`.
 *
 * Il link NON è quello di Firebase: estraiamo il solo `oobCode` e lo incapsuliamo
 * in una nostra pagina, che rimanda all'app. La password il cliente la sceglie
 * dentro l'app, non su una pagina Firebase.
 */
export const createInvite = onCall<Request, Promise<Response>>(
  { region: 'europe-west1', secrets: [resendApiKey] },
  async (request) => {
    requireAdmin(request);

    const email = stringa(request.data, 'email').toLowerCase();
    if (!email) {
      throw new HttpsError('invalid-argument', 'Email mancante.');
    }

    const profile = sanitizeProfile(request.data.profile);
    const displayName = profileDisplayName(profile) || undefined;

    // `createUser` e non una lettura prima: è Auth a garantire l'unicità
    // dell'email, anche fra due creazioni partite insieme.
    const user = await auth.createUser({ email, displayName }).catch(async (cause: unknown) => {
      if ((cause as { code?: string }).code !== 'auth/email-already-exists') throw cause;
      throw await alreadyExists(email);
    });

    // Il profilo è pronto prima ancora che il cliente entri: al primo accesso
    // non trova un questionario, trova la sua struttura già descritta.
    const now = new Date().toISOString();
    await db.collection('users').doc(user.uid).set({
      email,
      profile,
      createdAt: now,
      updatedAt: now,
      updatedBy: request.auth?.token['email'] ?? null,
    });

    const activationUrl = await buildActivationUrl(email);
    const emailSent = await sendEmail({
      to: email,
      ...activationEmail(activationUrl, profile.referente.nome || displayName),
    });

    logger.info('Invito creato', { uid: user.uid, emailSent });

    return { uid: user.uid, activationUrl, emailSent };
  }
);

/** L'errore per un'email già registrata: col cliente in `details`, per aprirne la scheda. */
async function alreadyExists(email: string): Promise<HttpsError> {
  const existing = await auth.getUserByEmail(email).catch(() => null);

  if (existing?.customClaims?.['revnaAdmin'] === true) {
    return new HttpsError(
      'already-exists',
      'Questa email è di un referente Revna: non può diventare un cliente.'
    );
  }

  return new HttpsError(
    'already-exists',
    'Esiste già un cliente con questa email. Per mandargli un nuovo link usa «Rimanda invito» ' +
      "dall'elenco dei clienti.",
    existing ? { uid: existing.uid } : undefined
  );
}

/**
 * Manda di nuovo il link di attivazione a un cliente che non è mai entrato.
 *
 * Il link nuovo spegne il precedente: è il motivo per cui serve, quando il primo
 * è scaduto o si è perso. Chi è già entrato almeno una volta ha una password, e
 * per lui la strada è «Password dimenticata?» nell'app.
 *
 * Non tocca Firestore: il profilo resta quello che c'è.
 */
export const resendInvite = onCall<{ uid: string }, Promise<Omit<Response, 'uid'>>>(
  { region: 'europe-west1', secrets: [resendApiKey] },
  async (request) => {
    requireAdmin(request);

    const uid = idDoc(request.data, 'uid');

    const target = await auth.getUser(uid).catch(() => null);
    if (!target?.email) {
      throw new HttpsError('not-found', 'Utente inesistente.');
    }
    if (target.customClaims?.['revnaAdmin'] === true) {
      throw new HttpsError('permission-denied', 'I referenti Revna non ricevono inviti da qui.');
    }
    if (target.disabled) {
      throw new HttpsError(
        'failed-precondition',
        "L'utenza è disattivata: riattivala prima di mandare un nuovo invito."
      );
    }
    if (target.metadata.lastSignInTime) {
      throw new HttpsError(
        'failed-precondition',
        "Il cliente ha già attivato l'accesso: se ha perso la password, può usare " +
          '«Password dimenticata?» nell\'app.'
      );
    }

    const snapshot = await db.collection('users').doc(uid).get();
    const nome = sanitizeProfile(snapshot.get('profile')).referente.nome;

    const activationUrl = await buildActivationUrl(target.email);
    const emailSent = await sendEmail({
      to: target.email,
      ...activationEmail(activationUrl, nome || target.displayName || undefined),
    });

    logger.info('Invito rimandato', { uid, emailSent });

    return { activationUrl, emailSent };
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
