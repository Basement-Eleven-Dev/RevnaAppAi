/**
 * Profilo della struttura ricettiva.
 *
 * I tipi sono gli stessi di `backend/functions/src/profile.ts` (che resta la fonte
 * autorevole: normalizza i dati in scrittura) e di `backoffice`. Le chiavi sono
 * stabili: cambiarle richiede una migrazione dei documenti.
 *
 * Le etichette delle liste a valori chiusi (tipologie, servizi, canali…) non stanno
 * qui ma in `lib/i18n/it.ts` e `en.ts`: i valori sono un contratto con il backend, le
 * etichette sono testo d'interfaccia e vanno tradotte. Le chiavi di quei record sono
 * esattamente i valori ammessi, quindi la lista resta scritta una volta per lingua e
 * il compilatore tiene le due allineate.
 */

export type Alloggio = { tipologia: string; quantita: number };

export type ClientProfile = {
  referente: { nome: string; cognome: string; ruolo: string; telefono: string };
  struttura: {
    nome: string;
    tipologia: string;
    categoria: string;
    annoApertura: number | null;
    sitoWeb: string;
  };
  indirizzo: {
    via: string;
    citta: string;
    provincia: string;
    cap: string;
    regione: string;
    paese: string;
  };
  alloggi: Alloggio[];
  servizi: string[];
  canali: string[];
  target: string[];
  stagionalita: string;
  obiettivi: string;
  /** Note del consulente Revna: il cliente le legge, non le modifica. */
  noteRevna: string;
  /** Note del cliente: le scrive lui dall'app, Revna non le sovrascrive. */
  noteCliente: string;
};

export const EMPTY_PROFILE: ClientProfile = {
  referente: { nome: '', cognome: '', ruolo: '', telefono: '' },
  struttura: { nome: '', tipologia: '', categoria: '', annoApertura: null, sitoWeb: '' },
  indirizzo: { via: '', citta: '', provincia: '', cap: '', regione: '', paese: 'Italia' },
  alloggi: [],
  servizi: [],
  canali: [],
  target: [],
  stagionalita: '',
  obiettivi: '',
  noteRevna: '',
  noteCliente: '',
};
