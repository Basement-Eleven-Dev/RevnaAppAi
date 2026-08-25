import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * Pagina di atterraggio del link di attivazione, pubblica.
 *
 * Non imposta lei la password: rimanda all'app, dove il cliente la sceglie.
 * Serve solo perché un'email deve puntare a un URL https, non a `revnaai://`.
 */
@Component({
  selector: 'app-activate',
  templateUrl: './activate.html',
  styleUrl: './activate.css',
})
export class Activate {
  private readonly code = inject(ActivatedRoute).snapshot.queryParamMap.get('code') ?? '';

  protected readonly deepLink = this.code ? `revnaai://attiva?code=${encodeURIComponent(this.code)}` : '';
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
