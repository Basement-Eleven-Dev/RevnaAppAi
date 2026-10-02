import assert from 'node:assert/strict';
import { test } from 'node:test';

import { screenTokens } from './push';

const entry = (token: string, uid = 'a', updatedAt = '2026-10-01T10:00:00.000Z', id = token) => ({
  token: { id, uid, token, updatedAt },
  badge: 0,
});

const ids = (entries: { token: { id: string } }[]) => entries.map((e) => e.token.id);

test('token Expo nelle due forme: passano', () => {
  const { tokens, discarded } = screenTokens([
    entry('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'),
    entry('ExpoPushToken[yyyyyyyyyyyyyyyyyyyyyy]'),
  ]);
  assert.equal(tokens.length, 2);
  assert.equal(discarded.length, 0);
});

test('token fuori forma: da cancellare, non mandati', () => {
  const { tokens, discarded } = screenTokens([
    entry(''),
    entry('fcm-token-a-caso'),
    entry('ExponentPushToken[]'),
    entry('ExponentPushToken[abc'),
    entry(' ExponentPushToken[abc]'),
    entry('ExponentPushToken[abc]'),
  ]);
  assert.deepEqual(ids(tokens), ['ExponentPushToken[abc]']);
  assert.equal(discarded.length, 5);
});

test('stesso token sotto due account: vale il più recente, in qualunque ordine', () => {
  const vecchio = entry('ExponentPushToken[abc]', 'a', '2026-10-01T10:00:00.000Z', 'vecchio');
  const nuovo = entry('ExponentPushToken[abc]', 'b', '2026-10-02T09:00:00.000Z', 'nuovo');

  for (const ordine of [[vecchio, nuovo], [nuovo, vecchio]]) {
    const { tokens, discarded } = screenTokens(ordine);
    assert.deepEqual(ids(tokens), ['nuovo']);
    assert.deepEqual(ids(discarded), ['vecchio']);
  }
});

test('documento senza data: perde contro uno datato', () => {
  const { tokens, discarded } = screenTokens([
    entry('ExponentPushToken[abc]', 'a', '', 'senzaData'),
    entry('ExponentPushToken[abc]', 'b', '2026-10-01T10:00:00.000Z', 'datato'),
  ]);
  assert.deepEqual(ids(tokens), ['datato']);
  assert.deepEqual(ids(discarded), ['senzaData']);
});

test('token diversi dello stesso account: tutti mandati', () => {
  const { tokens, discarded } = screenTokens([
    entry('ExponentPushToken[abc]', 'a'),
    entry('ExponentPushToken[def]', 'a'),
  ]);
  assert.equal(tokens.length, 2);
  assert.equal(discarded.length, 0);
});

test('nessun token: niente da mandare', () => {
  assert.deepEqual(screenTokens([]), { tokens: [], discarded: [] });
});
