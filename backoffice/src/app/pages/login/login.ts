import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService, NOT_ADMIN } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly da = inject(ActivatedRoute).snapshot.queryParamMap.get('da');

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) return;

    this.busy.set(true);
    this.error.set('');

    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.signIn(email, password);
      await this.router.navigateByUrl(internalUrl(this.da) ?? '/clienti');
    } catch (cause) {
      this.error.set(describeAuthError(cause));
    } finally {
      this.busy.set(false);
    }
  }
}

function describeAuthError(cause: unknown): string {
  const code = (cause as { code?: string }).code;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email o password non corretti.';
    case 'auth/invalid-email':
      return "L'indirizzo email non è valido.";
    case 'auth/user-disabled':
      return 'Questo account è stato disattivato.';
    case 'auth/too-many-requests':
      return 'Troppi tentativi. Riprova tra qualche minuto.';
    case 'auth/network-request-failed':
      return 'Connessione assente. Controlla la rete e riprova.';
  }
  if (cause instanceof Error && cause.message === NOT_ADMIN) return NOT_ADMIN;
  console.error(cause);
  return 'Accesso non riuscito. Riprova tra poco.';
}

/** Solo percorsi di questo sito: `da` arriva dall'indirizzo e chiunque può scriverlo. */
function internalUrl(da: string | null): string | null {
  if (!da?.startsWith('/') || da.startsWith('//') || da.startsWith('/login')) return null;
  return da;
}
