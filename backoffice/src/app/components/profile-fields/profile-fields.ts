import { Component, inject, input } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  alloggiArray,
  alloggioGroup,
  totalUnits,
  type ProfileForm,
} from '../../core/profile-form';
import {
  CANALI,
  CATEGORIE,
  SERVIZI,
  STAGIONALITA,
  TARGET,
  TIPOLOGIE_ALLOGGIO,
  TIPOLOGIE_STRUTTURA,
} from '../../core/profile.model';

/** Tutti i campi del profilo struttura. Il form lo possiede la pagina che lo usa. */
@Component({
  selector: 'app-profile-fields',
  imports: [ReactiveFormsModule],
  templateUrl: './profile-fields.html',
  styleUrl: './profile-fields.css',
})
export class ProfileFields {
  private readonly fb = inject(FormBuilder);

  readonly form = input.required<ProfileForm>();

  protected readonly tipologie = TIPOLOGIE_STRUTTURA;
  protected readonly categorie = CATEGORIE;
  protected readonly tipologieAlloggio = TIPOLOGIE_ALLOGGIO;
  protected readonly servizi = SERVIZI;
  protected readonly canali = CANALI;
  protected readonly target = TARGET;
  protected readonly stagionalita = STAGIONALITA;

  protected get alloggi() {
    return alloggiArray(this.form());
  }

  protected get totale(): number {
    return totalUnits(this.form());
  }

  protected addAlloggio(): void {
    this.alloggi.push(alloggioGroup(this.fb));
  }

  protected removeAlloggio(index: number): void {
    this.alloggi.removeAt(index);
  }

  protected isChecked(control: FormControl<string[]>, value: string): boolean {
    return control.value.includes(value);
  }

  protected toggle(control: FormControl<string[]>, value: string): void {
    const current = control.value;
    control.setValue(
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
    control.markAsDirty();
  }

  protected multi(name: 'servizi' | 'canali' | 'target'): FormControl<string[]> {
    return this.form().controls[name];
  }
}
