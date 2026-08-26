import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  attesa,
  formatDateTime,
  isAperta,
  ORIGINE_LABEL,
  STATI,
  STATO_HINT,
  STATO_LABEL,
  type ContactRequest,
  type Stato,
} from '../../core/requests.model';
import { RequestsService } from '../../core/requests.service';

/** I filtri dell'elenco: quello che è aperto, o tutto. */
type Filtro = 'aperte' | 'tutte';

/**
 * La coda delle richieste di contatto.
 *
 * È il capolinea di quello che l'assistente non ha potuto risolvere: se una richiesta
 * resta qui senza che nessuno la guardi, il cliente ha chiesto di parlare con una
 * persona e non è arrivato nessuno. Per questo la pagina parte dalle richieste aperte
 * e dice da quanto aspettano, invece di presentare uno storico completo.
 *
 * Due colonne come per le conversazioni: l'elenco è una coda da lavorare, e passare
 * da una richiesta all'altra deve costare un clic. Le richieste arrivano complete
 * dalla prima lettura, quindi cambiare selezione non attende nulla.
 *
 * Con `?cliente=<uid>` mostra solo quelle di un cliente: è la strada da cui si arriva
 * dalla sua scheda, dove la domanda è «cosa mi ha chiesto questo qui».
 */
@Component({
  selector: 'app-requests',
  imports: [RouterLink],
  templateUrl: './requests.html',
  styleUrl: './requests.css',
})
export class Requests {
  private readonly requests = inject(RequestsService);
  private readonly route = inject(ActivatedRoute);

  protected readonly stati = STATI;
  protected readonly statoLabel = STATO_LABEL;
  protected readonly statoHint = STATO_HINT;
  protected readonly origineLabel = ORIGINE_LABEL;
  protected readonly formatDateTime = formatDateTime;
  protected readonly attesa = attesa;

  protected readonly list = signal<ContactRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly filtro = signal<Filtro>('aperte');
  protected readonly selectedId = signal('');
  /** uid del cliente su cui la pagina è ristretta, vuoto se le mostra tutte. */
  protected readonly cliente = signal('');
  /** Richiesta su cui è in corso un cambio di stato. */
  protected readonly pending = signal('');

  protected readonly visible = computed(() =>
    this.filtro() === 'tutte' ? this.list() : this.list().filter(isAperta)
  );

  protected readonly daLavorare = computed(() => this.list().filter(isAperta).length);

  protected readonly selected = computed(
    () => this.list().find((request) => request.id === this.selectedId()) ?? null
  );

  constructor() {
    // In ascolto e non letto una volta: da «Richieste» del cliente si arriva qui con
    // un `cliente` diverso senza cambiare rotta, e il costruttore non rigirerebbe.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.cliente.set(params.get('cliente') ?? '');
      void this.load();
    });
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const uid = this.cliente();
      const list = await this.requests.list(uid || undefined);
      this.list.set(list);

      // La più recente fra quelle in elenco: la pagina non deve presentarsi come
      // una colonna e un vuoto. Aprirla così non la segna come visualizzata —
      // quello lo fa solo un clic, vedi `select`.
      const first = this.visible()[0];
      this.selectedId.set(first?.id ?? '');
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Apre una richiesta dall'elenco e, se nessuno l'aveva ancora aperta, la segna
   * come visualizzata.
   *
   * È il solo passaggio di stato automatico, ed è automatico perché è esattamente
   * quello che è appena successo: qualcuno l'ha vista. Lasciarlo a un bottone
   * significherebbe che al cliente resta scritto «inviata» finché non ci si ricorda
   * di premerlo, cioè che lo stato dice una cosa falsa nel momento in cui conta.
   */
  protected select(request: ContactRequest): void {
    this.selectedId.set(request.id);
    if (request.stato === 'inviata') void this.setStato(request, 'visualizzata');
  }

  /**
   * Chi è il referente, in una riga. Composto qui e non nel template perché è una
   * frase con due pezzi facoltativi: nel markup diventerebbe un incastro di blocchi
   * per una virgola.
   */
  protected referente(request: ContactRequest): string {
    const { nome, ruolo } = request.contatto;
    if (!nome) return 'Referente non indicato nel profilo';
    return ruolo ? `${nome}, ${ruolo}` : nome;
  }

  protected async setStato(request: ContactRequest, stato: Stato): Promise<void> {
    if (request.stato === stato) return;

    this.pending.set(request.id);
    this.error.set('');
    try {
      await this.requests.setStato(request.id, stato);
      // Aggiornamento in locale invece di rileggere tutto: la coda può essere lunga
      // e chi ha appena mosso una riga si aspetta di vederla cambiare, non la pagina
      // ricaricarsi sotto le mani — con il rischio che la selezione salti via.
      this.list.update((list) =>
        list.map((row) => (row.id === request.id ? { ...row, stato } : row))
      );
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.pending.set('');
    }
  }

  protected setFiltro(filtro: Filtro): void {
    this.filtro.set(filtro);
    // Se la richiesta aperta non è più fra quelle in elenco, la selezione va spostata:
    // un dettaglio a destra che non corrisponde a nessuna riga a sinistra disorienta.
    if (!this.visible().some((request) => request.id === this.selectedId())) {
      this.selectedId.set(this.visible()[0]?.id ?? '');
    }
  }
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Operazione non riuscita.';
}
