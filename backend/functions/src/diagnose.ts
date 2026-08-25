import { getStorage } from 'firebase-admin/storage';
import { onRequest } from 'firebase-functions/v2/https';

/** USA E GETTA — verifica che il service account possa firmare URL. Da rimuovere. */
export const diagnoseSigning = onRequest(
  { region: 'europe-west1', timeoutSeconds: 30 },
  async (_request, response) => {
    try {
      const [url] = await getStorage()
        .bucket()
        .file('clients/__diagnostica__/documents/prova.txt')
        .getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 60_000 });
      response.json({ ok: true, signed: url.slice(0, 80) });
    } catch (cause) {
      response.status(500).json({
        ok: false,
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }
);
