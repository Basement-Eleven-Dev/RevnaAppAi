import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_STORED_BYTES,
  MAX_STORED_TURNS,
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
