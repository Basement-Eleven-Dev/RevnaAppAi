import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

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
      await this.router.navigate(['/clienti']);
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
    case 'auth/too-many-requests':
      return 'Troppi tentativi. Riprova tra qualche minuto.';
    case undefined:
      return cause instanceof Error ? cause.message : 'Accesso non riuscito.';
    default:
      return `Accesso non riuscito (${code}).`;
  }
}
