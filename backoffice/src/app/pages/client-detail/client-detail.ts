import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ProfileFields } from '../../components/profile-fields/profile-fields';
import { ClientsService } from '../../core/clients.service';
import { buildProfileForm, readProfileForm, type ProfileForm } from '../../core/profile-form';
import { Shell } from '../../core/shell';

@Component({
  selector: 'app-client-detail',
  imports: [ReactiveFormsModule, RouterLink, Shell, ProfileFields],
  templateUrl: './client-detail.html',
  styleUrl: './client-detail.css',
})
export class ClientDetail {
  private readonly clients = inject(ClientsService);
  private readonly fb = inject(FormBuilder);

  protected readonly uid = inject(ActivatedRoute).snapshot.paramMap.get('uid') ?? '';

  protected readonly form = signal<ProfileForm | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal('');
  /** Note scritte dal cliente: le mostriamo, non le modifichiamo. */
  protected readonly noteCliente = signal('');

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const profile = await this.clients.profile(this.uid);
      this.noteCliente.set(profile.noteCliente);
      this.form.set(buildProfileForm(this.fb, profile));
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.loading.set(false);
    }
  }

  protected async save(): Promise<void> {
    const form = this.form();
    if (!form || this.saving()) return;

    this.saving.set(true);
    this.saved.set(false);
    this.error.set('');
    try {
      await this.clients.saveProfile(this.uid, readProfileForm(form));
      this.saved.set(true);
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.saving.set(false);
    }
  }
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Operazione non riuscita.';
}
