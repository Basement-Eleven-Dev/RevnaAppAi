import { describe, expect, it } from 'vitest';

import { htmlToMarkdown, markdownToHtml } from './markdown-html';

const DOCUMENTO = [
  '## Chiusura uffici',
  '',
  'Dal **12 al 16 agosto** gli uffici sono chiusi. Per le urgenze scrivi a [assistenza](https://revna.it/assistenza).',
  '',
  '### Cosa cambia',
  '',
  '- Nessuna revisione tariffaria',
  '- Il *pick-up* resta monitorato',
  '',
  '1. Primo',
  '2. Secondo',
  '',
  '> Le richieste aperte restano in coda.',
  '',
  '![Grafico](https://example.com/g.png)',
  '',
  '---',
  '',
  'A presto.',
].join('\n');

describe('markdown ↔ html', () => {
  it('sopravvive al giro di andata e ritorno', () => {
    expect(htmlToMarkdown(markdownToHtml(DOCUMENTO))).toBe(DOCUMENTO);
  });

  it('legge l\'HTML che scrive un contenteditable', () => {
    const html =
      '<div>Ciao&nbsp;a tutti</div><p><b>Grassetto</b> e <i>corsivo</i></p>' +
      '<p>Riga uno<br>Riga due</p><p><img src="https://example.com/x.png" alt=""></p>';

    expect(htmlToMarkdown(html)).toBe(
      ['Ciao a tutti', '**Grassetto** e *corsivo*', 'Riga uno', 'Riga due', '![](https://example.com/x.png)'].join(
        '\n\n',
      ),
    );
  });

  it('scarta gli schemi eseguibili negli indirizzi', () => {
    expect(markdownToHtml('[clicca](javascript:void)')).toBe('<p><a href="">clicca</a></p>');
  });

  it('non lascia entrare tag dal markdown salvato', () => {
    expect(markdownToHtml('<script>alert(1)</script>')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    );
  });
});
