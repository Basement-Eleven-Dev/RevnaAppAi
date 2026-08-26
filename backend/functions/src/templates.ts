const BRAND = '#DD5237';

/** Email di attivazione. Volutamente sobria: il template definitivo seguirà il brand book. */
export function activationEmail(activationUrl: string, displayName?: string) {
  const hello = displayName ? `Ciao ${displayName},` : 'Ciao,';

  const text = [
    hello,
    '',
    'Revna ha attivato il tuo accesso all\'assistente Revna AI.',
    'Apri questo link dal telefono per scegliere la tua password ed entrare:',
    '',
    activationUrl,
    '',
    'Se non ti aspettavi questa email, puoi ignorarla.',
  ].join('\n');

  const html = `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.6;color:#111;max-width:520px">
  <p>${hello}</p>
  <p>Revna ha attivato il tuo accesso all'assistente <strong>Revna AI</strong>.</p>
  <p>Apri questo link dal telefono per scegliere la tua password ed entrare:</p>
  <p style="margin:28px 0">
    <a href="${activationUrl}"
       style="background:${BRAND};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">
      Attiva il mio accesso
    </a>
  </p>
  <p style="color:#615a56;font-size:14px">Se non ti aspettavi questa email, puoi ignorarla.</p>
</div>`.trim();

  return { subject: 'Il tuo accesso a Revna AI', html, text };
}


/**
 * Email di recupero password. Stessa sobrietà di quella di attivazione, con una
 * differenza che conta: qui aggiungiamo cosa fare se la richiesta non è partita
 * dal cliente. In un'email di attivazione «ignorala» basta, in una di recupero no
 * — se qualcun altro sta provando a entrare, il cliente deve saperlo.
 */
export function passwordResetEmail(resetUrl: string, displayName?: string) {
  const hello = displayName ? `Ciao ${displayName},` : 'Ciao,';

  const text = [
    hello,
    '',
    'Hai chiesto di reimpostare la password del tuo accesso a Revna AI.',
    'Apri questo link dal telefono per sceglierne una nuova:',
    '',
    resetUrl,
    '',
    'Il link vale una volta sola. Se non l\'hai chiesto tu, ignora questa email:',
    'la tua password resta quella di prima. Se ti succede spesso, scrivi al tuo referente Revna.',
  ].join('\n');

  const html = `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.6;color:#111;max-width:520px">
  <p>${hello}</p>
  <p>Hai chiesto di reimpostare la password del tuo accesso a <strong>Revna AI</strong>.</p>
  <p>Apri questo link dal telefono per sceglierne una nuova:</p>
  <p style="margin:28px 0">
    <a href="${resetUrl}"
       style="background:${BRAND};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">
      Scegli una nuova password
    </a>
  </p>
  <p style="color:#615a56;font-size:14px">
    Il link vale una volta sola. Se non l'hai chiesto tu, ignora questa email: la tua
    password resta quella di prima. Se ti succede spesso, scrivi al tuo referente Revna.
  </p>
</div>`.trim();

  return { subject: 'Reimposta la password di Revna AI', html, text };
}
