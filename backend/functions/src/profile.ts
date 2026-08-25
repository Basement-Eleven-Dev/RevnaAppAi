/**
 * Profilo della struttura ricettiva.
 *
 * Lo redige Revna dal backoffice al momento dell'invito, così il cliente lo trova
 * già pronto al primo accesso. Il cliente può leggerlo e aggiungere `noteCliente`,
 * ma non sovrascrivere quello che ha scritto Revna.
 *
 * Le liste di valori ammessi stanno qui e sono duplicate, con le etichette in
 * italiano, in `backoffice/src/app/core/profile.model.ts` e `app-mobile/src/lib/profile.ts`.
 * Sono chiavi stabili: cambiarle richiede una migrazione dei documenti.
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

const emptyProfile: ClientProfile = {
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

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/**
 * Normalizza quello che arriva dal client: nessun campo sconosciuto finisce a
 * documento, e i tipi sono garantiti anche se il backoffice manda dati parziali.
 */
export function sanitizeProfile(input: unknown): ClientProfile {
  const raw = (input ?? {}) as Record<string, never>;
  const section = <T>(key: string): Record<string, T> =>
    (raw[key] ?? {}) as unknown as Record<string, T>;

  const referente = section<string>('referente');
  const struttura = section<string | number | null>('struttura');
  const indirizzo = section<string>('indirizzo');
  const anno = Number(struttura['annoApertura']);

  return {
    referente: {
      nome: text(referente['nome']),
      cognome: text(referente['cognome']),
      ruolo: text(referente['ruolo']),
      telefono: text(referente['telefono']),
    },
    struttura: {
      nome: text(struttura['nome']),
      tipologia: text(struttura['tipologia']),
      categoria: text(struttura['categoria']),
      annoApertura: Number.isFinite(anno) && anno > 1800 ? anno : null,
      sitoWeb: text(struttura['sitoWeb']),
    },
    indirizzo: {
      via: text(indirizzo['via']),
      citta: text(indirizzo['citta']),
      provincia: text(indirizzo['provincia']),
      cap: text(indirizzo['cap']),
      regione: text(indirizzo['regione']),
      paese: text(indirizzo['paese']) || emptyProfile.indirizzo.paese,
    },
    alloggi: (Array.isArray(raw['alloggi']) ? (raw['alloggi'] as unknown[]) : [])
      .map((item) => {
        const row = (item ?? {}) as Record<string, unknown>;
        return { tipologia: text(row['tipologia']), quantita: Number(row['quantita']) || 0 };
      })
      .filter((row) => row.tipologia !== '' || row.quantita > 0),
    servizi: list(raw['servizi']),
    canali: list(raw['canali']),
    target: list(raw['target']),
    stagionalita: text(raw['stagionalita']),
    obiettivi: text(raw['obiettivi']),
    noteRevna: text(raw['noteRevna']),
    noteCliente: text(raw['noteCliente']),
  };
}

/** Nome da mostrare in elenco: la struttura se c'è, altrimenti il referente. */
export function profileDisplayName(profile: ClientProfile): string {
  const referente = `${profile.referente.nome} ${profile.referente.cognome}`.trim();
  return profile.struttura.nome || referente;
}

/**
 * Etichette in italiano, usate per rendere il profilo leggibile al modello.
 * Devono restare allineate alle liste dei client; se una chiave manca, si usa
 * la chiave stessa: meglio un termine grezzo che un buco nel contesto.
 */
const LABELS: Record<string, string> = {
  // tipologia struttura
  hotel: 'Hotel', resort: 'Resort', bnb: 'B&B', agriturismo: 'Agriturismo',
  casaVacanze: 'Casa vacanze', residence: 'Residence / Aparthotel',
  dimoraStorica: 'Dimora storica', ostello: 'Ostello', glamping: 'Glamping',
  campeggio: 'Campeggio / Village', rifugio: 'Rifugio', altro: 'Altro',
  // categoria
  '5L': '5 stelle lusso', '5': '5 stelle', '4': '4 stelle', '3': '3 stelle',
  '2': '2 stelle', '1': '1 stella', nonClassificata: 'non classificata',
  // alloggi
  singola: 'Singole', doppia: 'Doppie/matrimoniali', tripla: 'Triple',
  quadrupla: 'Quadruple/familiari', suite: 'Suite', juniorSuite: 'Junior suite',
  appartamento: 'Appartamenti', villa: 'Ville/chalet', bungalow: 'Bungalow/mobile home',
  piazzola: 'Piazzole', dormitorio: 'Posti letto in dormitorio',
  // servizi
  ristorante: 'ristorante', bar: 'bar', colazione: 'colazione inclusa',
  spa: 'SPA', piscina: 'piscina', palestra: 'palestra',
  spiaggiaPrivata: 'spiaggia privata', parcheggio: 'parcheggio', navetta: 'navetta',
  saleMeeting: 'sale meeting', animaliAmmessi: 'animali ammessi',
  giardino: 'giardino/terrazza', biciclette: 'noleggio biciclette',
  checkInAutomatico: 'check-in automatico', ricarica: 'ricarica auto elettriche',
  // canali
  diretto: 'sito diretto', telefono: 'telefono/email', bookingCom: 'Booking.com',
  expedia: 'Expedia', airbnb: 'Airbnb', tourOperator: 'tour operator',
  agenzie: 'agenzie di viaggio', gds: 'GDS',
  // target
  leisure: 'leisure', business: 'business', famiglie: 'famiglie', coppie: 'coppie',
  gruppi: 'gruppi', mice: 'MICE/congressuale', senior: 'senior',
  sportivi: 'sportivi/outdoor', wedding: 'wedding', internazionale: 'clientela estera',
  // stagionalità
  annuale: 'aperta tutto l\'anno', estiva: 'stagione estiva',
  invernale: 'stagione invernale', doppiaStagione: 'doppia stagione',
  weekend: 'weekend ed eventi',
};

const label = (key: string): string => LABELS[key] ?? key;

/**
 * Rende il profilo in prosa, per il system prompt dell'assistente.
 * Le sezioni vuote spariscono: un elenco di "non specificato" occuperebbe
 * contesto senza dire nulla, e induce il modello a scusarsi invece di lavorare.
 */
export function describeProfile(profile: ClientProfile): string {
  const { referente, struttura, indirizzo, alloggi } = profile;
  const lines: string[] = [];

  const nome = struttura.nome || 'Struttura senza nome';
  const tipo = [label(struttura.tipologia), label(struttura.categoria)]
    .filter((part) => part && part !== struttura.tipologia + struttura.categoria)
    .filter(Boolean)
    .join(', ');
  lines.push(`Struttura: ${nome}${tipo ? ` (${tipo})` : ''}.`);

  const luogo = [indirizzo.citta, indirizzo.provincia, indirizzo.regione, indirizzo.paese]
    .filter(Boolean)
    .join(', ');
  if (luogo) lines.push(`Località: ${luogo}.`);
  if (struttura.annoApertura) lines.push(`Aperta dal ${struttura.annoApertura}.`);
  if (struttura.sitoWeb) lines.push(`Sito: ${struttura.sitoWeb}.`);

  if (alloggi.length) {
    const totale = alloggi.reduce((sum, row) => sum + row.quantita, 0);
    const dettaglio = alloggi.map((row) => `${row.quantita} ${label(row.tipologia)}`).join(', ');
    lines.push(`Alloggi: ${totale} unità totali — ${dettaglio}.`);
  }

  if (profile.stagionalita) lines.push(`Stagionalità: ${label(profile.stagionalita)}.`);
  if (profile.servizi.length) {
    lines.push(`Servizi: ${profile.servizi.map(label).join(', ')}.`);
  }
  if (profile.canali.length) {
    lines.push(`Canali di vendita: ${profile.canali.map(label).join(', ')}.`);
  }
  if (profile.target.length) {
    lines.push(`Target: ${profile.target.map(label).join(', ')}.`);
  }
  if (profile.obiettivi) lines.push(`Obiettivi dichiarati: ${profile.obiettivi}`);
  if (profile.noteRevna) lines.push(`Note del consulente Revna: ${profile.noteRevna}`);
  if (profile.noteCliente) lines.push(`Note aggiunte dal cliente: ${profile.noteCliente}`);

  const chi = `${referente.nome} ${referente.cognome}`.trim();
  if (chi) {
    lines.push(`Stai parlando con ${chi}${referente.ruolo ? `, ${referente.ruolo}` : ''}.`);
  }

  return lines.join('\n');
}
