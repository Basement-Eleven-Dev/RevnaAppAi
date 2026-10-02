import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

import { useAuth } from '@/hooks/use-auth';
import { useLiveData, type Subscribe } from '@/hooks/use-live-data';
import { getFirebaseDb } from '@/lib/firebase';
import { EMPTY_PROFILE, type ClientProfile } from '@/lib/profile';

const subscribe: Subscribe<ClientProfile | null> = (uid, onData, onError) =>
  onSnapshot(
    doc(getFirebaseDb(), 'users', uid),
    (snapshot) => {
      const stored = snapshot.data()?.profile as Partial<ClientProfile> | undefined;
      onData(stored ? { ...EMPTY_PROFILE, ...stored } : null);
    },
    onError
  );

/**
 * Profilo della struttura, redatto da Revna e tenuto in `users/{uid}`.
 * In ascolto live: se il consulente lo aggiorna, l'app se ne accorge.
 */
export function useClientProfile() {
  const { user } = useAuth();
  const { data: profile, loading, error } = useLiveData(subscribe, null);

  async function saveNote(note: string) {
    if (!user) return;
    // Le regole Firestore ammettono dal client solo questo campo: il resto del
    // profilo lo scrive Revna e non deve poter essere sovrascritto da qui.
    await updateDoc(doc(getFirebaseDb(), 'users', user.uid), {
      'profile.noteCliente': note,
      updatedAt: new Date().toISOString(),
    });
  }

  return { profile, loading, error, saveNote };
}
