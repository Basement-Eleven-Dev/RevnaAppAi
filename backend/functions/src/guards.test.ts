import assert from 'node:assert/strict';
import { test } from 'node:test';

import { idDoc, idDocFacoltativo, stringa } from './guards';

const rifiutato = { code: 'invalid-argument' };

test('stringa: testo ripulito, assente vale vuoto', () => {
  assert.equal(stringa({ testo: '  ciao  ' }, 'testo'), 'ciao');
  assert.equal(stringa({}, 'testo'), '');
  assert.equal(stringa({ testo: null }, 'testo'), '');
  assert.equal(stringa(null, 'testo'), '');
  assert.equal(stringa('non un oggetto', 'testo'), '');
});

test('stringa: un tipo diverso è invalid-argument', () => {
  assert.throws(() => stringa({ testo: 42 }, 'testo'), rifiutato);
  assert.throws(() => stringa({ testo: ['a'] }, 'testo'), rifiutato);
  assert.throws(() => stringa({ testo: { a: 1 } }, 'testo'), rifiutato);
});

test('idDocFacoltativo: assente o vuoto è undefined', () => {
  assert.equal(idDocFacoltativo({}, 'id'), undefined);
  assert.equal(idDocFacoltativo({ id: '' }, 'id'), undefined);
  assert.equal(idDocFacoltativo(undefined, 'id'), undefined);
  assert.equal(idDocFacoltativo({ id: 'abc123' }, 'id'), 'abc123');
});

test('idDocFacoltativo: tipi sbagliati e percorsi rifiutati', () => {
  for (const id of [7, true, {}, 'a/b', '../x', '.', '..']) {
    assert.throws(() => idDocFacoltativo({ id }, 'id'), rifiutato, String(id));
  }
});

test('idDoc: obbligatorio', () => {
  assert.equal(idDoc({ id: 'abc' }, 'id'), 'abc');
  assert.throws(() => idDoc({}, 'id'), rifiutato);
  assert.throws(() => idDoc({ id: '' }, 'id'), rifiutato);
  assert.throws(() => idDoc({ id: 'a/b' }, 'id'), rifiutato);
});
