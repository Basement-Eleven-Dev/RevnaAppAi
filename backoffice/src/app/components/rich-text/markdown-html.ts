/**
 * Le due traduzioni fra markdown e HTML che servono all'editor delle comunicazioni.
 *
 * Il testo si **salva in markdown** perché è l'app a doverlo mostrare, e l'app non è un
 * browser: lo rende con `app-mobile/src/components/markdown.tsx`, lo stesso renderer
 * delle risposte dell'assistente. Si **modifica in HTML** perché un campo WYSIWYG è un
 * `contenteditable`, e un contenteditable parla HTML e nient'altro.
 *
 * Da qui le due funzioni, una per verso, e il vincolo che le tiene insieme: il
 * sottoinsieme che attraversano è **esattamente** quello che il renderer dell'app sa
 * mostrare — titoli, grassetto, corsivo, liste, citazioni, link, immagini, righe
 * orizzontali, codice. Tutto quello che non è in questa lista non deve poter entrare
 * nel markdown, altrimenti nell'app comparirebbe come testo grezzo. Per questo la barra
 * dell'editor offre solo questi comandi e l'incolla arriva senza formattazione.
 *
 * Non è il renderer di `pages/agent/markdown.ts`: quello serve a leggere una risposta
 * del modello in una pagina di prova, in un verso solo, e non ha bisogno del giro di
 * ritorno né dei blocchi che qui contano (immagini, citazioni, link).
 */

/** Un'immagine da sola su una riga: è così che l'editor la scrive. */
const IMAGE_LINE = /^!\[([^\]]*)]\(([^)]+)\)$/;

/**
 * Da markdown all'HTML dell'editor.
 *
 * L'HTML in ingresso viene neutralizzato **prima** di applicare i marcatori (vedi
 * `escapeHtml`): il markdown salvato non dovrebbe contenere tag, ma se ne contenesse
 * finirebbe dentro un contenteditable, che è un pezzo di pagina vivo.
 */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];

  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(`<p>${inlineToHtml(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === '') {
      flushParagraph();
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph();
      blocks.push('<hr>');
      continue;
    }

    const image = IMAGE_LINE.exec(line);
    if (image) {
      flushParagraph();
      blocks.push(
        `<p><img src="${escapeAttribute(image[2])}" alt="${escapeAttribute(image[1])}"></p>`,
      );
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      // Due soli livelli, come i due bottoni della barra: il markdown potrebbe
      // portarne sei, ma un avviso di venti righe non ha sei livelli di gerarchia.
      const tag = heading[1].length <= 2 ? 'h2' : 'h3';
      blocks.push(`<${tag}>${inlineToHtml(heading[2])}</${tag}>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushParagraph();
      const quoted: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoted.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      i--;
      blocks.push(`<blockquote>${inlineToHtml(quoted.join(' '))}</blockquote>`);
      continue;
    }

    const bullet = /^[-*+]\s+/;
    const ordered = /^\d+[.)]\s+/;
    const marker = bullet.test(line) ? bullet : ordered.test(line) ? ordered : null;

    if (marker) {
      flushParagraph();
      const tag = marker === bullet ? 'ul' : 'ol';
      const list = collectItems(lines, i, marker);
      blocks.push(`<${tag}>${list.items}</${tag}>`);
      i = list.next;
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();

  // Un editor vuoto ha bisogno di un blocco in cui mettere il cursore: senza,
  // il primo carattere digitato finisce come testo nudo dentro il div.
  return blocks.join('') || '<p><br></p>';
}

/** Le righe consecutive che appartengono alla stessa lista, e dove finisce. */
function collectItems(
  lines: string[],
  start: number,
  marker: RegExp,
): { items: string; next: number } {
  const items: string[] = [];
  let i = start;

  while (i < lines.length && marker.test(lines[i].trim())) {
    items.push(`<li>${inlineToHtml(lines[i].trim().replace(marker, ''))}</li>`);
    i++;
  }

  return { items: items.join(''), next: i - 1 };
}

/** Marcatori inline. L'ordine conta: immagine prima del link, `**` prima di `*`. */
function inlineToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(
      /!\[([^\]]*)]\(([^)]+)\)/g,
      (_full, alt: string, src: string) =>
        `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}">`,
    )
    .replace(
      /\[([^\]]+)]\(([^)]+)\)/g,
      (_full, label: string, href: string) => `<a href="${escapeAttribute(href)}">${label}</a>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*(\S(?:[^*\n]*\S)?)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_(\S(?:[^_\n]*\S)?)_/g, '$1<em>$2</em>');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Un indirizzo dentro un attributo.
 *
 * Oltre alle virgolette si scartano gli schemi che eseguono qualcosa: `javascript:` in
 * un `href` è un link che al clic fa girare del codice, e in un editor dove i link si
 * possono incollare non è un caso da ignorare.
 */
function escapeAttribute(value: string): string {
  const clean = value.trim();
  if (/^\s*(javascript|data|vbscript):/i.test(clean)) return '';

  return clean.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Dall'HTML dell'editor al markdown da salvare.
 *
 * Si attraversa il DOM e non il testo: quello che esce da un contenteditable è HTML
 * scritto dal browser, con i suoi `<div>` di troppo, i suoi `&nbsp;` e i suoi `<br>`
 * finali, e cercarne i pezzi con delle espressioni regolari vorrebbe dire indovinare.
 *
 * Le immagini vengono **sollevate a blocco proprio**: nel markdown un'immagine in mezzo
 * a una frase il renderer dell'app la mostrerebbe come testo, quindi esce dal paragrafo
 * e si mette da sola, subito dopo. È l'unico punto in cui il giro di ritorno non è
 * identico all'andata, e succede solo se qualcuno scrive attaccato a un'immagine.
 */
export function htmlToMarkdown(html: string): string {
  const root = document.createElement('div');
  root.innerHTML = html;

  const blocks: string[] = [];
  walk(root, blocks);

  return blocks
    .map((block) => block.trim())
    .filter((block) => block !== '')
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const BLOCKS = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'UL',
  'OL',
  'BLOCKQUOTE',
  'HR',
  'PRE',
  'TABLE',
  'SECTION',
  'ARTICLE',
]);

function walk(parent: Node, blocks: string[]): void {
  /** Il paragrafo in costruzione: i nodi inline che si incontrano fuori da un blocco. */
  let pending = '';
  /** Le immagini incontrate nel paragrafo in costruzione, da mettere dopo di esso. */
  let images: string[] = [];

  const flush = () => {
    // I `<br>` diventano paragrafi distinti: nel markdown il ritorno a capo dentro un
    // paragrafo non esiste — il renderer dell'app riunisce le righe — quindi l'unico
    // modo di rispettare un'interruzione voluta è spezzare il paragrafo.
    for (const piece of pending.split('\n')) blocks.push(piece);
    blocks.push(...images);
    pending = '';
    images = [];
  };

  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      pending += normalize(node.textContent ?? '');
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const element = node as HTMLElement;

    if (!BLOCKS.has(element.tagName)) {
      const { text, images: nested } = inlineOf(element);
      pending += text;
      images.push(...nested);
      continue;
    }

    flush();

    switch (element.tagName) {
      case 'HR':
        blocks.push('---');
        break;

      case 'H1':
      case 'H2':
        blocks.push(`## ${flat(element)}`);
        break;

      case 'H3':
      case 'H4':
      case 'H5':
      case 'H6':
        blocks.push(`### ${flat(element)}`);
        break;

      case 'UL':
      case 'OL': {
        const items = Array.from(element.querySelectorAll(':scope > li'));
        const ordered = element.tagName === 'OL';
        blocks.push(
          items
            .map((item, index) => `${ordered ? `${index + 1}.` : '-'} ${flat(item)}`)
            .filter((line) => line.trim().length > 2)
            .join('\n'),
        );
        break;
      }

      case 'BLOCKQUOTE':
        blocks.push(
          flat(element)
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n'),
        );
        break;

      case 'PRE':
        blocks.push(`\`\`\`\n${(element.textContent ?? '').replace(/\n+$/, '')}\n\`\`\``);
        break;

      // Un `<div>` (o un `<p>`) può contenere altri blocchi: succede quando si incolla
      // e quando il browser annida a modo suo. Si ricorre invece di appiattire, così
      // una lista dentro un div resta una lista.
      default:
        if (element.querySelector(Array.from(BLOCKS).join(','))) {
          walk(element, blocks);
        } else {
          const { text, images: nested } = inlineOf(element);
          for (const piece of text.split('\n')) blocks.push(piece);
          blocks.push(...nested);
        }
    }
  }

  flush();
}

/** Il contenuto inline di un elemento, appiattito a una riga di markdown. */
function flat(element: Element): string {
  const { text, images } = inlineOf(element);
  return [text, ...images].filter((piece) => piece.trim() !== '').join(' ');
}

function inlineOf(element: Element): { text: string; images: string[] } {
  let text = '';
  const images: string[] = [];

  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += normalize(node.textContent ?? '');
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const child = node as HTMLElement;

    switch (child.tagName) {
      case 'BR':
        text += '\n';
        break;

      case 'IMG': {
        const src = child.getAttribute('src') ?? '';
        const alt = child.getAttribute('alt') ?? '';
        if (src) images.push(`![${alt}](${src})`);
        break;
      }

      case 'STRONG':
      case 'B': {
        const inner = inlineOf(child);
        images.push(...inner.images);
        if (inner.text.trim()) text += `**${inner.text.trim()}**`;
        break;
      }

      case 'EM':
      case 'I': {
        const inner = inlineOf(child);
        images.push(...inner.images);
        if (inner.text.trim()) text += `*${inner.text.trim()}*`;
        break;
      }

      case 'CODE': {
        const inner = inlineOf(child);
        if (inner.text.trim()) text += `\`${inner.text.trim()}\``;
        break;
      }

      case 'A': {
        const inner = inlineOf(child);
        images.push(...inner.images);
        const href = child.getAttribute('href') ?? '';
        const label = inner.text.trim();
        // Un link senza indirizzo è solo testo; un indirizzo senza testo è il
        // link stesso, che è come lo si legge quando si incolla un URL.
        if (label && href) text += `[${label}](${href})`;
        else if (href) text += href;
        else text += inner.text;
        break;
      }

      default: {
        const inner = inlineOf(child);
        text += inner.text;
        images.push(...inner.images);
      }
    }
  }

  return { text, images };
}

/**
 * Gli spazi come li scrive il browser, ridotti a spazi normali.
 *
 * Il `&nbsp;` che il contenteditable infila per tenere aperto un buco nel testo è un
 * carattere diverso dallo spazio: lasciarlo nel markdown vorrebbe dire uno spazio che
 * non va a capo in mezzo a un avviso, e a volte una parola tagliata male sul telefono.
 */
function normalize(text: string): string {
  return text.replace(/\u00a0/g, ' ').replace(/[ \t\r\n]+/g, ' ');
}
