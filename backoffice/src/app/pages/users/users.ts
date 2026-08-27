import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ProfileFields } from '../../components/profile-fields/profile-fields';
import { ClientsService, type Invite } from '../../core/clients.service';
import { buildProfileForm, readProfileForm } from '../../core/profile-form';

type Created = Invite & { email: string };

@Component({
  selector: 'app-users',
  imports: [ReactiveFormsModule, RouterLink, ProfileFields],
  templateUrl: './users.html',
  styleUrl: './users.css',
})
export class Users {
  private readonly clients = inject(ClientsService);
  private readonly fb = inject(FormBuilder);

  protected readonly account = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });
  protected readonly profile = buildProfileForm(this.fb);

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  /** Utenze create in questa sessione, la più recente in cima. */
  protected readonly created = signal<Created[]>([]);
  protected readonly copied = signal('');

  protected async submit(): Promise<void> {
    if (this.account.invalid || this.busy()) return;

    this.busy.set(true);
    this.error.set('');

    const email = this.account.controls.email.value.trim().toLowerCase();
    try {
      const invite = await this.clients.createInvite(email, readProfileForm(this.profile));
      this.created.update((list) => [{ ...invite, email }, ...list]);
      this.account.reset();
      this.profile.reset();
    } catch (cause) {
      this.error.set(cause instanceof Error ? cause.message : 'Creazione non riuscita.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async copy(link: string): Promise<void> {
    await navigator.clipboard.writeText(link);
    this.copied.set(link);
  }
}
