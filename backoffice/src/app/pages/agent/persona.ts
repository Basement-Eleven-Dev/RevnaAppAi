import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { DEFAULT_AGENT_CONFIG, stimaToken } from '../../core/agent.model';
import { AgentService } from '../../core/agent.service';

/**
 * Personalità dell'assistente: chi è, come ragiona, come scrive, di cosa si occupa.
 *
 * Quello che si scrive qui diventa il system prompt di ogni conversazione, quindi
 * vale per tutti i clienti insieme. Le quattro sezioni sono separate non per il
 * modello — che riceve un testo unico — ma per chi le scrive: tenere il tono
 * distinto dal perimetro rende evidente cosa si sta cambiando e cosa no.
 *
 * Le regole di citazione delle fonti non sono qui e non sono modificabili: sono un
 * accordo tecnico fra il prompt e il codice che riconosce i marcatori `[1]`.
 */
@Component({
  selector: 'app-agent-persona',
  imports: [ReactiveFormsModule],
  templateUrl: './persona.html',
  styleUrl: './agent.css',
})
export class AgentPersona {
  private readonly agent = inject(AgentService);
  private readonly builder = inject(FormBuilder);

  protected readonly stimaToken = stimaToken;

  protected readonly form = this.builder.nonNullable.group({
    identita: ['', Validators.required],
    ragionamento: [''],
    tono: [''],
    perimetro: [''],
    temperature: [DEFAULT_AGENT_CONFIG.temperature],
    spunti: this.builder.nonNullable.array<string>([]),
  });

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly saved = signal('');
  protected readonly error = signal('');

  /** Quanto pesa il prompt: è contesto che si porta dietro ogni singola domanda. */
  protected readonly peso = signal(0);

  /** Getter e non `computed`: il FormArray non è un signal, lo rilegge il template. */
  protected get spunti() {
    return this.form.controls.spunti;
  }

  constructor() {
    void this.load();
    this.form.valueChanges.subscribe(() => {
      this.saved.set('');
      this.peso.set(this.promptChars());
    });
  }

  private async load(): Promise<void> {
    try {
      const config = await this.agent.config();
      this.form.patchValue({
        identita: config.identita,
        ragionamento: config.ragionamento,
        tono: config.tono,
        perimetro: config.perimetro,
        temperature: config.temperature,
      });
      this.form.controls.spunti.clear();
      for (const spunto of config.spunti) {
        this.form.controls.spunti.push(this.builder.nonNullable.control(spunto));
      }
      this.peso.set(this.promptChars());
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.loading.set(false);
    }
  }

  private promptChars(): number {
    const { identita, ragionamento, tono, perimetro } = this.form.getRawValue();
    return [identita, ragionamento, tono, perimetro].join('\n').length;
  }

  protected addSpunto(): void {
    this.form.controls.spunti.push(this.builder.nonNullable.control(''));
  }

  protected removeSpunto(index: number): void {
    this.form.controls.spunti.removeAt(index);
  }

  /** Riporta una sezione al testo di partenza, senza toccare le altre. */
  protected reset(section: 'identita' | 'ragionamento' | 'tono' | 'perimetro'): void {
    this.form.controls[section].setValue(DEFAULT_AGENT_CONFIG[section]);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.error.set("L'identità dell'assistente non può restare vuota.");
      return;
    }

    this.saving.set(true);
    this.error.set('');
    try {
      await this.agent.saveConfig(this.form.getRawValue());
      // La cache del backend dura un minuto: dirlo evita la segnalazione
      // «ho salvato ma l'app risponde come prima».
      this.saved.set('Salvato. L’app lo usa entro un minuto.');
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.saving.set(false);
    }
  }
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Operazione non riuscita.';
}
