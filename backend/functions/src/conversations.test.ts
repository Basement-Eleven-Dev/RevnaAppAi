import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_STORED_BYTES,
  MAX_STORED_TURNS,
  settleProposal,
  trimHistory,
  type StoredTurn,
} from './conversations';

const pair = (text: string): StoredTurn[] => [
  { role: 'user', text },
  { role: 'model', text },
];

const bytes = (turns: StoredTurn[]) => Buffer.byteLength(JSON.stringify(turns), 'utf8');

test('uno storico corto resta com’è', () => {
  const turns = [...pair('a'), ...pair('b')];
  assert.deepEqual(trimHistory(turns), turns);
});

test('oltre il numero massimo di turni cadono i più vecchi', () => {
  const turns = Array.from({ length: MAX_STORED_TURNS / 2 + 5 }, (_, i) => pair(`t${i}`)).flat();
  const kept = trimHistory(turns);

  assert.equal(kept.length, MAX_STORED_TURNS);
  assert.deepEqual(kept.at(-1), turns.at(-1));
});

test('oltre il peso massimo cadono i più vecchi, e lo storico resta sotto la soglia', () => {
  // Accenti e emoji: la soglia è in byte, non in caratteri.
  const lungo = 'è🙂'.repeat(4000);
  const turns = Array.from({ length: 40 }, () => pair(lungo)).flat();
  assert.ok(bytes(turns) > MAX_STORED_BYTES);

  const kept = trimHistory(turns);

  assert.ok(bytes(kept) <= MAX_STORED_BYTES);
  assert.ok(kept.length < turns.length);
  assert.deepEqual(kept.at(-1), turns.at(-1));
});

test('lo storico non comincia mai con una risposta', () => {
  const turns: StoredTurn[] = [{ role: 'model', text: 'orfana' }, ...pair('a')];
  assert.deepEqual(trimHistory(turns), pair('a'));

  // Anche quando il taglio per peso cade fra una domanda e la sua risposta.
  const lungo = 'x'.repeat(MAX_STORED_BYTES / 3);
  const pesanti: StoredTurn[] = [
    { role: 'user', text: 'breve' },
    { role: 'model', text: lungo },
    ...pair(lungo),
  ];
  const kept = trimHistory(pesanti);
  assert.equal(kept[0].role, 'user');
  assert.ok(bytes(kept) <= MAX_STORED_BYTES);
});

const withProposal = (proposalStato?: StoredTurn['proposalStato']): StoredTurn[] => [
  { role: 'user', text: 'domanda', at: 't1' },
  {
    role: 'model',
    text: 'risposta',
    at: 't1',
    proposal: 'Richiamatemi',
    ...(proposalStato ? { proposalStato } : {}),
  },
];

test('la proposta si segna sul turno del modello con quell’ora', () => {
  const settled = settleProposal(withProposal(), 't1', 'inviata');

  assert.ok('messages' in settled);
  assert.equal(settled.messages[1].proposalStato, 'inviata');
  assert.equal(settled.messages[0].proposalStato, undefined);
});

test('una proposta inviata non si invia né si scarta una seconda volta', () => {
  assert.deepEqual(settleProposal(withProposal('inviata'), 't1', 'inviata'), { error: 'inviata' });
  assert.deepEqual(settleProposal(withProposal('inviata'), 't1', 'scartata'), { error: 'inviata' });
});

test('una proposta scartata si può ancora inviare', () => {
  const settled = settleProposal(withProposal('scartata'), 't1', 'inviata');
  assert.ok('messages' in settled);
  assert.equal(settled.messages[1].proposalStato, 'inviata');
});

test('un turno che non c’è o non propone niente è assente', () => {
  assert.deepEqual(settleProposal(withProposal(), 't2', 'inviata'), { error: 'assente' });
  assert.deepEqual(settleProposal(pair('x'), 't1', 'scartata'), { error: 'assente' });
});
