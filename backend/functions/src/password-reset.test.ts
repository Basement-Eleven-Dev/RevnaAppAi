import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ATTESE_MS, type Freno, INVII_GIORNO, prossimoInvio } from './password-reset';

const at = (iso: string) => new Date(iso);
const dopo = (now: Date, ms: number) => new Date(now.getTime() + ms);

test('primo invio: passa e conta uno', () => {
  assert.deepEqual(prossimoInvio(undefined, at('2026-10-02T08:00:00Z')), {
    giorno: '2026-10-02',
    invii: 1,
    ultimoAt: '2026-10-02T08:00:00.000Z',
  });
});

test("l'attesa cresce a ogni invio, poi il tetto chiude la giornata", () => {
  let now = at('2026-10-02T06:00:00Z');
  let freno = prossimoInvio(undefined, now);

  for (const attesa of ATTESE_MS) {
    assert.ok(freno);
    assert.equal(prossimoInvio(freno, dopo(now, attesa - 1)), null);
    now = dopo(now, attesa);
    freno = prossimoInvio(freno, now);
  }

  assert.ok(freno);
  assert.equal(freno.invii, INVII_GIORNO);
  assert.equal(prossimoInvio(freno, dopo(now, 6 * 60 * 60_000)), null);
});

test('giorno nuovo a mezzanotte italiana: conteggio da capo, un minuto comunque', () => {
  const pieno: Freno = {
    giorno: '2026-10-02',
    invii: INVII_GIORNO,
    ultimoAt: '2026-10-02T21:59:30.000Z',
  };
  // 22:00 UTC = mezzanotte a Roma (ora legale).
  assert.equal(prossimoInvio(pieno, at('2026-10-02T22:00:00Z')), null);

  const freno = prossimoInvio(pieno, at('2026-10-02T22:00:30Z'));
  assert.ok(freno);
  assert.equal(freno.giorno, '2026-10-03');
  assert.equal(freno.invii, 1);
});

test('freno illeggibile o nel formato vecchio: passa', () => {
  const now = at('2026-10-02T08:00:00Z');
  assert.ok(prossimoInvio({ ultimoAt: 'x' } as Partial<Freno>, now));
  assert.ok(prossimoInvio({ lastRequestedAt: now.toISOString() } as Partial<Freno>, now));
});
