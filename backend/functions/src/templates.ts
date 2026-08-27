import { appBaseUrl } from './config';

/**
 * Le email che Revna manda ai clienti.
 *
 * Sono scritte in HTML da email, non in HTML da web: tabelle, stili in linea,
 * niente classi e niente CSS esterno. Outlook e Gmail buttano via quasi tutto
 * il resto, e queste due email sono l'unica cosa che il cliente vede di noi
 * prima di entrare nell'app — è la prima impressione, deve reggere ovunque.
 *
 * Regole che tornano in ogni pezzo qui sotto:
 * - il logo è un PNG servito dal nostro hosting (i client non renderizzano SVG)
 *   e ha il fondo già scuro come la fascia che lo ospita, così anche se il
 *   client sbaglia i colori non si vede un rettangolo bianco;
 * - se le immagini sono bloccate — succede spesso, di default — l'`alt` è
 *   stilato come il wordmark: resta un'intestazione leggibile, non un buco;
 * - sotto il bottone c'è sempre il link in chiaro, perché in qualche client il
 *   bottone non si vede o non si clicca.
 */

const BRAND = '#dd5237';
const INK = '#111111';
const MUTED = '#615a56';
const BORDER = '#e8e2de';
const PAGE = '#f4f1ef';

const FONT = "'Rethink Sans','Helvetica Neue',Helvetica,Arial,system-ui,-apple-system,'Segoe UI',sans-serif";

/** Il logo vive con il backoffice, sullo stesso hosting delle pagine di atterraggio. */
const logoUrl = () => `${appBaseUrl.value()}/brand/logo-email.png`;

type Layout = {
  /** Riga di anteprima nella lista dei messaggi, prima ancora di aprire. */
  preheader: string;
  hello: string;
  /** Paragrafi del corpo, già come testo semplice: l'HTML lo mettiamo noi. */
  body: string[];
  cta: { label: string; url: string };
  /** Chiusa in piccolo: cosa fare se questa email non te l'aspettavi. */
  footnote: string;
};

function html({ preheader, hello, body, cta, footnote }: Layout): string {
  const paragraphs = body
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK}">${line}</p>`
    )
    .join('');

  return `
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>Revna AI</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${preheader}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAGE}">
  <tr>
    <td align="center" style="padding:32px 16px">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px;background:#ffffff;border:1px solid ${BORDER};border-radius:16px;overflow:hidden">

        <tr>
          <td align="left" style="background:${INK};padding:24px 32px">
            <img src="${logoUrl()}" width="160" height="68" alt="Revna AI"
                 style="display:block;border:0;outline:none;text-decoration:none;width:160px;height:68px;color:#ffffff;font-family:${FONT};font-size:22px;font-weight:700;letter-spacing:-0.01em">
          </td>
        </tr>

        <tr>
          <td style="padding:32px 32px 8px;font-family:${FONT}">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK}">${hello}</p>
            ${paragraphs}

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 20px">
              <tr>
                <td align="center" bgcolor="${BRAND}" style="border-radius:10px">
                  <a href="${cta.url}"
                     style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px">${cta.label}</a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${MUTED}">Se il bottone non funziona, copia questo indirizzo nel browser:</p>
            <p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all">
              <a href="${cta.url}" style="color:${BRAND};text-decoration:underline">${cta.url}</a>
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:0 32px 28px;font-family:${FONT}">
            <div style="border-top:1px solid ${BORDER};padding-top:20px">
              <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED}">${footnote}</p>
            </div>
          </td>
        </tr>

      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px">
        <tr>
          <td align="center" style="padding:20px 8px 0;font-family:${FONT}">
            <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED}">
              Revna &middot; <a href="https://revna.it" style="color:${MUTED};text-decoration:underline">revna.it</a><br>
              Messaggio automatico legato al tuo accesso a Revna AI.
            </p>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
</body>
</html>`.trim();
}

/**
 * Stessa email, per chi legge in testo semplice o per i filtri che lo pesano.
 * I paragrafi arrivano con qualche tag dentro (un `<strong>`, non di più):
 * qui vanno tolti, non resi.
 */
function text({ hello, body, cta, footnote }: Layout): string {
  const plain = (line: string) => line.replace(/<[^>]+>/g, '');

  return [
    'REVNA AI',
    '',
    hello,
    '',
    ...body.flatMap((line) => [plain(line), '']),
    `${cta.label}:`,
    cta.url,
    '',
    footnote,
    '',
    '—',
    'Revna · revna.it',
    'Messaggio automatico legato al tuo accesso a Revna AI.',
  ].join('\n');
}

function render(subject: string, layout: Layout) {
  return { subject, html: html(layout), text: text(layout) };
}

/** Email di attivazione: la prima cosa che il cliente riceve da noi. */
export function activationEmail(activationUrl: string, displayName?: string) {
  return render('Il tuo accesso a Revna AI', {
    preheader: 'Attiva il tuo accesso e scegli la password.',
    hello: displayName ? `Ciao ${displayName},` : 'Ciao,',
    body: [
      'Revna ha attivato il tuo accesso a <strong>Revna AI</strong>, l\'assistente che risponde alle domande sulla tua struttura.',
      'Apri questo link dal telefono per scegliere la tua password ed entrare nell\'app.',
    ],
    cta: { label: 'Attiva il mio accesso', url: activationUrl },
    footnote: 'Se non ti aspettavi questa email, puoi ignorarla.',
  });
}

/**
 * Email di recupero password.
 *
 * Differenza che conta rispetto all'attivazione: qui la chiusa non dice solo
 * «ignorala». Se la richiesta non è partita dal cliente, qualcuno sta provando
 * a entrare al posto suo, e deve poterlo capire da quello che legge.
 */
export function passwordResetEmail(resetUrl: string, displayName?: string) {
  return render('Reimposta la password di Revna AI', {
    preheader: 'Il link per scegliere una nuova password.',
    hello: displayName ? `Ciao ${displayName},` : 'Ciao,',
    body: [
      'Hai chiesto di reimpostare la password del tuo accesso a <strong>Revna AI</strong>.',
      'Apri questo link dal telefono per sceglierne una nuova. Vale una volta sola.',
    ],
    cta: { label: 'Scegli una nuova password', url: resetUrl },
    footnote:
      'Se non l\'hai chiesto tu, ignora questa email: la tua password resta quella di prima. Se ti succede spesso, scrivi al tuo referente Revna.',
  });
}
