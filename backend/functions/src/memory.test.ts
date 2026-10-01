import assert from 'node:assert/strict';
import { test } from 'node:test';

import { overflow, type MemoryEntry } from './memory';

/** `n` righe, la `i`-esima aggiornata il giorno `i` di gennaio. */
function righe(n: number): MemoryEntry[] {
  return Array.from({ length: n }, (_, i) => {
    const at = new Date(Date.UTC(2026, 0, i + 1)).toISOString();
    return { id: `r${i + 1}`, testo: `Preferenza ${i + 1}`, at, updatedAt: at, origine: 'assistente' };
  });
}

const nessuna = () => ({ touched: new Set<string>(), removed: new Set<string>(), added: 0 });

test('sotto il limite non esce niente', () => {
  assert.deepEqual(overflow(righe(24), { ...nessuna(), added: 1 }), []);
});

test('memoria piena e una riga nuova: esce quella aggiornata da più tempo', () => {
  const ids = overflow(righe(25), { ...nessuna(), added: 1 }).map((entry) => entry.id);
  assert.deepEqual(ids, ['r1']);
});

test('una riga riconfermata di recente resta anche se è la più vecchia', () => {
  const current = righe(25);
  current[0] = { ...current[0], updatedAt: '2026-09-01T00:00:00.000Z' };
  const ids = overflow(current, { ...nessuna(), added: 1 }).map((entry) => entry.id);
  assert.deepEqual(ids, ['r2']);
});

test('il conto è sul totale reale: oltre il limite escono tutte le eccedenti', () => {
  const ids = overflow(righe(27), { ...nessuna(), added: 1 }).map((entry) => entry.id);
  assert.deepEqual(ids, ['r1', 'r2', 'r3']);
});

test('le righe toccate nel turno non escono, quelle dimenticate liberano posto', () => {
  const touched = new Set(['r1', 'r2']);
  const removed = new Set(['r2']);
  assert.deepEqual(overflow(righe(25), { touched, removed, added: 1 }), []);

  const ids = overflow(righe(25), { touched: new Set(['r1']), removed: new Set(), added: 2 });
  assert.deepEqual(ids.map((entry) => entry.id), ['r2', 'r3']);
});
