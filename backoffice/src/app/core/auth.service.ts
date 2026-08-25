import { Injectable, signal } from '@angular/core';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';

import { getFirebaseAuth } from './firebase';

/** Errore mostrato quando un utente valido non è però un referente Revna. */
export const NOT_ADMIN = 'Questo account non ha i permessi per il backoffice.';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = getFirebaseAuth();

  readonly user = signal<User | null>(null);
  readonly isAdmin = signal(false);
  /** false finché Firebase non ha detto se c'è una sessione attiva. */
  readonly ready = signal(false);

  private readonly firstAnswer = new Promise<void>((resolve) => {
    onAuthStateChanged(this.auth, async (user) => {
      this.user.set(user);
      this.isAdmin.set(user ? await this.hasAdminClaim(user) : false);
      this.ready.set(true);
      resolve();
    });
  });

  /** Attende la prima risposta di Firebase: serve alle guardie di rotta. */
  whenReady(): Promise<void> {
    return this.firstAnswer;
  }

  async signIn(email: string, password: string): Promise<void> {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);

    if (!(await this.hasAdminClaim(credential.user))) {
      // Le credenziali sono valide, ma è un cliente dell'app, non un referente:
      // chiudiamo subito la sessione invece di lasciarlo in un backoffice vuoto.
      await this.signOut();
      throw new Error(NOT_ADMIN);
    }
  }

  signOut(): Promise<void> {
    return signOut(this.auth);
  }

  private async hasAdminClaim(user: User): Promise<boolean> {
    // forza il refresh: il claim può essere stato assegnato dopo il login.
    const token = await user.getIdTokenResult(true);
    return token.claims['revnaAdmin'] === true;
  }
}
