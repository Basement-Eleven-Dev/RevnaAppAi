import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  extractContactProposal,
  FULL_CONTEXT_BUDGET_CHARS,
  resolveCitations,
  selectKnowledge,
  visibleSoFar,
  type KnowledgeEntry,
} from './agent';

const entry = (id: string, chars: number, titolo = id): KnowledgeEntry => ({
  id,
  titolo,
  tipo: 'metodo',
  tags: [],
  contenuto: 'x'.repeat(chars),
  attivo: true,
});

const total = (entries: KnowledgeEntry[]) =>
  entries.reduce((sum, item) => sum + item.contenuto.length, 0);

const fails = () => Promise.reject(new Error('modello giù'));

test('sotto il budget entra tutto, senza chiamare il modello', async () => {
  const entries = [entry('a', 1000), entry('b', 2000)];
  const selected = await selectKnowledge('domanda', entries, () => {
    throw new Error('non doveva essere chiamato');
  });
  assert.deepEqual(selected, entries);
});

test('le voci scelte dal modello stanno nel budget, nell’ordine scelto', async () => {
  const third = FULL_CONTEXT_BUDGET_CHARS / 3;
  const entries = [entry('a', third), entry('b', third), entry('c', third), entry('d', 1000)];

  const selected = await selectKnowledge('domanda', entries, async () => '3, 1, 2, 4');

  assert.deepEqual(
    selected.map((item) => item.id),
    ['c', 'a', 'b'],
  );
  assert.ok(total(selected) <= FULL_CONTEXT_BUDGET_CHARS);
});

test('una voce che non ci sta viene saltata, non ferma le successive', async () => {
  const entries = [
    entry('a', FULL_CONTEXT_BUDGET_CHARS - 5000),
    entry('b', 10_000),
    entry('c', 3000),
  ];

  const selected = await selectKnowledge('domanda', entries, async () => '1, 2, 3');

  assert.deepEqual(
    selected.map((item) => item.id),
    ['a', 'c'],
  );
});

test('la voce più pertinente, se da sola supera il budget, entra troncata con avviso', async () => {
  const entries = [entry('a', 500_000), entry('b', 1000)];

  const selected = await selectKnowledge('domanda', entries, async () => '1, 2');

  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, 'a');
  assert.ok(selected[0].contenuto.length <= FULL_CONTEXT_BUDGET_CHARS);
  assert.match(selected[0].contenuto, /\[Testo troncato:/);
  assert.equal(entries[0].contenuto.length, 500_000);
});

test('il ripiego per parole chiave rispetta lo stesso budget', async () => {
  const entries = Array.from({ length: 10 }, (_, i) =>
    entry(`v${i}`, FULL_CONTEXT_BUDGET_CHARS / 4, `Tariffe ${i}`),
  );

  const withWords = await selectKnowledge('come imposto le tariffe', entries, fails);
  assert.equal(withWords.length, 4);
  assert.ok(total(withWords) <= FULL_CONTEXT_BUDGET_CHARS);

  // Nessuna parola di almeno quattro lettere: si prendono le prime, sempre nel budget.
  const withoutWords = await selectKnowledge('e io?', entries, fails);
  assert.equal(withoutWords.length, 4);
  assert.ok(total(withoutWords) <= FULL_CONTEXT_BUDGET_CHARS);
});

test('le citazioni a tre cifre vengono rinumerate come quelle a una', () => {
  const selected = Array.from({ length: 150 }, (_, i) => entry(`v${i + 1}`, 10, `Voce ${i + 1}`));

  const { text, sources } = resolveCitations(
    'Alza le tariffe [123]. Riduci le OTA [7] [123]. Inventato [999].',
    selected,
  );

  assert.equal(text, 'Alza le tariffe [1]. Riduci le OTA [2] [1]. Inventato.');
  assert.deepEqual(sources, [
    { n: 1, titolo: 'Voce 123' },
    { n: 2, titolo: 'Voce 7' },
  ]);
});

test('gli elenchi annidati tengono il rientro', () => {
  const selected = [entry('a', 10, 'Tariffe')];
  const answer = [
    '- Leve principali [1]',
    '  - tariffe del weekend [4]',
    '    - minimo due notti  in alta stagione',
    '  - restrizioni',
  ].join('\n');

  const { text } = resolveCitations(answer, selected);

  assert.equal(
    text,
    [
      '- Leve principali [1]',
      '  - tariffe del weekend',
      '    - minimo due notti  in alta stagione',
      '  - restrizioni',
    ].join('\n'),
  );
});

test('il codice resta com’è, anche quando contiene numeri fra quadre', () => {
  const selected = [entry('a', 10, 'Tariffe')];
  const answer = [
    'Usa la formula [1]:',
    '```',
    'adr = ricavi[2] / notti[3]',
    '    if adr  > 100:',
    '```',
    'e la cella `B[5]` del foglio.',
  ].join('\n');

  const { text, sources } = resolveCitations(answer, selected);

  assert.equal(text, answer);
  assert.deepEqual(sources, [{ n: 1, titolo: 'Tariffe' }]);
});

test('le tabelle tengono gli spazi di allineamento', () => {
  const selected = [entry('a', 10, 'ADR'), entry('b', 10, 'RevPAR')];
  const answer = [
    '| Mese    | ADR   |',
    '|---------|-------|',
    '| Agosto  | 140 [2] |',
    '| Ottobre |  95 [9] |',
  ].join('\n');

  const { text, sources } = resolveCitations(answer, selected);

  assert.equal(
    text,
    [
      '| Mese    | ADR   |',
      '|---------|-------|',
      '| Agosto  | 140 [1] |',
      '| Ottobre |  95 |',
    ].join('\n'),
  );
  assert.deepEqual(sources, [{ n: 1, titolo: 'RevPAR' }]);
});

test('un marcatore tolto in mezzo alla frase porta via un solo spazio', () => {
  const { text } = resolveCitations('Alza [8] le tariffe [1] [9], poi\n  - rivedi [8]', [
    entry('a', 10),
  ]);
  assert.equal(text, 'Alza le tariffe [1], poi\n  - rivedi');
});

test('la proposta di contatto perde anche le citazioni a tre cifre', () => {
  const { text, proposal } = extractContactProposal(
    'Serve un consulente [104].\n<<<CONTATTO: Vorrei un parere [104] sul contratto [7] >>>',
  );

  assert.equal(text, 'Serve un consulente [104].');
  assert.equal(proposal, 'Vorrei un parere sul contratto');
});

test('il marcatore si riconosce con spazi e maiuscole diverse', () => {
  for (const marker of ['<<<CONTATTO:', '<<< contatto :', '<<<Contatto', '<<<CONTACT:']) {
    const { text, proposal } = extractContactProposal(
      `Non è il mio campo.\n${marker} Vorrei un consulente. >>>`,
    );
    assert.equal(text, 'Non è il mio campo.', marker);
    assert.equal(proposal, 'Vorrei un consulente.', marker);
  }
});

test('con più marcatori vale la prima proposta e vanno via tutti', () => {
  const { text, proposal } = extractContactProposal(
    'Prima.\n<<<CONTATTO: Uno >>>\nIn mezzo.\n<<<CONTATTO: Due >>>',
  );

  assert.equal(text, 'Prima.\n\nIn mezzo.');
  assert.equal(proposal, 'Uno');
});

test('il marcatore troncato vale come chiuso', () => {
  const { text, proposal } = extractContactProposal(
    'Ti faccio richiamare.\n<<<CONTATTO: Vorrei un parere sul',
  );

  assert.equal(text, 'Ti faccio richiamare.');
  assert.equal(proposal, 'Vorrei un parere sul');
});

test('una risposta fatta solo di marcatore lascia il testo vuoto', () => {
  assert.deepEqual(extractContactProposal('<<<CONTATTO: Richiamatemi >>>'), {
    text: '',
    proposal: 'Richiamatemi',
  });
});

test('un blocco <<< che non è una proposta sparisce senza proporre niente', () => {
  assert.deepEqual(extractContactProposal('Risposta. <<<qualcosa>>>'), { text: 'Risposta.' });
});

test('la proposta non tiene lo spazio lasciato da una citazione prima del punto', () => {
  const { proposal } = extractContactProposal(
    'Ok.\n<<<CONTATTO: «Vorrei rivedere il contratto [3].» >>>',
  );
  assert.equal(proposal, 'Vorrei rivedere il contratto.');
});

test('in streaming il marcatore non esce nemmeno spezzato fra due pezzi', () => {
  assert.equal(visibleSoFar('Risposta.'), 'Risposta.');
  assert.equal(visibleSoFar('Risposta.\n<'), 'Risposta.\n');
  assert.equal(visibleSoFar('Risposta.\n<<'), 'Risposta.\n');
  assert.equal(visibleSoFar('Risposta.\n<<<CONT'), 'Risposta.\n');
  assert.equal(visibleSoFar('Risposta.\n<<<CONTATTO: x >>> dopo'), 'Risposta.\n');
  assert.equal(visibleSoFar('a < b'), 'a < b');
});
