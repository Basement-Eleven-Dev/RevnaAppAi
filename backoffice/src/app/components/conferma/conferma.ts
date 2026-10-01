import { afterNextRender, Component, ElementRef, input, output, viewChild } from '@angular/core';

/**
 * «Sei sicuro?» dentro la pagina, accanto al bottone che l'ha chiesto.
 *
 * Al posto di `confirm()` del browser: quella finestra blocca la pagina, arriva con
 * l'aspetto del sistema operativo invece di quello del backoffice, e sul telefono copre
 * proprio il contesto — il numero di destinatari, il titolo — che serve per decidere.
 *
 * Il fuoco va sul bottone di conferma, così da tastiera basta Invio; Esc annulla.
 */
@Component({
  selector: 'app-conferma',
  templateUrl: './conferma.html',
  styleUrl: './conferma.css',
  host: { '(keydown.escape)': 'annulla.emit()' },
})
export class Conferma {
  readonly testo = input.required<string>();
  readonly etichetta = input.required<string>();
  /** `danger` per le azioni che tolgono qualcosa: ritirare, eliminare. */
  readonly tono = input<'normale' | 'danger'>('normale');

  readonly conferma = output<void>();
  readonly annulla = output<void>();

  private readonly bottone = viewChild.required<ElementRef<HTMLButtonElement>>('bottone');

  constructor() {
    afterNextRender(() => this.bottone().nativeElement.focus());
  }
}
