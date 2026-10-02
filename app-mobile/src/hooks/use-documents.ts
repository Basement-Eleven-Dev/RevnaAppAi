import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { useLiveData, type Subscribe } from '@/hooks/use-live-data';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
import type { ClientDocument } from '@/lib/documents';

const NONE: ClientDocument[] = [];

const subscribe: Subscribe<ClientDocument[]> = (uid, onData, onError) =>
  onSnapshot(
    query(collection(getFirebaseDb(), 'users', uid, 'documents'), orderBy('uploadedAt', 'desc')),
    (snapshot) =>
      onData(
        snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as ClientDocument)
      ),
    onError
  );

/**
 * Documenti che Revna ha condiviso con questo cliente.
 * In ascolto live: appena il consulente ne carica uno, compare nell'app.
 */
export function useDocuments() {
  const { data: documents, loading, error } = useLiveData(subscribe, NONE);
  return { documents, loading, error };
}

/**
 * URL di download del documento, valido pochi minuti.
 *
 * Le regole di Storage negano la lettura diretta: il link lo rilascia la function,
 * che verifica che il documento sia davvero di chi lo sta chiedendo. Si chiede solo
 * al momento dell'apertura, così non restano in giro link ancora validi.
 */
export async function documentUrl(documentId: string): Promise<string> {
  const call = httpsCallable<{ documentId: string }, { url: string }>(
    getFirebaseFunctions(),
    'getDocumentUrl'
  );
  const { data } = await call({ documentId });
  return data.url;
}
