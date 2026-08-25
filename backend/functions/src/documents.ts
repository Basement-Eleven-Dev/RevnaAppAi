import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from './admin';

/**
 * Quanto vive un link a un documento. Abbastanza da aprirlo o scaricarlo,
 * troppo poco perché copiarlo e girarlo abbia senso.
 */
const URL_TTL_MS = 5 * 60 * 1000;

type Request = {
  documentId: string;
  /** Solo per i referenti Revna: di quale cliente è il documento. */
  uid?: string;
};

/**
 * Rilascia un URL firmato per scaricare un documento.
 *
 * Le regole di Storage negano la lettura diretta a chiunque: questo è l'unico
 * modo di arrivare al file, e passa da un controllo esplicito su chi sta chiedendo.
 * Il cliente può scaricare solo i propri documenti; il referente Revna quelli di
 * un cliente che indica esplicitamente.
 */
export const getDocumentUrl = onCall<Request, Promise<{ url: string; expiresAt: string }>>(
  { region: 'europe-west1' },
  async (request) => {
    const caller = request.auth;
    if (!caller) {
      throw new HttpsError('unauthenticated', 'Accesso riservato.');
    }

    const isAdmin = caller.token['revnaAdmin'] === true;
    const ownerUid = isAdmin ? (request.data.uid ?? caller.uid) : caller.uid;
    const { documentId } = request.data;

    if (!documentId) {
      throw new HttpsError('invalid-argument', 'documentId mancante.');
    }

    const snapshot = await db
      .collection('users')
      .doc(ownerUid)
      .collection('documents')
      .doc(documentId)
      .get();

    if (!snapshot.exists) {
      throw new HttpsError('not-found', 'Documento inesistente.');
    }

    const storagePath = snapshot.data()?.['storagePath'] as string | undefined;

    // La scheda la scrive il backoffice, ma il percorso non va preso sulla fiducia:
    // se qualcuno riuscisse a scriverci dentro, potrebbe farsi firmare un URL per
    // un file qualsiasi del bucket. Il percorso deve stare nella cartella del suo
    // proprietario, punto.
    if (!storagePath || !storagePath.startsWith(`clients/${ownerUid}/documents/`)) {
      logger.error('Percorso del documento non valido', { ownerUid, documentId, storagePath });
      throw new HttpsError('failed-precondition', 'Documento non disponibile.');
    }

    const expiresAt = Date.now() + URL_TTL_MS;
    const [url] = await getStorage()
      .bucket()
      .file(storagePath)
      .getSignedUrl({ version: 'v4', action: 'read', expires: expiresAt })
      .catch((cause: unknown) => {
        logger.error('Firma dell\'URL fallita', { storagePath, cause });
        throw new HttpsError('internal', 'Non è stato possibile preparare il download.');
      });

    // Traccia dell'accesso: su materiale riservato serve sapere chi ha aperto cosa.
    logger.info('Documento richiesto', {
      documentId,
      ownerUid,
      by: caller.token['email'] ?? caller.uid,
      isAdmin,
    });

    return { url, expiresAt: new Date(expiresAt).toISOString() };
  }
);
