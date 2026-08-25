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
