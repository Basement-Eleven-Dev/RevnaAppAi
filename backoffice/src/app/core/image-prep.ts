/**
 * Prepara un'immagine prima di caricarla in una comunicazione.
 *
 * Nasce da un errore concreto: una foto presa dalla macchina fotografica pesa
 * dieci megabyte, e le regole di Storage la rifiutano — con un «permission denied»
 * che non dice niente a chi la stava incollando. Ma il limite delle regole è solo il
 * sintomo: quell'immagine finisce dentro un avviso che si legge sul **telefono**, dove
 * la stessa foto viene mostrata larga ottocento pixel e scaricata a spese del piano
 * dati del cliente. Ridurla non è un espediente per stare sotto il tetto, è la cosa
 * giusta da fare comunque.
 *
 * Perciò qui l'immagine viene ridisegnata a una misura sensata per una schermata, e il
 * caso «troppo grande» smette di esistere prima di arrivare al server. Quello che resta
 * — un file che non è un'immagine, o che non si riesce a leggere — torna come errore in
 * italiano, non come codice di Firebase.
 */

/** Lo stesso tetto delle regole di Storage: superarlo qui è un errore nostro. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Il lato lungo massimo, in pixel.
 *
 * 1600 sono il doppio della larghezza a cui l'app mostra un'immagine (il contenuto sta
 * in 800 punti): nitida anche sui telefoni a densità tripla, e un decimo del peso di una
 * foto originale. È la stessa logica con cui il blog chiede a WordPress la variante da
 * 768 invece dell'originale da 1536.
 */
const MAX_EDGE = 1600;

/**
 * Sotto questa soglia un'immagine già piccola passa **intatta**.
 *
 * Ricomprimere un PNG da 200 KB — una schermata, un grafico, un logo — non
 * guadagnerebbe niente e ne peggiorerebbe il testo: la ricompressione di uno screenshot
 * si vede, ed è la cosa che in un avviso si legge.
 */
const PASSTHROUGH_BYTES = 600 * 1024;

/** I formati che riscriviamo. Un GIF animato passa intatto: ridisegnarlo lo fermerebbe. */
const REENCODABLE = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * L'immagine pronta da caricare: la stessa, o una sua versione ridotta.
 *
 * Solleva con un messaggio leggibile se il file non è un'immagine o se non si riesce a
 * ridurlo: sono i due casi in cui non c'è niente da caricare, e dirlo qui è meglio che
 * lasciarlo dire a Storage.
 */
export async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error(
      'Questo file non è un\'immagine. In una comunicazione si possono mettere foto, ' +
        'grafici e schermate; per un documento usa i Documenti del cliente.'
    );
  }

  const bitmap = await readBitmap(file);

  // Piccola e nei limiti: si carica com'è.
  if (
    bitmap === null ||
    !REENCODABLE.includes(file.type) ||
    (file.size <= PASSTHROUGH_BYTES && Math.max(bitmap.width, bitmap.height) <= MAX_EDGE)
  ) {
    bitmap?.close();
    if (file.size < MAX_IMAGE_BYTES) return file;

    throw new Error(
      `Questa immagine pesa ${megabytes(file.size)} e non si può ridurre: il limite è ` +
        `${megabytes(MAX_IMAGE_BYTES)}. Salvala in JPEG o PNG e riprova.`
    );
  }

  try {
    // Due tentativi. Il primo conserva il formato di partenza: un PNG resta PNG, perché
    // quasi sempre è una schermata o un grafico, e il testo dentro un'immagine è la
    // prima cosa che la compressione JPEG rovina. Il secondo scende di misura e passa a
    // JPEG, e serve a quel che resta grosso anche ridimensionato — una scansione, una
    // schermata molto larga: lì un po' di artefatti valgono più di un avviso senza
    // immagine.
    const attempts: { edge: number; quality: number; type: string }[] = [
      { edge: MAX_EDGE, quality: 0.85, type: file.type === 'image/png' ? 'image/png' : 'image/jpeg' },
      { edge: 1200, quality: 0.7, type: 'image/jpeg' },
    ];

    for (const attempt of attempts) {
      const reduced = await redraw(bitmap, file, attempt);
      if (reduced && reduced.size < MAX_IMAGE_BYTES) return reduced;
    }

    if (file.size < MAX_IMAGE_BYTES) return file;

    throw new Error(
      `Questa immagine resta oltre ${megabytes(MAX_IMAGE_BYTES)} anche ridotta. ` +
        'Ritagliala o esportala in JPEG e riprova.'
    );
  } finally {
    bitmap.close();
  }
}

/**
 * L'immagine decodificata, o `null` se il browser non ce la fa.
 *
 * `from-image` fa rispettare l'orientamento scritto nei dati EXIF: senza, una foto
 * scattata in verticale con il telefono entrerebbe nell'avviso coricata su un fianco.
 */
async function readBitmap(file: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }
}

/** L'immagine ridisegnata secondo il tentativo indicato. `null` se non riesce. */
async function redraw(
  bitmap: ImageBitmap,
  file: File,
  { edge, quality, type }: { edge: number; quality: number; type: string }
): Promise<File | null> {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext('2d');
  if (!context) return null;

  // Il PNG può avere trasparenza, il JPEG no: senza questo fondo bianco le parti
  // trasparenti diventerebbero nere una volta convertite.
  if (type !== 'image/png') {
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality)
  );
  if (!blob) return null;

  return new File([blob], renamed(file.name, type), { type });
}

/** Il nome con l'estensione del formato in cui l'immagine è stata riscritta. */
function renamed(name: string, type: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'immagine';
  return `${base}.${type === 'image/png' ? 'png' : 'jpg'}`;
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
