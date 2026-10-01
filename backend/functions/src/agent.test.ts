import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  extractContactProposal,
  FULL_CONTEXT_BUDGET_CHARS,
  resolveCitations,
  selectKnowledge,
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

test('la proposta di contatto perde anche le citazioni a tre cifre', () => {
  const { text, proposal } = extractContactProposal(
    'Serve un consulente [104].\n<<<CONTATTO: Vorrei un parere [104] sul contratto [7] >>>',
  );

  assert.equal(text, 'Serve un consulente [104].');
  assert.equal(proposal, 'Vorrei un parere sul contratto');
});
