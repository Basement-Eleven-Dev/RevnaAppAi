import assert from 'node:assert/strict';
import { test } from 'node:test';

import { activationEmail, escapeHtml, passwordResetEmail } from './templates';

const NOME = 'Anna & Marco <srl>';
const URL = 'https://revnaappai.web.app/attiva?oobCode=abc&lang=it';

test('escapeHtml: i caratteri che aprono markup diventano entità', () => {
  assert.equal(
    escapeHtml(`<a href="x" title='y'>A & B</a>`),
    '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;A &amp; B&lt;/a&gt;'
  );
});

test('attivazione: il nome entra nell\'HTML con escape e nel testo così com\'è', () => {
  const email = activationEmail(URL, NOME);
  assert.ok(email.html.includes('Ciao Anna &amp; Marco &lt;srl&gt;,'));
  assert.ok(!email.html.includes('<srl>'));
  assert.ok(email.text.includes(`Ciao ${NOME},`));
});

test('recupero password: il nome entra nell\'HTML con escape', () => {
  const email = passwordResetEmail(URL, '<a href="https://evil.example">Clicca</a>');
  assert.ok(!email.html.includes('<a href="https://evil.example">'));
  assert.ok(email.html.includes('&lt;a href=&quot;https://evil.example&quot;&gt;'));
});

test('il link resta valido negli attributi e il grassetto del corpo resta grassetto', () => {
  const email = activationEmail(URL);
  assert.ok(email.html.includes('href="https://revnaappai.web.app/attiva?oobCode=abc&amp;lang=it"'));
  assert.ok(email.html.includes('<strong>Revna AI</strong>'));
  assert.ok(email.text.includes(URL));
});
