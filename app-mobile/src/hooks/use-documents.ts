import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { getFirebaseDb, getFirebaseFunctions, isFirebaseConfigured } from '@/lib/firebase';
import type { ClientDocument } from '@/lib/documents';

/**
 * Documenti che Revna ha condiviso con questo cliente.
 * In ascolto live: appena il consulente ne carica uno, compare nell'app.
 */
export function useDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isFirebaseConfigured || !user) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    const ref = query(
      collection(getFirebaseDb(), 'users', user.uid, 'documents'),
      orderBy('uploadedAt', 'desc')
    );

    return onSnapshot(
      ref,
      (snapshot) => {
        setDocuments(
          snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as ClientDocument)
        );
        setLoading(false);
      },
      (cause) => {
        setError(cause.message);
        setLoading(false);
      }
    );
  }, [user]);

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
