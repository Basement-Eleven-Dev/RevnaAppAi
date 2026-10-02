import type { Unsubscribe } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { isFirebaseConfigured } from '@/lib/firebase';

export type Subscribe<T> = (
  uid: string,
  onData: (data: T) => void,
  onError: (cause: unknown) => void
) => Unsubscribe;

/**
 * Dati dell'utente in ascolto live, con lo stesso comportamento in tutta l'app.
 *
 * Ciò che arriva resta legato all'uid per cui è arrivato, e si mostra solo se è
 * ancora quello dell'utente attuale: finché per lui non c'è niente si è «in
 * caricamento», mai «vuoto», e dopo un cambio d'account dati ed errori del
 * precedente non si vedono nemmeno per un istante. Uno snapshot riuscito azzera
 * l'errore.
 *
 * `subscribe` ed `empty` vanno definiti fuori dal componente: sono le dipendenze
 * dell'ascolto, e cambiandoli a ogni render lo si riaprirebbe ogni volta.
 */
export function useLiveData<T>(subscribe: Subscribe<T>, empty: T) {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid ?? null;
  const [received, setReceived] = useState<{ uid: string; data: T; error: unknown } | null>(
    null
  );

  useEffect(() => {
    if (!isFirebaseConfigured || !uid) return;

    return subscribe(
      uid,
      (data) => setReceived({ uid, data, error: null }),
      (error) =>
        setReceived((previous) => ({
          uid,
          data: previous?.uid === uid ? previous.data : empty,
          error,
        }))
    );
  }, [uid, subscribe, empty]);

  const current = uid !== null && received?.uid === uid ? received : null;

  return {
    data: current ? current.data : empty,
    loading: isFirebaseConfigured && (authLoading || (uid !== null && current === null)),
    error: current ? current.error : null,
  };
}
