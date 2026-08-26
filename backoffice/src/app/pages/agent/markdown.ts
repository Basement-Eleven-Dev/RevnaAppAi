/**
 * Sottoinsieme di markdown reso in HTML, per la pagina di prova.
 *
 * Nell'app il markdown lo rende `app-mobile/src/components/markdown.tsx`. Qui non
 * serve tanta cura — non c'è streaming da tollerare, e non è una schermata che vede
 * il cliente — ma il testo grezzo sì: giudicare il tono di una risposta con i `**`
 * ancora addosso è più difficile del necessario.
 *
 * L'HTML in ingresso viene **prima** neutralizzato e solo dopo si applicano i
 * marcatori: così anche una risposta che contenesse tag non può inserirne. Angular
 * sanifica comunque quello che passa da `[innerHTML]`; questa è la prima delle due
 * difese, non l'unica.
 *
 * I marcatori delle fonti — `[1]` — restano visibili di proposito: sono parte di
 * quello che si sta verificando.
 */
export function renderMarkdown(source: string): string {
  const blocks: string[] = [];
  const lines = escapeHtml(source).replace(/\r\n/g, '\n').split('\n');

  let paragraph: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };

  const flushList = () => {
    if (list) {
      const items = list.items.map((item) => `<li>${inline(item)}</li>`).join('');
      blocks.push(`<${list.tag}>${items}</${list.tag}>`);
      list = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^#{1,6}\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push(`<p class="titolo">${inline(heading[1])}</p>`);
      continue;
    }

    const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
    const ordered = /^\d+[.)]\s+(.*)$/.exec(trimmed);

    if (bullet || ordered) {
      flushParagraph();
      const tag = bullet ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      list = list ?? { tag, items: [] };
      list.items.push((bullet ?? ordered)![1]);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return blocks.join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Un solo passaggio per tutti i marcatori inline: l'ordine conta, `**` va provato
// prima di `*`, altrimenti il grassetto verrebbe letto come due corsivi vuoti.
//
// Il corsivo pretende che il contenuto non cominci né finisca con uno spazio, come
// vuole il markdown vero. Senza quel vincolo una moltiplicazione scritta a mano —
// `ADR * occupazione * notti` — diventerebbe corsiva, e qui di formule se ne scrivono.
function inline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*(\S(?:[^*\n]*\S)?)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_(\S(?:[^_\n]*\S)?)_/g, '$1<em>$2</em>');
}
