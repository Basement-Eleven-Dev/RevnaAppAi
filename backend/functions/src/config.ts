import { defineString } from 'firebase-functions/params';

/**
 * Base delle pagine di atterraggio (hosting del backoffice).
 *
 * Sta qui e non in `invites.ts` perché serve a due padroni che non devono
 * conoscersi: il link di attivazione e l'URL del logo nelle email. Tenerlo
 * nell'uno costringerebbe l'altro a importarlo, e i due si importerebbero
 * a vicenda.
 */
export const appBaseUrl = defineString('APP_BASE_URL', {
  default: 'https://revnaappai.web.app',
});
