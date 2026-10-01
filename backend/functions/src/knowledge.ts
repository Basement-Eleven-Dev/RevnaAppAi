import type { DocumentReference } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from './admin';
import { idDoc, requireAdmin } from './guards';

/**
 * I documenti della base di conoscenza.
 *
 * Una voce di conoscenza può nascere in due modi: scritta a mano nel backoffice,
 * oppure caricata come file. Il secondo caso esiste perché riformulare un volume
 * capitolo per capitolo è un lavoro che nessuno finisce mai: meglio poter buttare
 * dentro il PDF e avere subito qualcosa che l'assistente sa citare.
 *
 * Quello che cambia è solo *come* il testo arriva in `contenuto`. Da lì in poi il
 * percorso è identico a quello di una voce scritta: stessa selezione, stessa
 * citazione, stesso peso nel contesto. Il modello non sa la differenza, e non deve.
 *
 * L'estrazione sta qui e non nel browser per due motivi: leggere un PDF lato client
 * vorrebbe dire portarsi dietro pdf.js nel bundle del backoffice, e soprattutto il
 * file su Storage non è leggibile da nessun client — le regole lo negano a chiunque,
 * referenti compresi. Il testo lo tira fuori chi il file lo può aprire davvero.
 */

/** Quanto vive un link al file caricato: come per i documenti dei clienti. */
const URL_TTL_MS = 5 * 60 * 1000;

/**
 * Tetto al testo estratto da un singolo file, in byte UTF-8.
 *
 * In byte perché il limite vero è quello di Firestore, 1 MiB per documento: in
 * caratteri, un testo pieno di accenti o in un alfabeto non latino lo supererebbe
 * prima del tetto, e la voce non si salverebbe. Il margine resta agli altri campi.
 */
const MAX_BYTES = 900_000;

/**
 * Sotto questa quantità di testo un PDF è quasi certamente una scansione.
 *
 * Un PDF di immagini si apre e si legge senza errori: pdf.js restituisce le pagine,
 * solo vuote. Senza questo controllo la voce risulterebbe «pronta» e conterrebbe
 * niente, che è il modo peggiore di fallire.
 */
const MIN_CHARS_PER_PAGE = 40;

type IngestRequest = { entryId: string };
type IngestResponse = { chars: number };

/**
 * Legge il file di una voce e ne scrive il testo in `contenuto`.
 *
 * Si può richiamare quante volte si vuole sulla stessa voce: rilegge il file e
 * riscrive il testo. Serve dopo un caricamento, e serve per riprovare quando la
 * prima estrazione è andata storta.
 *
 * La prima lettura riuscita attiva la voce, che nasce sospesa; lo stesso vale per
 * una ripresa dopo un errore. Una voce già pronta tiene invece l'interruttore che
 * ha: se qualcuno l'ha sospesa, rileggerla non la rimette in contesto.
 *
 * Se l'estrazione fallisce la voce torna sospesa: una voce attiva senza contenuto
 * verrebbe contata fra quelle disponibili e non direbbe niente al modello.
 */
export const ingestKnowledgeFile = onCall<IngestRequest, Promise<IngestResponse>>(
  { region: 'europe-west1', timeoutSeconds: 540, memory: '1GiB' },
  async (request) => {
    requireAdmin(request);

    const entryId = idDoc(request.data, 'entryId');

    const reference = db.collection('knowledge').doc(entryId);
    const snapshot = await reference.get();
    if (!snapshot.exists) {
      throw new HttpsError('not-found', 'Questa voce non esiste più.');
    }

    const file = snapshot.data()?.['file'] as
      | { name?: string; storagePath?: string; contentType?: string }
      | undefined;
    const storagePath = file?.storagePath;

    // Il percorso lo scrive il backoffice, ma non va preso sulla fiducia: legato
    // all'id della voce, nessuno può farsi leggere un file qualsiasi del bucket.
    if (!storagePath || !storagePath.startsWith(`knowledge/${entryId}-`)) {
      logger.error('Percorso del file di conoscenza non valido', { entryId, storagePath });
      throw new HttpsError('failed-precondition', 'Questa voce non ha un file da leggere.');
    }

    const giaPronta = snapshot.get('stato') === 'pronto';

    let contenuto: string;
    try {
      const [buffer] = await getStorage().bucket().file(storagePath).download();
      contenuto = trim(await extract(buffer, file?.contentType ?? '', file?.name ?? storagePath));
    } catch (cause) {
      const errore =
        cause instanceof HttpsError
          ? cause.message
          : 'Lettura del documento non riuscita. Riprova, o carica il file in un altro formato.';

      logger.error('Lettura del documento di conoscenza fallita', { entryId, storagePath, cause });
      await aggiorna(reference, { contenuto: '', stato: 'errore', errore, attivo: false });

      throw cause instanceof HttpsError ? cause : new HttpsError('internal', errore);
    }

    await aggiorna(reference, {
      contenuto,
      stato: 'pronto',
      errore: '',
      ...(giaPronta ? {} : { attivo: true }),
      updatedAt: new Date().toISOString(),
      updatedBy: request.auth?.token['email'] ?? '',
    });

    logger.info('Documento di conoscenza letto', { entryId, chars: contenuto.length });
    return { chars: contenuto.length };
  },
);

/** Codice gRPC di Firestore per un documento che non c'è. */
const NOT_FOUND = 5;

/**
 * `update` e non `set`: una voce eliminata mentre il file veniva letto non deve
 * rinascere come documento con il solo testo e nessun titolo.
 */
async function aggiorna(
  reference: DocumentReference,
  data: Record<string, unknown>,
): Promise<void> {
  await reference.update(data).catch((cause: unknown) => {
    if ((cause as { code?: number }).code === NOT_FOUND) {
      throw new HttpsError('not-found', 'Questa voce è stata eliminata durante la lettura.');
    }
    throw cause;
  });
}

/**
 * Il testo dentro un file.
 *
 * Solo due strade, di proposito: i formati testuali si decodificano, i PDF passano
 * da pdf.js. Word ed Excel non ci sono perché nessuno dei due si legge senza una
 * libreria in più, e «esporta in PDF» costa un clic a chi carica.
 */
async function extract(buffer: Buffer, contentType: string, name: string): Promise<string> {
  const extension = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';

  if (contentType === 'application/pdf' || extension === 'pdf') {
    return readPdf(buffer);
  }

  if (contentType.startsWith('text/') || TESTUALI.has(extension)) {
    return buffer.toString('utf8');
  }

  throw new HttpsError(
    'failed-precondition',
    `Formato non leggibile (${contentType || extension || 'sconosciuto'}). ` +
      'Sono ammessi PDF e file di testo: da Word o PowerPoint, esporta in PDF.',
  );
}

const TESTUALI = new Set(['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'log']);

async function readPdf(buffer: Buffer): Promise<string> {
  // `require` e non `import`: pdf-parse tira dentro pdfjs, e caricarlo solo quando
  // arriva davvero un PDF tiene l'avvio della function fuori da quel costo.
  const { PDFParse } = require('pdf-parse') as typeof import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    // Pagina per pagina e non `result.text`, che chiude ogni pagina con «-- 1 of 12 --».
    const result = await parser.getText();
    const text = withoutRunningLines(result.pages.map((page) => page.text)).join('\n\n');

    // Un PDF di sole immagini si apre senza errori e restituisce pagine vuote:
    // senza dirlo, la voce risulterebbe pronta e conterrebbe niente.
    if (result.total > 0 && text.trim().length < result.total * MIN_CHARS_PER_PAGE) {
      throw new HttpsError(
        'failed-precondition',
        'Da questo PDF non esce testo: sembra una scansione. ' +
          'Serve un PDF con testo selezionabile.',
      );
    }

    return text;
  } finally {
    await parser.destroy().catch(() => {
      // Chiusura del worker: se fallisce, l'istanza muore comunque da sé.
    });
  }
}

/** Da quante pagine in su si cercano intestazioni e piè di pagina. */
const MIN_PAGES_FOR_RUNNING_LINES = 5;

/**
 * Le pagine senza intestazioni e piè di pagina.
 *
 * Una riga che apre o chiude quasi ogni pagina, uguale a parte i numeri, è l'indirizzo
 * del sito con il numero di pagina, il titolo del documento, il copyright: niente
 * che serva al modello. Peggio, i numeri di pagina finiscono per sembrargli fonti
 * da citare. I numeri si ignorano nel confronto perché è proprio lì che quelle
 * righe cambiano da una pagina all'altra; e si guardano solo la prima e l'ultima
 * riga, perché è lì che stanno: in mezzo, una riga ripetuta è contenuto.
 */
export function withoutRunningLines(pages: string[]): string[] {
  if (pages.length < MIN_PAGES_FOR_RUNNING_LINES) return pages;

  const shape = (line: string) => line.replace(/\d+/g, '#').replace(/\s+/g, '');
  const linesOf = pages.map((page) => page.split('\n').filter((line) => shape(line)));

  const pagesWith = new Map<string, number>();
  for (const lines of linesOf) {
    const edges = new Set([lines[0], lines[lines.length - 1]].filter(Boolean).map(shape));
    for (const key of edges) pagesWith.set(key, (pagesWith.get(key) ?? 0) + 1);
  }

  const running = (line: string | undefined) =>
    line !== undefined && (pagesWith.get(shape(line)) ?? 0) >= pages.length * 0.6;

  return linesOf.map((lines) => {
    const from = running(lines[0]) ? 1 : 0;
    const to = lines.length > from && running(lines[lines.length - 1]) ? -1 : undefined;
    return lines.slice(from, to).join('\n');
  });
}

/** Righe vuote di troppo via, e un tetto in byte con l'avviso dentro il testo. */
function trim(text: string): string {
  const clean = text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!clean) {
    throw new HttpsError('failed-precondition', 'Il documento non contiene testo.');
  }

  const bytes = Buffer.from(clean, 'utf8');
  if (bytes.length <= MAX_BYTES) return clean;

  // Il taglio può cadere a metà di un carattere: il pezzo monco diventa «�» e va via.
  const head = bytes.subarray(0, MAX_BYTES).toString('utf8').replace(/\uFFFD$/, '');
  return `${head}\n\n[Testo troncato: il documento è troppo lungo. Caricalo diviso in più parti.]`;
}

/**
 * URL firmato per riaprire il file dietro una voce.
 *
 * Le regole di Storage negano la lettura diretta anche ai referenti Revna, come per
 * i documenti dei clienti: si passa da qui o non si passa.
 */
export const getKnowledgeFileUrl = onCall<{ entryId: string }, Promise<{ url: string }>>(
  { region: 'europe-west1' },
  async (request) => {
    requireAdmin(request);

    const entryId = idDoc(request.data, 'entryId');

    const snapshot = await db.collection('knowledge').doc(entryId).get();
    const storagePath = (snapshot.data()?.['file'] as { storagePath?: string } | undefined)
      ?.storagePath;

    if (!storagePath || !storagePath.startsWith(`knowledge/${entryId}-`)) {
      throw new HttpsError('not-found', 'Questa voce non ha un file.');
    }

    const [url] = await getStorage()
      .bucket()
      .file(storagePath)
      .getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + URL_TTL_MS })
      .catch((cause: unknown) => {
        logger.error("Firma dell'URL del documento di conoscenza fallita", { storagePath, cause });
        throw new HttpsError('internal', 'Non è stato possibile preparare il file.');
      });

    return { url };
  },
);
