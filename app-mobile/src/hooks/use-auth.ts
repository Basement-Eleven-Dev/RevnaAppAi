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

/**
 * Se chi è entrato è un referente Revna (claim `revnaAdmin`): `null` finché non si sa.
 *
 * L'app è per i clienti, e un referente che vi accede vedrebbe un'area riservata
 * vuota, registrando per di più il telefono alle notifiche. Il claim si legge dal
 * token già in mano, senza rinnovarlo, quindi funziona anche offline; se nemmeno così
 * si riesce, si entra come cliente — è un rifiuto di cortesia, i dati li proteggono
 * le regole.
 */
export function useIsRevnaAdmin(user: User | null): boolean | null {
  const [checked, setChecked] = useState<{ uid: string; admin: boolean } | null>(null);

  useEffect(() => {
    if (!user) return;

    let alive = true;
    void user
      .getIdTokenResult()
      .then((token) => token.claims['revnaAdmin'] === true)
      .catch(() => false)
      .then((admin) => {
        if (alive) setChecked({ uid: user.uid, admin });
      });

    return () => {
      alive = false;
    };
  }, [user]);

  if (!user) return false;
  return checked?.uid === user.uid ? checked.admin : null;
}
