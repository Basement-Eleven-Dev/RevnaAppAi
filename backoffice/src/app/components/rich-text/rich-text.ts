import {
  afterNextRender,
  Component,
  ElementRef,
  forwardRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

import { htmlToMarkdown, markdownToHtml } from './markdown-html';

/** Cosa è attivo dove sta il cursore: serve solo ad accendere i bottoni della barra. */
type Stato = {
  grassetto: boolean;
  corsivo: boolean;
  titolo: boolean;
  sottotitolo: boolean;
  elenco: boolean;
  numerato: boolean;
  citazione: boolean;
};

const STATO_SPENTO: Stato = {
  grassetto: false,
  corsivo: false,
  titolo: false,
  sottotitolo: false,
  elenco: false,
  numerato: false,
  citazione: false,
};

/**
 * Editor di testo formattato, minimale: quello che serve a scrivere una comunicazione.
 *
 * Una textarea sarebbe bastata a mandare del testo, ma non a scrivere un avviso che
 * qualcuno legge sul telefono: un titolo, due paragrafi, un elenco, un link alla pagina
 * di cui si sta parlando, l'immagine del grafico di cui si sta scrivendo. Chiedere a chi
 * scrive di ricordarsi la sintassi del markdown per averli avrebbe voluto dire, in
 * pratica, non averli.
 *
 * Dentro è un `contenteditable` guidato da `document.execCommand`. `execCommand` è
 * deprecato e non ha un sostituto: le alternative sono una libreria di editing (un
 * intero pacchetto, il suo modello del documento e il suo aggiornamento, per sette
 * bottoni) o gestire a mano selezioni e Range, che è riscrivere `execCommand` peggio.
 * È implementato in tutti i browser e non sta andando via; se un giorno andasse, questo
 * è l'unico file da rifare — il markdown salvato resta quello.
 *
 * Il valore che entra ed esce dal form è **markdown**, non HTML: vedi `markdown-html.ts`.
 *
 * Due scelte volute, che tengono il testo dentro il sottoinsieme che l'app sa mostrare:
 *
 * - la barra offre solo i comandi che il renderer dell'app conosce;
 * - **l'incolla arriva senza formattazione**. Chi incolla da Word o da una pagina web
 *   porterebbe dentro font, colori, tabelle e `<span>` di ogni sorta: nell'app non si
 *   vedrebbero, e nell'editor darebbero l'illusione di un testo che nessuno leggerà
 *   così. Si incolla il testo, la forma la si dà con la barra.
 */
@Component({
  selector: 'app-rich-text',
  templateUrl: './rich-text.html',
  styleUrl: './rich-text.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichText),
      multi: true,
    },
  ],
})
export class RichText implements ControlValueAccessor {
  /**
   * Come si carica un'immagine. La passa la pagina, che sa dove vanno i suoi file:
   * questo componente non deve sapere niente né di Storage né di comunicazioni.
   */
  readonly upload = input<((file: File) => Promise<string>) | null>(null);

  readonly placeholder = input('');

  /**
   * Non `viewChild.required`: `writeValue` arriva **prima** che la view esista — il
   * form assegna il valore al momento in cui il campo si aggancia — e una query
   * obbligatoria interrogata a quel punto solleva. Chi scrive prima trova `undefined`
   * e lascia il lavoro a `afterNextRender`.
   */
  private readonly editor = viewChild<ElementRef<HTMLDivElement>>('editor');

  protected readonly stato = signal<Stato>(STATO_SPENTO);
  protected readonly vuoto = signal(true);
  protected readonly caricando = signal(false);
  protected readonly errore = signal('');
  protected readonly disabilitato = signal(false);

  /** L'HTML da mettere nel campo appena la view esiste (`writeValue` arriva prima). */
  private daScrivere = '';
  /**
   * L'ultimo markdown emesso verso il form.
   *
   * Serve a riconoscere il proprio valore quando torna indietro: Angular richiama
   * `writeValue` anche dopo un `patchValue` fatto dalla stessa pagina, e riscrivere
   * l'HTML mentre si sta scrivendo farebbe saltare il cursore in cima al testo.
   */
  private ultimo = '';

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    afterNextRender(() => {
      // Invio crea un paragrafo, non un `<div>`: è il blocco che il serializzatore
      // si aspetta, e l'unico che il renderer dell'app sa mostrare.
      document.execCommand('defaultParagraphSeparator', false, 'p');
      const element = this.editor()?.nativeElement;
      if (element) element.innerHTML = this.daScrivere || '<p><br></p>';
    });
  }

  writeValue(value: string | null): void {
    const markdown = value ?? '';
    if (markdown === this.ultimo) return;

    this.ultimo = markdown;
    this.vuoto.set(markdown.trim() === '');
    this.daScrivere = markdownToHtml(markdown);

    const element = this.editor()?.nativeElement;
    if (element) element.innerHTML = this.daScrivere;
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabilitato.set(disabled);
  }

  /** Il contenuto è cambiato: si traduce in markdown e si consegna al form. */
  protected onInput(): void {
    const element = this.editor()?.nativeElement;
    if (!element) return;

    const markdown = htmlToMarkdown(element.innerHTML);
    this.ultimo = markdown;
    this.vuoto.set(markdown.trim() === '');
    this.onChange(markdown);
    this.refresh();
  }

  protected onBlur(): void {
    this.onTouched();
  }

  /**
   * Incolla senza formattazione.
   *
   * `insertText` e non `insertHTML` del testo: passando per il testo semplice si perde
   * ogni tag, che è esattamente lo scopo, e il browser lo inserisce nel blocco corrente
   * rispettando la selezione — cosa che scrivere a mano nel DOM non farebbe.
   */
  protected onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const testo = event.clipboardData?.getData('text/plain') ?? '';
    if (testo) document.execCommand('insertText', false, testo);
    this.onInput();
  }

  protected refresh(): void {
    if (this.disabilitato()) return;

    const blocco = String(document.queryCommandValue('formatBlock')).toLowerCase();

    this.stato.set({
      grassetto: document.queryCommandState('bold'),
      corsivo: document.queryCommandState('italic'),
      titolo: blocco === 'h2',
      sottotitolo: blocco === 'h3',
      elenco: document.queryCommandState('insertUnorderedList'),
      numerato: document.queryCommandState('insertOrderedList'),
      citazione: blocco === 'blockquote',
    });
  }

  protected comando(command: string, value?: string): void {
    this.editor()?.nativeElement.focus();
    document.execCommand(command, false, value);
    this.onInput();
  }

  /**
   * Titolo, sottotitolo e citazione sono interruttori: premuti su un blocco che è già
   * quello, tornano paragrafo. Senza questo, per disfare un titolo bisognerebbe
   * cancellare la riga e riscriverla.
   */
  protected blocco(tag: 'h2' | 'h3' | 'blockquote'): void {
    const attuale = String(document.queryCommandValue('formatBlock')).toLowerCase();
    this.comando('formatBlock', attuale === tag ? 'p' : tag);
  }

  protected link(): void {
    const selezione = document.getSelection();
    const testo = selezione?.toString() ?? '';
    const url = prompt('Indirizzo del link', 'https://')?.trim();

    if (!url || url === 'https://') return;
    if (/^\s*(javascript|data|vbscript):/i.test(url)) {
      this.errore.set('Indirizzo non ammesso.');
      return;
    }

    // Con il cursore fermo non c'è niente da trasformare in link: si scrive
    // l'indirizzo e si linka quello, che è come si legge un URL incollato.
    if (testo.trim() === '') {
      this.editor()?.nativeElement.focus();
      document.execCommand('insertText', false, url);
      const range = document.getSelection();
      if (range && range.rangeCount > 0) {
        const node = range.getRangeAt(0);
        node.setStart(node.endContainer, Math.max(0, node.endOffset - url.length));
        selezione?.removeAllRanges();
        selezione?.addRange(node);
      }
    }

    this.comando('createLink', url);
  }

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Il campo si svuota subito: senza, ricaricare lo stesso file non scatterebbe.
    input.value = '';
    if (!file) return;

    const upload = this.upload();
    if (!upload) return;

    this.caricando.set(true);
    this.errore.set('');
    try {
      this.comando('insertImage', await upload(file));
    } catch (cause) {
      this.errore.set(cause instanceof Error ? cause.message : 'Immagine non caricata.');
    } finally {
      this.caricando.set(false);
    }
  }
}
