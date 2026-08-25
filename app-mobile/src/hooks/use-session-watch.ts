import { signOut } from 'firebase/auth';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase';

/** Ogni quanto ricontrollare la sessione mentre l'app è in primo piano. */
const INTERVAL_MS = 5 * 60 * 1000;

/**
 * Butta fuori l'utente se il backoffice ha disattivato la sua utenza.
 *
 * Disattivare un account non invalida l'ID token già in mano al client, che vive
 * fino a un'ora. Forzando il rinnovo — all'apertura dell'app e a intervalli — il
 * token revocato viene rifiutato e chiudiamo la sessione subito.
 */
export function useSessionWatch(): void {
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const auth = getFirebaseAuth();

    async function check() {
      const user = auth.currentUser;
      if (!user) return;

      try {
        await user.getIdToken(true);
      } catch {
        // Utenza disattivata, cancellata o token revocato.
        await signOut(auth).catch(() => {});
      }
    }

    void check();
    const timer = setInterval(check, INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
}
