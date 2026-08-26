import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { RichText } from '../../components/rich-text/rich-text';
import {
  formatDateTime,
  lettureLabel,
  MAX_BODY_CHARS,
  MAX_TITLE_CHARS,
  type Announcement,
  type ModoDestinatari,
} from '../../core/announcements.model';
import { AnnouncementsService } from '../../core/announcements.service';
import { ClientsService, type Client } from '../../core/clients.service';

/**
 * Scrivere una comunicazione: il testo, a chi va, e l'invio.
 *
 * Una pagina sola per la creazione e la modifica, come per le voci di conoscenza: tutto
 * quello che le distingue è se il documento esiste già.
 *
 * L'id della comunicazione si genera **prima** del primo salvataggio (`newId`), e non è
 * un dettaglio: le immagini che si incollano nel testo vanno su Storage sotto
 * `announcements/{id}/`, quindi un id serve dal primo momento. Senza, la prima immagine
 * obbligherebbe a un salvataggio forzato a metà frase.
 *
 * «Invia» salva sempre prima di mandare. Il caso opposto — mandare quello che c'era al
 * salvataggio precedente mentre a schermo c'è altro — è il modo più semplice di
 * recapitare a tutti i clienti una versione che nessuno voleva mandare.
 */
@Component({
  selector: 'app-announcement-editor',
  imports: [ReactiveFormsModule, RouterLink, RichText],
  templateUrl: './editor.html',
  styleUrl: './announcements.css',
})
export class AnnouncementEditor {
  private readonly announcements = inject(AnnouncementsService);
  private readonly clients = inject(ClientsService);
  private readonly router = inject(Router);

  protected readonly maxTitolo = MAX_TITLE_CHARS;
  protected readonly maxCorpo = MAX_BODY_CHARS;
  protected readonly formatDateTime = formatDateTime;
  protected readonly lettureLabel = lettureLabel;

  /** `nuova` nell'URL significa comunicazione da creare. */
  private readonly param = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? 'nuova';
  protected readonly nuova = signal(this.param === 'nuova');
  protected readonly id = signal(this.param === 'nuova' ? this.announcements.newId() : this.param);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    titolo: ['', [Validators.required, Validators.maxLength(MAX_TITLE_CHARS)]],
    corpo: ['', Validators.required],
    modo: ['tutti' as ModoDestinatari],
  });

  /** I clienti scelti a mano, quando i destinatari non sono tutti. */
  protected readonly selezione = signal<string[]>([]);
  protected readonly cerca = signal('');

  protected readonly clienti = signal<Client[]>([]);
  protected readonly comunicazione = signal<Announcement | null>(null);

  protected readonly loading = signal(this.param !== 'nuova');
  protected readonly saving = signal(false);
  protected readonly sending = signal(false);
  protected readonly saved = signal('');
  protected readonly error = signal('');

  protected readonly inviata = computed(() => this.comunicazione()?.stato === 'inviato');

  /** Solo i clienti attivi: a un accesso disattivato il server non consegna comunque. */
  protected readonly attivi = computed(() => this.clienti().filter((client) => !client.disabled));

  protected readonly visibili = computed(() => {
    const cerca = this.cerca().trim().toLowerCase();
    if (!cerca) return this.attivi();
    return this.attivi().filter((client) =>
      `${client.displayName ?? ''} ${client.email}`.toLowerCase().includes(cerca)
    );
  });

  /** Quanti riceveranno: il numero che compare sul bottone e nella conferma. */
  protected readonly quanti = computed(() =>
    this.form.getRawValue().modo === 'tutti' ? this.attivi().length : this.selezione().length
  );

  protected readonly caratteri = computed(() => this.form.getRawValue().corpo.length);

  constructor() {
    void this.loadClients();
    if (this.param !== 'nuova') void this.load(this.param);
    this.form.valueChanges.subscribe(() => this.saved.set(''));
  }

  /**
   * Come si carica un'immagine, passato all'editor.
   *
   * Sta qui e non dentro il componente di editing perché è questa pagina a sapere dove
   * vanno i suoi file: il campo di testo formattato non deve sapere niente né di
   * Storage né di comunicazioni.
   */
  protected readonly uploadImage = (file: File): Promise<string> =>
    this.announcements.uploadImage(this.id(), file);

  private async loadClients(): Promise<void> {
    try {
      this.clienti.set(await this.clients.list());
    } catch (cause) {
      this.error.set(message(cause));
    }
  }

  private async load(id: string): Promise<void> {
    try {
      const announcement = await this.announcements.get(id);
      if (!announcement) {
        this.error.set('Questa comunicazione non esiste più.');
        return;
      }

      this.comunicazione.set(announcement);
      this.form.patchValue({
        titolo: announcement.titolo,
        corpo: announcement.corpo,
        modo: announcement.destinatari.modo,
      });
      this.selezione.set(announcement.destinatari.uids);

      // Su una comunicazione già partita i destinatari sono storia, non una scelta:
      // il controllo si spegne perché non c'è niente da decidere.
      if (announcement.stato === 'inviato') this.form.controls.modo.disable();
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.loading.set(false);
    }
  }

  protected toggle(uid: string): void {
    this.selezione.update((list) =>
      list.includes(uid) ? list.filter((item) => item !== uid) : [...list, uid]
    );
    this.saved.set('');
  }

  protected tutti(): void {
    this.selezione.set(this.visibili().map((client) => client.uid));
    this.saved.set('');
  }

  protected nessuno(): void {
    this.selezione.set([]);
    this.saved.set('');
  }

  protected nomeCliente(client: Client): string {
    return client.displayName?.trim() || client.email;
  }

  /** Salva e torna true se è andata: `invia` ci si appoggia. */
  protected async save(): Promise<boolean> {
    const { titolo, corpo, modo } = this.form.getRawValue();

    if (!titolo.trim()) {
      this.error.set('Il titolo è necessario: è quello che il cliente legge nell\'elenco.');
      return false;
    }
    if (!corpo.trim()) {
      this.error.set('La comunicazione è vuota.');
      return false;
    }
    if (corpo.length > MAX_BODY_CHARS) {
      this.error.set('Il testo è troppo lungo per una comunicazione: per un allegato usa i Documenti.');
      return false;
    }

    this.saving.set(true);
    this.error.set('');
    try {
      await this.announcements.save({
        id: this.id(),
        titolo,
        corpo,
        destinatari: { modo, uids: modo === 'selezione' ? this.selezione() : [] },
      });

      // La rotta passa da «nuova» all'id vero: chi ricarica la pagina, o torna
      // indietro dal browser, deve ritrovare la bozza e non un foglio bianco.
      if (this.nuova()) {
        this.nuova.set(false);
        void this.router.navigate(['/comunicazioni', this.id()], { replaceUrl: true });
      }

      this.saved.set(
        this.inviata()
          ? 'Salvato. La correzione è già nell\'app di chi l\'ha ricevuta.'
          : 'Bozza salvata. Nessuno l\'ha ancora ricevuta.'
      );

      // Rileggere serve a due cose: i conteggi delle letture e lo stato vero della
      // comunicazione, che dopo un invio non è più quello che aveva la pagina.
      if (!this.comunicazione()) this.comunicazione.set(await this.announcements.get(this.id()));

      return true;
    } catch (cause) {
      this.error.set(message(cause));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Manda la comunicazione, dopo averla salvata.
   *
   * La conferma dice il numero e non solo «sei sicuro?»: la differenza fra mandare a un
   * cliente e mandare a tutti è tutta lì, e con «tutti i clienti» selezionato è l'unico
   * punto in cui quel numero si vede prima che parta.
   */
  protected async invia(): Promise<void> {
    if (this.quanti() === 0) {
      this.error.set('Scegli almeno un destinatario.');
      return;
    }

    const quanti = this.quanti();
    const a = quanti === 1 ? 'a 1 cliente' : `a ${quanti} clienti`;
    if (!confirm(`Inviare «${this.form.getRawValue().titolo}» ${a}? Riceveranno una notifica.`)) {
      return;
    }

    if (!(await this.save())) return;

    this.sending.set(true);
    this.error.set('');
    try {
      const esito = await this.announcements.send(this.id());
      this.comunicazione.set(await this.announcements.get(this.id()));
      this.form.controls.modo.disable();

      // Le notifiche recapitate si dicono sempre, anche quando sono zero: senza
      // dispositivi registrati l'avviso arriva comunque nell'app, e chi ha premuto
      // «Invia» deve sapere che nessun telefono ha suonato.
      this.saved.set(
        `Inviata a ${esito.destinatari} ${esito.destinatari === 1 ? 'cliente' : 'clienti'} · ` +
          `${esito.notificati} notifiche recapitate su ${esito.dispositivi} dispositivi registrati.`
      );
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.sending.set(false);
    }
  }

  /**
   * Ritira: la comunicazione sparisce anche dall'app di chi l'ha ricevuta.
   *
   * Due conferme diverse perché sono due cose diverse: buttare una bozza che nessuno ha
   * visto, e togliere dalle mani dei clienti un avviso che stanno leggendo.
   */
  protected async remove(): Promise<void> {
    const domanda = this.inviata()
      ? 'Ritirare questa comunicazione? Sparirà dall\'app dei clienti che l\'hanno ricevuta.'
      : 'Eliminare questa bozza?';

    if (!confirm(domanda)) return;

    this.error.set('');
    try {
      await this.announcements.remove(this.id());
      await this.router.navigate(['/comunicazioni']);
    } catch (cause) {
      this.error.set(message(cause));
    }
  }
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Operazione non riuscita.';
}
