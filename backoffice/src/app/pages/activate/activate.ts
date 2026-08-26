import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * Pagina di atterraggio dei link mandati al cliente, pubblica.
 *
 * Non imposta lei la password: rimanda all'app, dove il cliente la sceglie.
 * Serve solo perché un'email deve puntare a un URL https, non a `revnaai://`.
 *
 * Serve due email, attivazione e recupero password, distinte dal parametro
 * `reset`: il codice è lo stesso `oobCode` e il percorso pure, cambia solo cosa
 * si sta dicendo a chi legge. Il parametro viene ripassato al deep link perché
 * anche l'app deve saperlo.
 */
@Component({
  selector: 'app-activate',
  templateUrl: './activate.html',
  styleUrl: './activate.css',
})
export class Activate {
  private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;
  private readonly code = this.params.get('code') ?? '';

  protected readonly isReset = (this.params.get('reset') ?? '') !== '';

  protected readonly deepLink = this.code
    ? `revnaai://attiva?code=${encodeURIComponent(this.code)}${this.isReset ? '&reset=1' : ''}`
    : '';
  protected readonly copied = signal(false);

  constructor() {
    // Su mobile l'app si apre da sola; su desktop non succede nulla ed è giusto così.
    if (this.deepLink) {
      window.location.href = this.deepLink;
    }
  }

  protected get hasCode(): boolean {
    return this.code !== '';
  }

  protected async copyCode(): Promise<void> {
    await navigator.clipboard.writeText(this.code);
    this.copied.set(true);
  }
}
