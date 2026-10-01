import assert from 'node:assert/strict';
import { test } from 'node:test';

import { withoutRunningLines } from './knowledge';

const slide = (n: number, body: string) => `${n}\tw w w . s i t o . i t\n${body}\nCAPITOLO`;

test('le righe ripetute su ogni pagina, numero a parte, vanno via', () => {
  const pages = Array.from({ length: 6 }, (_, i) => slide(i + 1, `Contenuto ${i + 1}`));

  assert.deepEqual(
    withoutRunningLines(pages),
    Array.from({ length: 6 }, (_, i) => `Contenuto ${i + 1}`),
  );
});

test('una riga presente solo su alcune pagine resta', () => {
  const pages = ['A\nSezione', 'B\nSezione', 'C', 'D', 'E', 'F'];
  assert.deepEqual(withoutRunningLines(pages), pages);
});

test('i documenti corti restano come sono', () => {
  const pages = ['Titolo\nuno', 'Titolo\ndue'];
  assert.deepEqual(withoutRunningLines(pages), pages);
});
