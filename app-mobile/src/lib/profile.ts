/**
 * Profilo della struttura ricettiva.
 *
 * Tipi e liste di valori sono gli stessi di `backend/functions/src/profile.ts`
 * (che resta la fonte autorevole: normalizza i dati in scrittura) e di
 * `app-mobile/src/lib/profile.ts`. Le chiavi sono stabili: cambiarle richiede
 * una migrazione dei documenti.
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

/** Opzione di una lista a valori chiusi: `value` va a documento, `label` si mostra. */
export type Option = { value: string; label: string };

export const TIPOLOGIE_STRUTTURA: Option[] = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'resort', label: 'Resort' },
  { value: 'bnb', label: 'B&B' },
  { value: 'agriturismo', label: 'Agriturismo' },
  { value: 'casaVacanze', label: 'Casa vacanze' },
  { value: 'residence', label: 'Residence / Aparthotel' },
  { value: 'dimoraStorica', label: 'Dimora storica' },
  { value: 'ostello', label: 'Ostello' },
  { value: 'glamping', label: 'Glamping' },
  { value: 'campeggio', label: 'Campeggio / Village' },
  { value: 'rifugio', label: 'Rifugio' },
  { value: 'altro', label: 'Altro' },
];

export const CATEGORIE: Option[] = [
  { value: '5L', label: '5 stelle lusso' },
  { value: '5', label: '5 stelle' },
  { value: '4', label: '4 stelle' },
  { value: '3', label: '3 stelle' },
  { value: '2', label: '2 stelle' },
  { value: '1', label: '1 stella' },
  { value: 'nonClassificata', label: 'Non classificata' },
];

export const TIPOLOGIE_ALLOGGIO: Option[] = [
  { value: 'singola', label: 'Singola' },
  { value: 'doppia', label: 'Doppia / Matrimoniale' },
  { value: 'tripla', label: 'Tripla' },
  { value: 'quadrupla', label: 'Quadrupla / Familiare' },
  { value: 'suite', label: 'Suite' },
  { value: 'juniorSuite', label: 'Junior suite' },
  { value: 'appartamento', label: 'Appartamento' },
  { value: 'villa', label: 'Villa / Chalet' },
  { value: 'bungalow', label: 'Bungalow / Mobile home' },
  { value: 'piazzola', label: 'Piazzola' },
  { value: 'dormitorio', label: 'Posto letto in dormitorio' },
];

export const SERVIZI: Option[] = [
  { value: 'ristorante', label: 'Ristorante' },
  { value: 'bar', label: 'Bar' },
  { value: 'colazione', label: 'Colazione inclusa' },
  { value: 'spa', label: 'SPA / Centro benessere' },
  { value: 'piscina', label: 'Piscina' },
  { value: 'palestra', label: 'Palestra' },
  { value: 'spiaggiaPrivata', label: 'Spiaggia privata' },
  { value: 'parcheggio', label: 'Parcheggio' },
  { value: 'navetta', label: 'Navetta' },
  { value: 'saleMeeting', label: 'Sale meeting' },
  { value: 'animaliAmmessi', label: 'Animali ammessi' },
  { value: 'giardino', label: 'Giardino / Terrazza' },
  { value: 'biciclette', label: 'Noleggio biciclette' },
  { value: 'checkInAutomatico', label: 'Check-in automatico' },
  { value: 'ricarica', label: 'Ricarica auto elettriche' },
];

export const CANALI: Option[] = [
  { value: 'diretto', label: 'Sito diretto' },
  { value: 'telefono', label: 'Telefono / Email' },
  { value: 'bookingCom', label: 'Booking.com' },
  { value: 'expedia', label: 'Expedia' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'tourOperator', label: 'Tour operator' },
  { value: 'agenzie', label: 'Agenzie di viaggio' },
  { value: 'gds', label: 'GDS' },
  { value: 'gruppi', label: 'Gruppi / MICE' },
];

export const TARGET: Option[] = [
  { value: 'leisure', label: 'Leisure' },
  { value: 'business', label: 'Business' },
  { value: 'famiglie', label: 'Famiglie' },
  { value: 'coppie', label: 'Coppie' },
  { value: 'gruppi', label: 'Gruppi' },
  { value: 'mice', label: 'MICE / Congressuale' },
  { value: 'senior', label: 'Senior' },
  { value: 'sportivi', label: 'Sportivi / Outdoor' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'internazionale', label: 'Clientela estera' },
];

export const STAGIONALITA: Option[] = [
  { value: 'annuale', label: 'Tutto l\'anno' },
  { value: 'estiva', label: 'Stagione estiva' },
  { value: 'invernale', label: 'Stagione invernale' },
  { value: 'doppiaStagione', label: 'Doppia stagione' },
  { value: 'weekend', label: 'Weekend ed eventi' },
];

/** Etichetta di un valore, con fallback sul valore stesso per i dati storici. */
export function labelOf(options: Option[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function labelsOf(options: Option[], values: string[]): string[] {
  return values.map((value) => labelOf(options, value));
}
