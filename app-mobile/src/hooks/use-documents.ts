import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { getFirebaseDb, getFirebaseStorage, isFirebaseConfigured } from '@/lib/firebase';
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

/** URL firmato del file, chiesto solo al momento dell'apertura. */
export function documentUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(getFirebaseStorage(), storagePath));
}
