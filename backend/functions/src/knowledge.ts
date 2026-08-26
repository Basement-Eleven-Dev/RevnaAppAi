import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from './admin';
import { requireAdmin } from './guards';

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
 * Tetto al testo estratto da un singolo file.
 *
 * Non è un limite del modello ma della base di conoscenza: una voce da un milione
 * di caratteri non verrebbe mai messa in contesto tutta intera, e nasconderebbe il
 * problema — meglio dire subito che il documento va spezzato.
 */
const MAX_CHARS = 600_000;

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
 * La voce resta sospesa se l'estrazione fallisce: una voce attiva senza contenuto
 * verrebbe contata fra quelle disponibili e non direbbe niente al modello.
 */
export const ingestKnowledgeFile = onCall<IngestRequest, Promise<IngestResponse>>(
  { region: 'europe-west1', timeoutSeconds: 540, memory: '1GiB' },
  async (request) => {
    requireAdmin(request);

    const { entryId } = request.data;
    if (!entryId) {
      throw new HttpsError('invalid-argument', 'entryId mancante.');
    }

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

    try {
      const [buffer] = await getStorage().bucket().file(storagePath).download();
      const contenuto = trim(
        await extract(buffer, file?.contentType ?? '', file?.name ?? storagePath),
      );

      await reference.set(
        {
          contenuto,
          stato: 'pronto',
          errore: '',
          updatedAt: new Date().toISOString(),
          updatedBy: request.auth?.token['email'] ?? '',
        },
        { merge: true },
      );

      logger.info('Documento di conoscenza letto', { entryId, chars: contenuto.length });
      return { chars: contenuto.length };
    } catch (cause) {
      const errore =
        cause instanceof HttpsError
          ? cause.message
          : 'Lettura del documento non riuscita. Riprova, o carica il file in un altro formato.';

      logger.error('Lettura del documento di conoscenza fallita', { entryId, storagePath, cause });
      await reference.set(
        { contenuto: '', stato: 'errore', errore, attivo: false },
        { merge: true },
      );

      throw cause instanceof HttpsError ? cause : new HttpsError('internal', errore);
    }
  },
);

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
    const result = await parser.getText();
    const text = result.text ?? '';

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

/** Righe vuote di troppo via, e un tetto ai caratteri con l'avviso dentro il testo. */
function trim(text: string): string {
  const clean = text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!clean) {
    throw new HttpsError('failed-precondition', 'Il documento non contiene testo.');
  }

  return clean.length > MAX_CHARS
    ? `${clean.slice(0, MAX_CHARS)}\n\n[Testo troncato: il documento supera i ${MAX_CHARS} caratteri. Caricalo diviso in più parti.]`
    : clean;
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

    const { entryId } = request.data;
    if (!entryId) {
      throw new HttpsError('invalid-argument', 'entryId mancante.');
    }

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
