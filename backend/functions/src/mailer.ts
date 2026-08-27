import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';
import { Resend } from 'resend';

/**
 * Invio email tramite Resend.
 *
 * La chiave sta in Secret Manager:
 *   firebase functions:secrets:set RESEND_API_KEY
 *
 * Finché la chiave è il placeholder, l'invio viene saltato senza errori: il
 * backoffice mostra comunque il link di attivazione da consegnare a mano.
 */
export const resendApiKey = defineSecret('RESEND_API_KEY');

/**
 * Mittente. Il dominio dev'essere verificato su Resend, altrimenti l'invio
 * viene rifiutato: `revna.it` lo è.
 */
export const mailFrom = defineString('MAIL_FROM', {
  default: 'Revna AI <noreply@revna.it>',
});

/**
 * Casella dove finiscono le risposte.
 *
 * `noreply@` dice al cliente di non rispondere, ma qualcuno risponde lo stesso:
 * senza questo, quelle risposte cadrebbero nel vuoto senza che nessuno in Revna
 * lo sappia. Vuoto per disattivarlo.
 */
export const mailReplyTo = defineString('MAIL_REPLY_TO', { default: '' });

const PLACEHOLDER = 'PLACEHOLDER';

export function isMailerConfigured(): boolean {
  const key = resendApiKey.value();
  return key.length > 0 && key !== PLACEHOLDER;
}

type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/** Restituisce true se l'email è partita davvero. */
export async function sendEmail(email: Email): Promise<boolean> {
  if (!isMailerConfigured()) {
    logger.warn('RESEND_API_KEY non configurata: invio saltato', { to: email.to });
    return false;
  }

  const replyTo = mailReplyTo.value().trim();

  const { error } = await new Resend(resendApiKey.value()).emails.send({
    from: mailFrom.value(),
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    ...(replyTo ? { replyTo } : {}),
  });

  if (error) {
    logger.error('Invio email fallito', { to: email.to, error });
    return false;
  }

  logger.info('Email inviata', { to: email.to });
  return true;
}
