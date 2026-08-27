/**
 * Documenti che Revna condivide con un cliente: report, presentazioni, playbook.
 *
 * Il file sta su Cloud Storage in `clients/{uid}/documents/{id}-{nome}`; qui c'è
 * la sua scheda, in `users/{uid}/documents/{id}`. Tipi duplicati fra backoffice e
 * app: sono poche righe e non giustificano un pacchetto condiviso.
 *
 * Le etichette delle categorie stanno in `lib/i18n` insieme al resto dell'interfaccia
 * (`t.documenti.categorie`): qui resta solo quello che non si traduce.
 */

export type ClientDocument = {
  id: string;
  /** Nome del file come lo vede il cliente. */
  name: string;
  /** Nota facoltativa del consulente: a cosa serve, cosa guardare. */
  description: string;
  categoria: string;
  contentType: string;
  size: number;
  storagePath: string;
  uploadedAt: string;
  uploadedBy: string;
};

/** Dimensione leggibile, senza decimali inutili sui file piccoli. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Quanti giorni un documento resta «nuovo» in elenco. */
const RECENT_DAYS = 7;

/**
 * Il formato del file, come lo mostra il blocco a sinistra della riga: è la prima
 * informazione che si vuole di un documento.
 *
 * Si ricava dall'estensione del nome e non dal `contentType`, che per gli allegati
 * di Office è una stringa lunga e piena di sinonimi: l'estensione è quello che il
 * cliente vede anche fuori dall'app.
 */
export function formatOf(document: ClientDocument): string {
  const extension = /\.([a-zA-Z0-9]{1,5})$/.exec(document.name)?.[1]?.toUpperCase();
  if (!extension) return 'FILE';

  // Le due estensioni di Office sono lo stesso formato per chi legge.
  if (extension === 'XLSX') return 'XLS';
  if (extension === 'DOCX') return 'DOC';
  if (extension === 'PPTX') return 'PPT';
  if (extension === 'JPEG') return 'JPG';

  return extension;
}

/**
 * Un documento arrivato negli ultimi giorni.
 *
 * È l'unico uso dell'arancio nell'elenco dei documenti, quindi vale la pena che
 * sia una cosa sola: «è arrivato da poco», non «non l'hai ancora aperto» — quello
 * l'app non lo sa, perché i documenti si aprono nel browser.
 */
export function isRecent(document: ClientDocument): boolean {
  if (!document.uploadedAt) return false;

  const uploaded = new Date(document.uploadedAt).getTime();
  if (Number.isNaN(uploaded)) return false;

  return Date.now() - uploaded < RECENT_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Ripulisce il nome per usarlo nel percorso su Storage: via accenti, spazi e
 * caratteri che complicherebbero l'URL. Il nome originale resta nella scheda.
 */
export function safeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-80);
}
