/**
 * Il blog di Revenue su Misura, letto dall'app.
 *
 * La fonte è la REST API di WordPress del sito e non l'RSS: la pagina pubblica
 * /blog-revenue/ non ha un feed proprio, e l'elenco globale dei post per data è
 * esattamente ciò che quella pagina mostra. La REST dà in più le tre cose che
 * all'RSS mancano — paginazione vera, copertine già ritagliate nelle varianti
 * giuste e un JSON da non parsare a mano — e risponde con CORS aperto, quindi
 * funziona anche sulla build web.
 *
 * Nessuna chiave e nessuna autenticazione: sono gli stessi articoli che chiunque
 * legge sul sito. Non passiamo dal backend Revna perché non c'è niente da
 * mediare — nessun dato del cliente entra in queste richieste.
 */

/** Elenco dei post, dal più recente. `_embed` porta con sé la copertina. */
const POSTS_ENDPOINT = 'https://www.revenuesumisura.it/wp-json/wp/v2/posts';

/** L'archivio sul sito: il ripiego se la lista non si carica. */
export const BLOG_WEB_URL = 'https://www.revenuesumisura.it/blog-revenue/';

/**
 * Quanti post per richiesta. Dodici riempiono più di una schermata su ogni
 * telefono, così chi scorre non incontra il caricamento della pagina dopo tre
 * card, e restano ~40 KB per richiesta.
 */
export const POSTS_PER_PAGE = 12;

export type BlogPost = {
  id: number;
  title: string;
  /** Estratto ripulito dall'HTML. Vuoto se il post non ne ha uno. */
  excerpt: string;
  /** Data di pubblicazione in ISO, per `toLocaleDateString`. */
  date: string;
  /** Permalink sul sito: è quello che si apre nel browser. */
  url: string;
  /** Copertina a 768px. Vuota per i post che non ne hanno una. */
  cover: string;
};

export type BlogPage = { posts: BlogPost[]; hasMore: boolean };

/**
 * Una pagina di articoli, dalla prima (`page` parte da 1).
 *
 * `_fields` tiene fuori il corpo dell'articolo — sedicimila caratteri di HTML per
 * post che qui non si mostrano, dato che a leggerlo si va sul sito.
 */
export async function fetchBlogPage(page: number): Promise<BlogPage> {
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(POSTS_PER_PAGE),
    _embed: 'wp:featuredmedia',
    _fields: 'id,date,link,title,excerpt,_links.wp:featuredmedia',
  });

  const response = await fetch(`${POSTS_ENDPOINT}?${query}`);
  if (!response.ok) throw new Error(`Blog non raggiungibile (${response.status})`);

  const raw: unknown = await response.json();
  if (!Array.isArray(raw)) throw new Error('Risposta del blog inattesa');

  const posts = raw.map(toPost);

  // WordPress dichiara il totale delle pagine in un header, esposto anche via
  // CORS. Se un proxy lo mangia, una pagina non piena dice la stessa cosa.
  const totalPages = Number(response.headers.get('x-wp-totalpages'));
  const hasMore = Number.isFinite(totalPages) && totalPages > 0
    ? page < totalPages
    : posts.length === POSTS_PER_PAGE;

  return { posts, hasMore };
}

type RawPost = {
  id?: unknown;
  date?: unknown;
  link?: unknown;
  title?: { rendered?: unknown };
  excerpt?: { rendered?: unknown };
  _embedded?: { 'wp:featuredmedia'?: unknown };
};

function toPost(raw: RawPost): BlogPost {
  return {
    id: typeof raw.id === 'number' ? raw.id : 0,
    title: plainText(raw.title?.rendered),
    excerpt: trimEllipsis(plainText(raw.excerpt?.rendered)),
    date: typeof raw.date === 'string' ? raw.date : '',
    url: typeof raw.link === 'string' ? raw.link : BLOG_WEB_URL,
    cover: coverOf(raw._embedded?.['wp:featuredmedia']),
  };
}

type RawMedia = {
  source_url?: unknown;
  media_details?: { sizes?: Record<string, { source_url?: unknown } | undefined> };
};

/**
 * La copertina nella variante più vicina a quanto è larga una card.
 *
 * `medium_large` sono 768px: nitidi anche sui telefoni a densità tripla e un
 * decimo del peso dell'originale, che sul sito arriva a 1536px. Le varianti si
 * chiedono in ordine perché WordPress le genera al caricamento del file: sui
 * post vecchi qualche taglio può non esserci.
 */
function coverOf(media: unknown): string {
  const first = Array.isArray(media) ? (media[0] as RawMedia | undefined) : undefined;
  if (!first) return '';

  const sizes = first.media_details?.sizes ?? {};
  for (const size of ['medium_large', 'large', 'medium'] as const) {
    const url = sizes[size]?.source_url;
    if (typeof url === 'string' && url !== '') return url;
  }

  return typeof first.source_url === 'string' ? first.source_url : '';
}

/** Da HTML di WordPress a testo: via i tag, via le entità, spazi normalizzati. */
function plainText(value: unknown): string {
  if (typeof value !== 'string') return '';

  return decodeEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Le entità HTML che WordPress mette nei titoli e negli estratti.
 *
 * Solo numeriche e una manciata di nominali: nel testo del sito compaiono
 * apostrofi tipografici, virgolette, accenti ed ellissi, tutti scritti in forma
 * numerica dal generatore di WordPress. Una tabella completa sarebbe mille voci
 * per non vederne mai una.
 */
function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    hellip: '…',
    laquo: '«',
    raquo: '»',
    egrave: 'è',
    eacute: 'é',
  };

  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      return String.fromCodePoint(parseInt(code.slice(2), 16));
    }
    if (code.startsWith('#')) {
      return String.fromCodePoint(Number(code.slice(1)));
    }

    return named[code.toLowerCase()] ?? entity;
  });
}

/**
 * WordPress chiude gli estratti tagliati con `[…]`. Nella card è una parentesi
 * quadra a metà frase: l'ellissi da sola dice la stessa cosa senza rumore.
 */
function trimEllipsis(text: string): string {
  return text.replace(/\s*\[\s*…\s*]\s*$/, '…');
}
