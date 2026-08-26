import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ClientsService } from '../../core/clients.service';
import {
  byDay,
  domande,
  formatDate,
  formatDateTime,
  formatTime,
  type Conversation,
} from '../../core/conversations.model';
import { ConversationsService } from '../../core/conversations.service';

/**
 * Le conversazioni di un cliente con l'assistente, in sola lettura.
 *
 * Due colonne e non un elenco a fisarmonica: un consulente cerca una cosa
 * precisa dentro uno storico, e passare da una conversazione all'altra deve
 * costare un clic senza perdere di vista l'elenco. Le conversazioni arrivano
 * complete dalla prima lettura, quindi cambiare selezione non attende nulla.
 *
 * Da qui non si cancella e non si risponde: la chat è del cliente, e l'unico a
 * scriverci è `askAssistant`.
 */
@Component({
  selector: 'app-client-conversations',
  imports: [RouterLink],
  templateUrl: './client-conversations.html',
  styleUrl: './client-conversations.css',
})
export class ClientConversations {
  private readonly conversations = inject(ConversationsService);
  private readonly clients = inject(ClientsService);

  protected readonly uid = inject(ActivatedRoute).snapshot.paramMap.get('uid') ?? '';
  protected readonly formatDateTime = formatDateTime;
  protected readonly formatTime = formatTime;
  protected readonly domande = domande;

  protected readonly list = signal<Conversation[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  /** Nome della struttura, per sapere di chi si stanno leggendo le chat. */
  protected readonly struttura = signal('');
  protected readonly selectedId = signal('');

  protected readonly giorni = computed(() => byDay(this.list()));

  protected readonly selected = computed(
    () => this.list().find((conversation) => conversation.id === this.selectedId()) ?? null
  );

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const list = await this.conversations.list(this.uid);
      this.list.set(list);
      // La più recente è quella che interessa quasi sempre: aprila da sé, così
      // la pagina non si presenta come una colonna e un vuoto.
      this.selectedId.set(list[0]?.id ?? '');
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.loading.set(false);
    }

    // Il nome è un contorno: se non arriva, la pagina resta leggibile.
    try {
      this.struttura.set((await this.clients.profile(this.uid)).struttura.nome);
    } catch {
      this.struttura.set('');
    }
  }

  protected select(id: string): void {
    this.selectedId.set(id);
  }

  /** Titolo di ripiego per le conversazioni salvate senza titolo. */
  protected titolo(conversation: Conversation): string {
    return conversation.title || 'Senza titolo';
  }

  /**
   * L'ora del singolo turno, quando c'è.
   *
   * I turni scritti prima che il campo esistesse non la hanno: meglio niente che
   * ripetere sotto ogni messaggio l'ora della conversazione, che sarebbe falsa.
   */
  protected oraTurno(at: string | undefined): string {
    return at ? formatTime(at) : '';
  }

  protected giorno(iso: string): string {
    return formatDate(iso);
  }
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Operazione non riuscita.';
}
