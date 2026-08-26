import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  destinatariLabel,
  formatDateTime,
  lettureLabel,
  STATO_LABEL,
  type Announcement,
} from '../../core/announcements.model';
import { AnnouncementsService } from '../../core/announcements.service';

/** I filtri dell'elenco: le bozze da finire, quello che è partito, o tutto. */
type Filtro = 'tutte' | 'bozze' | 'inviate';

/**
 * Le comunicazioni ai clienti.
 *
 * È l'unico posto dell'app in cui Revna parla per prima: tutto il resto — profilo,
 * documenti, assistente, richieste — nasce da qualcosa che il cliente chiede o guarda.
 * Per questo l'elenco mette in evidenza due numeri e non le date: **a quanti è
 * arrivata** e **quanti l'hanno aperta**. Sono la sola misura di una comunicazione, e
 * un avviso che nessuno apre è un avviso che non è stato scritto.
 *
 * Una tabella e non due colonne come per le richieste: qui non c'è una coda da lavorare
 * una riga alla volta, c'è uno storico da scorrere e una bozza da riprendere.
 */
@Component({
  selector: 'app-announcements',
  imports: [RouterLink],
  templateUrl: './announcements.html',
  styleUrl: './announcements.css',
})
export class Announcements {
  private readonly announcements = inject(AnnouncementsService);

  protected readonly statoLabel = STATO_LABEL;
  protected readonly formatDateTime = formatDateTime;
  protected readonly destinatariLabel = destinatariLabel;
  protected readonly lettureLabel = lettureLabel;

  protected readonly list = signal<Announcement[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly filtro = signal<Filtro>('tutte');

  protected readonly bozze = computed(
    () => this.list().filter((announcement) => announcement.stato === 'bozza').length
  );

  protected readonly visible = computed(() => {
    const filtro = this.filtro();
    if (filtro === 'tutte') return this.list();
    return this.list().filter((announcement) =>
      filtro === 'bozze' ? announcement.stato === 'bozza' : announcement.stato === 'inviato'
    );
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.list.set(await this.announcements.list());
    } catch (cause) {
      this.error.set(cause instanceof Error ? cause.message : 'Lettura non riuscita.');
    } finally {
      this.loading.set(false);
    }
  }

  protected setFiltro(filtro: Filtro): void {
    this.filtro.set(filtro);
  }
}
