import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  AREE_TEMATICHE,
  FILE_ACCETTATI,
  formatSize,
  MAX_FILE_BYTES,
  SOGLIA_SELEZIONE_CHARS,
  stimaToken,
  TIPI_CONOSCENZA,
  tipoLabel,
  type KnowledgeEntry,
} from '../../core/agent.model';
import { AgentService } from '../../core/agent.service';

/**
 * Elenco delle voci di conoscenza, e il posto da cui si caricano i documenti.
 *
 * Le due porte d'ingresso stanno una accanto all'altra perché sono alternative,
 * non gerarchie: «Nuova voce» per il materiale riformulato a mano, «Carica file»
 * per un documento da mettere dentro così com'è. La seconda non porta da nessuna
 * parte — il file parte da qui e la voce compare nella tabella — perché una pagina
 * intermedia per scegliere un file e premere Carica non aggiungerebbe niente.
 *
 * Il dato che conta in cima alla pagina è il peso complessivo: finché la conoscenza
 * attiva sta sotto la soglia, l'assistente la riceve tutta a ogni domanda e non
 * sbaglia mai a scegliere. Sopra, comincia a selezionare — funziona, ma è il momento
 * in cui titoli e aree tematiche smettono di essere estetica e diventano il modo in
 * cui il materiale viene ritrovato. I documenti caricati pesano parecchio: è la
 * ragione per cui questa barra sta prima della tabella e non dopo.
 */
@Component({
  selector: 'app-agent-knowledge',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './knowledge.html',
  styleUrl: './agent.css',
})
export class AgentKnowledge {
  private readonly agent = inject(AgentService);

  protected readonly tipi = TIPI_CONOSCENZA;
  protected readonly aree = AREE_TEMATICHE;
  protected readonly tipoLabel = tipoLabel;
  protected readonly stimaToken = stimaToken;
  protected readonly formatSize = formatSize;
  protected readonly accettati = FILE_ACCETTATI;
  protected readonly soglia = SOGLIA_SELEZIONE_CHARS;

  protected readonly filtri = inject(FormBuilder).nonNullable.group({
    testo: [''],
    tipo: [''],
    tag: [''],
    formato: [''],
  });
  /** Copia dei filtri come signal: il form da solo non farebbe ricalcolare `visibili`. */
  protected readonly filtro = signal({ testo: '', tipo: '', tag: '', formato: '' });

  protected readonly voci = signal<KnowledgeEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  /** Nome del file in caricamento, percentuale, e fase: caricare e leggere sono due attese diverse. */
  protected readonly caricando = signal('');
  protected readonly progress = signal(0);
  protected readonly leggendo = signal(false);

  protected readonly attive = computed(() => this.voci().filter((voce) => voce.attivo));

  protected readonly conteggio = computed(() => {
    const attive = this.attive().length;
    return `${attive} ${attive === 1 ? 'voce attiva' : 'voci attive'} su ${this.voci().length}`;
  });

  /** Caratteri della sola conoscenza attiva: è quella che entra nel contesto. */
  protected readonly peso = computed(() =>
    this.attive().reduce((sum, voce) => sum + voce.contenuto.length, 0),
  );

  protected readonly percentuale = computed(() =>
    Math.min(100, Math.round((this.peso() / this.soglia) * 100)),
  );

  protected readonly visibili = computed(() => {
    const { testo, tipo, tag, formato } = this.filtro();
    const cerca = testo.trim().toLowerCase();

    return this.voci().filter((voce) => {
      if (formato && voce.formato !== formato) return false;
      if (tipo && voce.tipo !== tipo) return false;
      if (tag && !voce.tags.includes(tag)) return false;
      if (!cerca) return true;
      return `${voce.titolo} ${voce.file?.name ?? ''} ${voce.tags.join(' ')}`
        .toLowerCase()
        .includes(cerca);
    });
  });

  constructor() {
    void this.reload();
    this.filtri.valueChanges.subscribe(() => this.filtro.set(this.filtri.getRawValue()));
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    try {
      this.voci.set(await this.agent.knowledge());
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Un file alla volta, in sequenza.
   *
   * Se uno fallisce ci si ferma: gli altri restano da caricare, ma l'errore è di
   * quel file e si vede quale. Continuare lascerebbe un elenco di errori da leggere
   * a fine corsa, quando la barra è già sparita.
   */
  protected async onFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;

    this.error.set('');

    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        this.error.set(
          `${file.name}: ${formatSize(file.size)} sono troppi, il limite è ${formatSize(MAX_FILE_BYTES)}.`,
        );
        break;
      }

      this.caricando.set(file.name);
      this.progress.set(0);
      this.leggendo.set(false);

      try {
        await this.agent.uploadFile({
          file,
          tipo: 'documento',
          tags: [],
          onProgress: (percent) => {
            this.progress.set(percent);
            // A caricamento finito comincia l'estrazione, che non ha una percentuale.
            if (percent === 100) this.leggendo.set(true);
          },
        });
      } catch (cause) {
        // La voce resta, sospesa e con l'errore dentro: si riapre e si riprova.
        this.error.set(`${file.name}: ${message(cause)}`);
        break;
      }
    }

    this.caricando.set('');
    this.leggendo.set(false);
    await this.reload();
  }

  protected async toggle(voce: KnowledgeEntry): Promise<void> {
    try {
      await this.agent.setAttivo(voce.id, !voce.attivo);
      this.voci.update((list) =>
        list.map((row) => (row.id === voce.id ? { ...row, attivo: !voce.attivo } : row)),
      );
    } catch (cause) {
      this.error.set(message(cause));
    }
  }

  protected async remove(voce: KnowledgeEntry): Promise<void> {
    if (!confirm(`Eliminare «${voce.titolo}»? L'assistente non potrà più citarla.`)) return;

    try {
      await this.agent.deleteEntry(voce);
      this.voci.update((list) => list.filter((row) => row.id !== voce.id));
    } catch (cause) {
      this.error.set(message(cause));
    }
  }

  protected date(iso: string): string {
    return iso ? new Date(iso).toLocaleDateString('it-IT') : '—';
  }
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Operazione non riuscita.';
}
