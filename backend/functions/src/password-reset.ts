import { setTimeout as pausa } from 'node:timers/promises';

import { Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { auth, db } from './admin';
import { stringa } from './guards';
import { buildActivationUrl } from './invites';
import { resendApiKey, sendEmail } from './mailer';
import { passwordResetEmail } from './templates';
import { giornoItaliano } from './usage';

/**
 * Recupero password richiesto dal cliente dall'app.
 *
 * Non usiamo `sendPasswordResetEmail` lato client: manderebbe il cliente sulla
 * pagina di reset di Firebase. Qui la password si sceglie dentro l'app, come per
 * l'attivazione, quindi ricicliamo lo stesso percorso — `buildActivationUrl` con
 * `reset`, email nostra, atterraggio su `/attiva`.
 *
 * Chiamabile senza autenticazione, per forza di cose: chi ha perso la password
 * non è dentro. Da questo discendono le cautele qui sotto — la risposta cieca,
 * anche nei tempi, e il freno sugli invii per la stessa email.
 */

/**
 * Durata minima di ogni risposta. Deve stare sopra il tempo di un invio vero (link
 * più Resend), così un'email sconosciuta, che non fa niente, non risponde prima.
 *
 * Il lavoro si finisce prima di rispondere e non dopo: su Cloud Functions quello che
 * resta in corso dopo la risposta non ha garanzia di essere eseguito.
 */
const TEMPO_MINIMO_MS = 2_500;

/** Attesa dopo il primo, il secondo, il terzo e il quarto invio della giornata. */
export const ATTESE_MS = [1, 5, 15, 60].map((minuti) => minuti * 60_000);

/** Invii al giorno per la stessa email. */
export const INVII_GIORNO = ATTESE_MS.length + 1;

/** Per quanto il freno resta in `passwordResets` dopo l'ultimo invio, prima del TTL. */
const DURATA_FRENO_MS = 24 * 60 * 60_000;

/** Il freno di un'email, in `passwordResets/{email}`. */
export type Freno = {
  giorno: string;
  invii: number;
  ultimoAt: string;
};

type Request = { email?: string };
type Response = { ok: true };

export const requestPasswordReset = onCall<Request, Promise<Response>>(
  { region: 'europe-west1', secrets: [resendApiKey] },
  async (request) => {
    const email = stringa(request.data, 'email').toLowerCase();

    if (!email || !email.includes('@')) {
      throw new HttpsError('invalid-argument', 'Email mancante o non valida.');
    }

    // La risposta è la stessa in ogni caso: email sconosciuta, invio frenato,
    // invio riuscito. Da fuori non si deve poter distinguere, altrimenti questa
    // function diventa un modo per sapere chi è cliente Revna e chi no. Gli
    // errori veri restano nei log, dove li vede solo chi ha diritto di vederli.
    await Promise.all([
      sendResetLink(email).catch((cause) =>
        logger.warn('Recupero password non completato', { email, cause })
      ),
      pausa(TEMPO_MINIMO_MS),
    ]);

    return { ok: true };
  }
);

async function sendResetLink(email: string): Promise<void> {
  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) return;

  if (!(await claimAttempt(email))) {
    logger.info('Recupero password frenato', { uid: user.uid });
    return;
  }

  const resetUrl = await buildActivationUrl(email, true);
  const sent = await sendEmail({
    to: email,
    ...passwordResetEmail(resetUrl, user.displayName ?? undefined),
  });

  logger.info('Recupero password inviato', { uid: user.uid, sent });
}

/**
 * Il freno dopo un invio in più, o `null` se adesso non si può mandare.
 *
 * Serve perché la function è aperta: senza, chiunque conosca l'indirizzo di un
 * cliente può riempirgli la casella e — peggio — invalidargli in continuazione
 * il codice appena ricevuto, dato che ogni nuovo `oobCode` spegne il precedente.
 * L'attesa cresce a ogni invio e il tetto chiude la giornata: arrivati lì, l'ultimo
 * codice mandato resta valido.
 *
 * Al cambio di giorno il conteggio riparte, ma un minuto dall'ultimo invio si
 * aspetta comunque. Un freno illeggibile non ferma nessuno.
 */
export function prossimoInvio(stored: Partial<Freno> | undefined, now: Date): Freno | null {
  const giorno = giornoItaliano.format(now);
  const invii = stored?.giorno === giorno ? (stored.invii ?? 0) : 0;

  if (invii >= INVII_GIORNO) return null;

  const attesa = ATTESE_MS[Math.max(invii, 1) - 1];
  if (now.getTime() - Date.parse(stored?.ultimoAt ?? '') < attesa) return null;

  return { giorno, invii: invii + 1, ultimoAt: now.toISOString() };
}

/**
 * Registra l'invio e dice se si può procedere.
 *
 * Una transazione e non una lettura seguita da una scrittura: due richieste
 * arrivate insieme leggerebbero entrambe lo stesso freno e passerebbero tutte e due.
 * `scadeAt` è un Timestamp perché è il campo su cui lavora il TTL di Firestore.
 */
async function claimAttempt(email: string): Promise<boolean> {
  const ref = db.collection('passwordResets').doc(encodeURIComponent(email));

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const now = new Date();
    const freno = prossimoInvio(snapshot.data() as Partial<Freno> | undefined, now);

    if (!freno) return false;

    tx.set(ref, {
      email,
      ...freno,
      scadeAt: Timestamp.fromMillis(now.getTime() + DURATA_FRENO_MS),
    });
    return true;
  });
}
