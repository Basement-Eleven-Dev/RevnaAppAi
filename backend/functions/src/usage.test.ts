import assert from 'node:assert/strict';
import { test } from 'node:test';

import { consume, LIMITE_GIORNO, LIMITE_MINUTO, type Usage } from './usage';

const at = (iso: string) => new Date(iso);

/** Il contatore dopo `n` messaggi a quell'ora, partendo da zero. */
function dopo(n: number, now: Date): Usage {
  let usage: Usage | undefined;
  for (let i = 0; i < n; i++) {
    const result = consume(usage, now);
    assert.ok('usage' in result, `messaggio ${i + 1} rifiutato`);
    usage = result.usage;
  }
  return usage!;
}

test('primo messaggio: contatore a uno', () => {
  const result = consume(undefined, at('2026-10-01T10:15:30Z'));
  assert.deepEqual(result, {
    usage: { minuto: '2026-10-01T10:15', nelMinuto: 1, giorno: '2026-10-01', nelGiorno: 1 },
  });
});

test('oltre il limite al minuto: rifiutato, il minuto dopo riparte', () => {
  const now = at('2026-10-01T10:15:00Z');
  const pieno = dopo(LIMITE_MINUTO, now);
  assert.deepEqual(consume(pieno, at('2026-10-01T10:15:59Z')), { superato: 'minuto' });

  const result = consume(pieno, at('2026-10-01T10:16:00Z'));
  assert.ok('usage' in result);
  assert.equal(result.usage.nelMinuto, 1);
  assert.equal(result.usage.nelGiorno, LIMITE_MINUTO + 1);
});

test('oltre il limite del giorno: rifiutato fino alla mezzanotte italiana', () => {
  const pieno: Usage = {
    minuto: '2026-10-01T20:00',
    nelMinuto: 1,
    giorno: '2026-10-01',
    nelGiorno: LIMITE_GIORNO,
  };
  // 21:59 UTC = 23:59 a Roma (ora legale): ancora lo stesso giorno.
  assert.deepEqual(consume(pieno, at('2026-10-01T21:59:00Z')), { superato: 'giorno' });

  // 22:00 UTC = mezzanotte a Roma: giorno nuovo, anche se in UTC è ancora il 1°.
  const result = consume(pieno, at('2026-10-01T22:00:00Z'));
  assert.ok('usage' in result);
  assert.equal(result.usage.giorno, '2026-10-02');
  assert.equal(result.usage.nelGiorno, 1);
});

test('contatore rovinato: riparte da zero', () => {
  const result = consume({ minuto: 'x' } as Partial<Usage>, at('2026-10-01T10:15:00Z'));
  assert.ok('usage' in result);
  assert.equal(result.usage.nelMinuto, 1);
  assert.equal(result.usage.nelGiorno, 1);
});
