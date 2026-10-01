import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ClientsService, type Client, type Invite } from '../../core/clients.service';

@Component({
  selector: 'app-clients',
  imports: [FormsModule, RouterLink],
  templateUrl: './clients.html',
  styleUrl: './clients.css',
})
export class Clients {
  private readonly clients = inject(ClientsService);

  protected readonly list = signal<Client[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  /** uid dell'utenza su cui è in corso un'operazione. */
  protected readonly pending = signal('');
  /** uid della riga in modifica, e valore corrente del campo nome. */
  protected readonly editing = signal('');
  protected draftName = '';
  /** L'ultimo invito rimandato, col link da consegnare a mano se l'email non è partita. */
  protected readonly invited = signal<(Invite & { email: string }) | null>(null);
  protected readonly copied = signal('');

  constructor() {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.list.set(await this.clients.list());
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.loading.set(false);
    }
  }

  protected startEdit(client: Client): void {
    this.editing.set(client.uid);
    this.draftName = client.displayName ?? '';
  }

  protected cancelEdit(): void {
    this.editing.set('');
  }

  protected async saveName(client: Client): Promise<void> {
    await this.run(client.uid, () => this.clients.rename(client.uid, this.draftName));
    this.editing.set('');
  }

  protected async toggle(client: Client): Promise<void> {
    await this.run(client.uid, () => this.clients.setDisabled(client.uid, !client.disabled));
  }

  protected async resend(client: Client): Promise<void> {
    await this.run(client.uid, async () => {
      const invite = await this.clients.resendInvite(client.uid);
      this.invited.set({ ...invite, email: client.email });
    });
  }

  protected async copy(link: string): Promise<void> {
    await navigator.clipboard.writeText(link);
    this.copied.set(link);
  }

  private async run(uid: string, action: () => Promise<void>): Promise<void> {
    this.pending.set(uid);
    this.error.set('');
    try {
      await action();
      await this.reload();
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.pending.set('');
    }
  }

  protected date(value: string | null): string {
    return value ? new Date(value).toLocaleDateString('it-IT') : '—';
  }
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Operazione non riuscita.';
}
