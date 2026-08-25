import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { getFirebaseDb, isFirebaseConfigured } from '@/lib/firebase';
import { EMPTY_PROFILE, type ClientProfile } from '@/lib/profile';

type State = {
  profile: ClientProfile | null;
  loading: boolean;
  error: string;
};

/**
 * Profilo della struttura, redatto da Revna e tenuto in `users/{uid}`.
 * In ascolto live: se il consulente lo aggiorna, l'app se ne accorge.
 */
export function useClientProfile(): State & {
  saveNote: (note: string) => Promise<void>;
} {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ profile: null, loading: true, error: '' });

  useEffect(() => {
    if (!isFirebaseConfigured || !user) {
      setState({ profile: null, loading: false, error: '' });
      return;
    }

    return onSnapshot(
      doc(getFirebaseDb(), 'users', user.uid),
      (snapshot) => {
        const stored = snapshot.data()?.profile as Partial<ClientProfile> | undefined;
        setState({
          profile: stored ? { ...EMPTY_PROFILE, ...stored } : null,
          loading: false,
          error: '',
        });
      },
      (cause) => setState({ profile: null, loading: false, error: cause.message })
    );
  }, [user]);

  async function saveNote(note: string) {
    if (!user) return;
    // Le regole Firestore ammettono dal client solo questo campo: il resto del
    // profilo lo scrive Revna e non deve poter essere sovrascritto da qui.
    await updateDoc(doc(getFirebaseDb(), 'users', user.uid), {
      'profile.noteCliente': note,
      updatedAt: new Date().toISOString(),
    });
  }

  return { ...state, saveNote };
}
