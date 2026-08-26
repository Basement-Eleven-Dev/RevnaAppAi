import { Component, computed, inject, signal } from '@angular/core';

import { AgentService, type PreviewDiagnostics, type PreviewTurn } from '../../core/agent.service';
import { ClientsService, type Client } from '../../core/clients.service';
import { renderMarkdown } from './markdown';

/**
 * Prova l'assistente fingendosi un albergatore.
 *
 * Serve a chi scrive la personalità e la base di conoscenza: senza questa pagina,
 * per vedere l'effetto di una modifica bisognerebbe entrare nell'app come cliente.
 *
 * La conversazione **non viene salvata da nessuna parte** — non deve comparire nello
 * storico del cliente una chat che non ha avuto. Per questo i turni vivono qui nello
 * stato del componente e vengono rimandati al server a ogni domanda: cambiando cliente
 * o ricaricando la pagina, la prova sparisce. È voluto.
 *
 * Il valore vero non è la chat ma la diagnostica accanto: quali voci sono entrate in
 * contesto, quali sono state citate davvero, e il prompt esatto che è stato inviato.
 * È lì che si capisce *perché* ha risposto così.
 */
@Component({
  selector: 'app-agent-prova',
  imports: [],
  templateUrl: './prova.html',
  styleUrl: './agent.css',
})
export class AgentProva {
  private readonly agent = inject(AgentService);
  private readonly clientsService = inject(ClientsService);

  protected readonly renderMarkdown = renderMarkdown;

  protected readonly clienti = signal<Client[]>([]);
  protected readonly uid = signal('');
  protected readonly spunti = signal<string[]>([]);

  protected readonly turns = signal<PreviewTurn[]>([]);
  protected readonly draft = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  /** Errore del caricamento iniziale: va detto sopra, non dentro la chat che non c'è. */
  protected readonly loadError = signal('');
  protected readonly loading = signal(true);

  protected readonly diagnostics = signal<PreviewDiagnostics | null>(null);
  protected readonly mostraPrompt = signal(false);

  constructor() {
    void this.load();
  }

  /**
   * Clienti e spunti, ma separatamente.
   *
   * Erano una `Promise.all`, ed è il motivo per cui la tendina restava vuota: se la
   * lettura della personalità falliva — regole non ancora pubblicate, documento
   * inesistente — cadeva anche l'elenco dei clienti, che con quella lettura non
   * c'entra niente. Sono due dati indipendenti e ora falliscono in modo indipendente:
   * senza spunti si prova lo stesso scrivendo la domanda, senza clienti no.
   */
  private async load(): Promise<void> {
    try {
      const clienti = await this.clientsService.list();
      // Solo i clienti attivi: provare l'assistente su un'utenza disattivata
      // risponderebbe a una domanda che nessuno può più fare.
      this.clienti.set(clienti.filter((cliente) => !cliente.disabled));
    } catch (cause) {
      this.loadError.set(`Elenco dei clienti non caricato. ${message(cause)}`);
    } finally {
      this.loading.set(false);
    }

    try {
      this.spunti.set((await this.agent.config()).spunti);
    } catch {
      // Gli spunti sono una comodità: senza, si scrive la domanda a mano.
    }
  }

  protected readonly cliente = computed(() => this.clienti().find((row) => row.uid === this.uid()));

  /** Cambiare struttura azzera la prova: il contesto era di un'altra. */
  protected onCliente(value: string): void {
    this.uid.set(value);
    this.reset();
  }

  protected reset(): void {
    this.turns.set([]);
    this.diagnostics.set(null);
    this.error.set('');
  }

  protected async ricarica(): Promise<void> {
    this.loadError.set('');
    this.loading.set(true);
    await this.load();
  }

  protected async send(text: string): Promise<void> {
    const question = text.trim();
    if (!question || this.busy() || !this.uid()) return;

    const history = this.turns();
    this.turns.set([...history, { role: 'user', text: question }]);
    this.draft.set('');
    this.busy.set(true);
    this.error.set('');

    const show = (answer: string, sources?: PreviewTurn['sources']) =>
      this.turns.set([
        ...history,
        { role: 'user', text: question },
        { role: 'model', text: answer, ...(sources?.length ? { sources } : {}) },
      ]);

    try {
      let streamed = '';
      const answer = await this.agent.preview(
        { uid: this.uid(), message: question, history },
        (chunk) => {
          streamed += chunk;
          show(streamed);
        },
      );
      show(answer.text, answer.sources);
      this.diagnostics.set(answer.diagnostics);
    } catch (cause) {
      this.error.set(message(cause));
      // La domanda resta a schermo: si può ritentare senza riscriverla.
      this.turns.set([...history, { role: 'user', text: question }]);
    } finally {
      this.busy.set(false);
    }
  }
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Prova non riuscita.';
}
