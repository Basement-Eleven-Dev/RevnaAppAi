import { Injectable, signal } from '@angular/core';
import { onIdTokenChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';

import { getFirebaseAuth } from './firebase';

/** Errore mostrato quando un utente valido non è però un referente Revna. */
export const NOT_ADMIN = 'Questo account non ha i permessi per il backoffice.';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = getFirebaseAuth();

  readonly user = signal<User | null>(null);
  readonly isAdmin = signal(false);

  // `onIdTokenChanged` e non `onAuthStateChanged`: scatta anche a ogni rinnovo del
  // token, ed è lì che si scopre un claim tolto o un account disattivato.
  private readonly firstAnswer = new Promise<void>((resolve) => {
    onIdTokenChanged(this.auth, async (user) => {
      let admin = false;
      try {
        admin = user ? await this.hasAdminClaim(user) : false;
      } catch {
        // Senza rete il claim non si verifica: meglio il login di una pagina bianca.
      }
      // Nel frattempo la sessione può essere cambiata: vale solo l'ultima risposta.
      if (this.auth.currentUser === user) {
        this.user.set(user);
        this.isAdmin.set(admin);
      }
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

    // Senza aspettare l'ascoltatore: la guardia della pagina successiva legge subito questi.
    this.user.set(credential.user);
    this.isAdmin.set(true);
  }

  signOut(): Promise<void> {
    return signOut(this.auth);
  }

  private async hasAdminClaim(user: User): Promise<boolean> {
    // Senza forzare il rinnovo: dentro `onIdTokenChanged` lo farebbe riscattare
    // all'infinito, e dopo il login il token è già nuovo.
    const token = await user.getIdTokenResult();
    return token.claims['revnaAdmin'] === true;
  }
}
