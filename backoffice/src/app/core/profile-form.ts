import { FormArray, FormBuilder, FormControl, FormGroup } from '@angular/forms';

import { EMPTY_PROFILE, type Alloggio, type ClientProfile } from './profile.model';

export type AlloggioGroup = FormGroup<{
  tipologia: FormControl<string>;
  quantita: FormControl<number>;
}>;

export type ProfileForm = ReturnType<typeof buildProfileForm>;

/**
 * Costruisce il form del profilo struttura.
 *
 * Le liste a scelta multipla (servizi, canali, target) sono singoli controlli che
 * contengono un array di chiavi: più semplice da leggere e da salvare rispetto a
 * un FormGroup di booleani, che andrebbe poi tradotto avanti e indietro.
 */
export function buildProfileForm(fb: FormBuilder, initial: ClientProfile = EMPTY_PROFILE) {
  return fb.nonNullable.group({
    referente: fb.nonNullable.group({
      nome: [initial.referente.nome],
      cognome: [initial.referente.cognome],
      ruolo: [initial.referente.ruolo],
      telefono: [initial.referente.telefono],
    }),
    struttura: fb.nonNullable.group({
      nome: [initial.struttura.nome],
      tipologia: [initial.struttura.tipologia],
      categoria: [initial.struttura.categoria],
      annoApertura: fb.control<number | null>(initial.struttura.annoApertura),
      sitoWeb: [initial.struttura.sitoWeb],
    }),
    indirizzo: fb.nonNullable.group({
      via: [initial.indirizzo.via],
      citta: [initial.indirizzo.citta],
      provincia: [initial.indirizzo.provincia],
      cap: [initial.indirizzo.cap],
      regione: [initial.indirizzo.regione],
      paese: [initial.indirizzo.paese],
    }),
    alloggi: fb.array(initial.alloggi.map((row) => alloggioGroup(fb, row))),
    servizi: fb.nonNullable.control<string[]>(initial.servizi),
    canali: fb.nonNullable.control<string[]>(initial.canali),
    target: fb.nonNullable.control<string[]>(initial.target),
    stagionalita: [initial.stagionalita],
    obiettivi: [initial.obiettivi],
    noteRevna: [initial.noteRevna],
  });
}

export function alloggioGroup(fb: FormBuilder, row: Alloggio = { tipologia: '', quantita: 0 }) {
  return fb.nonNullable.group({
    tipologia: [row.tipologia],
    quantita: [row.quantita],
  });
}

export function alloggiArray(form: ProfileForm): FormArray<AlloggioGroup> {
  return form.controls.alloggi as unknown as FormArray<AlloggioGroup>;
}

/** `noteCliente` non è nel form: appartiene al cliente e non va toccata da qui. */
export function readProfileForm(form: ProfileForm): Omit<ClientProfile, 'noteCliente'> {
  return form.getRawValue() as Omit<ClientProfile, 'noteCliente'>;
}

/** Somma delle unità dichiarate, mostrata come riepilogo sotto la tabella alloggi. */
export function totalUnits(form: ProfileForm): number {
  return alloggiArray(form)
    .getRawValue()
    .reduce((sum, row) => sum + (Number(row.quantita) || 0), 0);
}
