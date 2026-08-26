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
