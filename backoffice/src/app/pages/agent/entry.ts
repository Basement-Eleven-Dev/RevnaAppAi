import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  AREE_TEMATICHE,
  formatSize,
  stimaToken,
  TIPI_CONOSCENZA,
  type KnowledgeEntry,
} from '../../core/agent.model';
import { AgentService } from '../../core/agent.service';

/**
 * Una voce di conoscenza, scritta a mano o nata da un file.
 *
 * La pagina è una sola per entrambe perché tutto quello che le distingue è il
 * contenuto: titolo, tipo, aree tematiche e interruttore sono gli stessi campi, e
 * duplicare la pagina vorrebbe dire mantenerli due volte.
 *
 * Su una voce-documento il testo estratto si vede ma non si scrive: la fonte di
 * verità è il file, e una modifica a mano sparirebbe alla prima rielaborazione.
 * Se il testo non va bene, si corregge il documento e si ricarica.
 */
@Component({
  selector: 'app-agent-entry',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './entry.html',
  styleUrl: './agent.css',
})
export class AgentEntry {
  private readonly agent = inject(AgentService);
  private readonly router = inject(Router);

  protected readonly tipi = TIPI_CONOSCENZA;
  protected readonly aree = AREE_TEMATICHE;
  protected readonly stimaToken = stimaToken;
  protected readonly formatSize = formatSize;

  /** `nuova` nell'URL significa voce da creare: l'id vero lo assegna Firestore al salvataggio. */
  private readonly param = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? 'nuova';
  protected readonly id = signal(this.param === 'nuova' ? '' : this.param);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    titolo: ['', Validators.required],
    tipo: ['metodo'],
    contenuto: ['', Validators.required],
    attivo: [true],
  });

  protected readonly tags = signal<string[]>([]);
  /** La voce caricata, quando è un documento: qui sta il file e l'esito della lettura. */
  protected readonly voce = signal<KnowledgeEntry | null>(null);
  protected readonly documento = computed(() => this.voce()?.formato === 'file');

  protected readonly loading = signal(this.param !== 'nuova');
  protected readonly saving = signal(false);
  protected readonly rileggendo = signal(false);
  protected readonly saved = signal('');
  protected readonly error = signal('');

  constructor() {
    if (this.param !== 'nuova') void this.load(this.param);
    this.form.valueChanges.subscribe(() => this.saved.set(''));
  }

  private async load(id: string): Promise<void> {
    try {
      const entry = await this.agent.entry(id);
      if (!entry) {
        this.error.set('Questa voce non esiste più.');
        return;
      }
      this.voce.set(entry);
      this.form.patchValue(entry);
      this.tags.set(entry.tags);
      // Il testo di un documento è di sola lettura: la fonte di verità è il file.
      if (entry.formato === 'file') this.form.controls.contenuto.disable();
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.loading.set(false);
    }
  }

  protected toggleTag(tag: string): void {
    this.tags.update((list) =>
      list.includes(tag) ? list.filter((item) => item !== tag) : [...list, tag],
    );
    this.saved.set('');
  }

  protected async save(): Promise<void> {
    const { titolo, tipo, attivo, contenuto } = this.form.getRawValue();

    if (!titolo.trim()) {
      this.error.set('Il titolo è necessario: è il nome con cui l’assistente cita la voce.');
      return;
    }
    if (!this.documento() && !contenuto.trim()) {
      this.error.set('Senza contenuto la voce non è citabile.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    try {
      if (this.documento()) {
        await this.agent.saveFileEntry(this.id(), { titolo, tipo, tags: this.tags(), attivo });
      } else {
        // Una voce nuova prende ora il suo id: senza aggiornarlo, un secondo
        // salvataggio creerebbe un doppione invece di aggiornare la stessa voce.
        this.id.set(
          await this.agent.saveEntry(this.id(), {
            titolo,
            tipo,
            contenuto,
            attivo,
            tags: this.tags(),
          }),
        );
      }
      this.saved.set('Salvato. L’assistente la usa entro un minuto.');
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.saving.set(false);
    }
  }

  /** Rilegge il file e riscrive il testo: serve quando la prima estrazione è fallita. */
  protected async rileggi(): Promise<void> {
    this.rileggendo.set(true);
    this.error.set('');
    try {
      await this.agent.ingest(this.id());
      await this.load(this.id());
      this.saved.set('Documento riletto.');
    } catch (cause) {
      this.error.set(message(cause));
      await this.load(this.id());
    } finally {
      this.rileggendo.set(false);
    }
  }

  protected async apri(): Promise<void> {
    try {
      window.open(await this.agent.fileUrl(this.id()), '_blank');
    } catch (cause) {
      this.error.set(message(cause));
    }
  }

  protected async remove(): Promise<void> {
    const voce = this.voce();
    if (!this.id()) return;
    if (!confirm('Eliminare questa voce? L’assistente non potrà più citarla.')) return;

    try {
      await this.agent.deleteEntry({ id: this.id(), file: voce?.file ?? null });
      await this.router.navigate(['/assistente/conoscenza']);
    } catch (cause) {
      this.error.set(message(cause));
    }
  }
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Operazione non riuscita.';
}
