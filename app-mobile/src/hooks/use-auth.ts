import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';

import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase';

/**
 * Stato di autenticazione corrente. `loading` è true finché Firebase non ha risposto.
 * Se Firebase non è ancora configurato resta semplicemente "nessun utente",
 * senza far crashare l'app.
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    return onAuthStateChanged(getFirebaseAuth(), (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  return { user, loading, isSignedIn: user !== null };
}
