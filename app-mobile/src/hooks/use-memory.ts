import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { getFirebaseDb, getFirebaseFunctions, isFirebaseConfigured } from '@/lib/firebase';
import { MAX_ENTRY_CHARS, type MemoryEntry } from '@/lib/memory';

/**
 * La memoria dell'assistente su questo cliente, in ascolto live.
 *
 * Live e non letta una volta all'apertura per il motivo per cui la memoria esiste:
 * cresce mentre si parla. Con la schermata aperta e una conversazione in corso su un
 * altro dispositivo, la riga nuova compare qui da sé — ed è la dimostrazione più
 * breve che la promessa è vera.
 *
 * Dal più recente: quello che interessa aprendo la schermata è l'ultima cosa che
 * l'assistente ha capito. Il modello, che la riceve nel prompt, la legge al contrario.
 */
export function useMemory() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isFirebaseConfigured || !user) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const ref = query(
      collection(getFirebaseDb(), 'users', user.uid, 'memory'),
      orderBy('at', 'desc')
    );

    return onSnapshot(
      ref,
      (snapshot) => {
        setEntries(snapshot.docs.map((document) => toEntry(document.id, document.data())));
        setLoading(false);
        setError('');
      },
      (cause) => {
        setLoading(false);
        setError(cause.message);
      }
    );
  }, [user]);

  /**
   * Corregge una riga.
   *
   * `origine: 'cliente'` non è un dettaglio d'archivio: è quello che permette all'app
   * di dire «corretto da te» sotto la riga, e al cliente di distinguere ciò che
   * l'assistente ha capito da ciò che lui gli ha spiegato. Le regole Firestore
   * ammettono da qui solo questi tre campi.
   */
  const save = useCallback(
    async (id: string, testo: string) => {
      if (!user) return;

      await updateDoc(doc(getFirebaseDb(), 'users', user.uid, 'memory', id), {
        testo: testo.trim().replace(/\s+/g, ' ').slice(0, MAX_ENTRY_CHARS),
        updatedAt: new Date().toISOString(),
        origine: 'cliente',
      });
    },
    [user]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(getFirebaseDb(), 'users', user.uid, 'memory', id));
    },
    [user]
  );

  /**
   * Dimentica tutto. Passa da una function e non da un ciclo di `deleteDoc`: sono
   * cancellazioni su un numero di documenti che l'app non conosce, e a metà strada
   * lascerebbero una memoria mutilata invece di una vuota.
   */
  const clear = useCallback(async () => {
    const call = httpsCallable<void, { cancellati: number }>(
      getFirebaseFunctions(),
      'clearMemory'
    );
    await call();
  }, []);

  return { entries, loading, error, save, remove, clear };
}

function toEntry(id: string, data: Record<string, unknown>): MemoryEntry {
  const at = (data['at'] as string) ?? '';

  return {
    id,
    testo: (data['testo'] as string) ?? '',
    at,
    updatedAt: (data['updatedAt'] as string) ?? at,
    ...(data['conversazione'] ? { conversazione: data['conversazione'] as string } : {}),
    origine: data['origine'] === 'cliente' ? 'cliente' : 'assistente',
  };
}
