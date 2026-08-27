/**
 * Il colore del sistema Revna (Fondamenta · 01).
 *
 * L'app vive sul nero: `#DD5237`, il Cinnabar da stampa, su fondo scuro perde
 * luce, quindi a schermo l'accento è `#FF5C36` — ed è l'unico accento che
 * esiste. Tutto il resto è White Smoke a opacità decrescente: 100% i titoli,
 * 86% il corpo, 56% il testo di servizio, 34% i metadati, 9% le linee. Un solo
 * rosso funzionale per gli errori, mai vicino all'accento.
 *
 * I token stanno in costanti e non dietro un hook perché l'app ha **una sola
 * apparenza**: le schermate possono tenere i colori dentro `StyleSheet.create`,
 * che è il posto giusto per uno stile che non cambia.
 */

/** White Smoke a una data opacità: la scala di grigi dell'app è tutta qui. */
function smoke(opacity: number): string {
  return `rgba(244,244,244,${opacity})`;
}

/** Cinnabar Live a una data opacità: velature e bordi dell'accento. */
function cinnabar(opacity: number): string {
  return `rgba(255,92,54,${opacity})`;
}

/** Il rosso funzionale a una data opacità: la velatura e il bordo di un'azione che distrugge. */
function danger(opacity: number): string {
  return `rgba(255,107,107,${opacity})`;
}

export const Brand = {
  /** Cinnabar Live: l'accento a schermo. */
  accent: '#FF5C36',
  /** Cinnabar da stampa: resta per l'icona di sistema e le notifiche. */
  accentPrint: '#DD5237',
  /** Accento schiarito, per i link premuti e il codice nei testi. */
  accentSoft: '#FF8464',
  /** White Smoke pieno. */
  ink: '#F4F4F4',
  /** Il nero su cui l'accento è leggibile: fa da inchiostro sopra l'arancio. */
  onAccent: '#0A0908',
} as const;

/** I tre piani su cui poggia ogni schermata. */
export const Surface = {
  /** Il fondo dell'app. */
  base: '#060505',
  /** Superficie piena: barre di sistema e pannelli a piena larghezza. */
  raised: '#0A0908',
  /** Card: bianco al 4,5%, senza bordo. */
  card: smoke(0.045),
  /** Elemento toccabile in quiete (riga d'elenco, spunto). */
  element: smoke(0.05),
  /** Controllo: bottone secondario, campo, bottone icona. */
  control: smoke(0.07),
  /** Bolla del messaggio dell'utente. */
  bubble: smoke(0.08),
  /** Velatura dell'accento, in ordine di intensità. */
  accentWash: cinnabar(0.09),
  accentTint: cinnabar(0.12),
  accentStrong: cinnabar(0.16),
} as const;

/**
 * Il vetro: solo ciò che galleggia sopra il contenuto ne ha, e sempre con la
 * linea di luce a 1px in cima (vedi `Line.glass`).
 */
export const Glass = {
  /** Barra ancorata a un bordo dello schermo (tab bar). */
  bar: 'rgba(10,9,8,.86)',
  /** Foglio che sale dal basso. */
  sheet: 'rgba(20,19,18,.72)',
  /** Composer, che galleggia sul contenuto che scorre sotto. */
  floating: 'rgba(20,19,18,.62)',
  /** Fondo di una modale. */
  scrim: 'rgba(6,5,5,.72)',
  /** Sfocatura prevista dal sistema; vedi `components/ui/glass-surface.tsx`. */
  blur: 28,
} as const;

export const Ink = {
  /** Titoli e numeri: White Smoke pieno. */
  primary: Brand.ink,
  /** Corpo del testo. */
  body: smoke(0.86),
  /** Testo di servizio: sottotitoli, descrizioni, aiuti. */
  secondary: smoke(0.56),
  /** Etichette di un elenco, testo spento. */
  muted: smoke(0.42),
  /** Metadati: date, pesi, conteggi. */
  faint: smoke(0.34),
  /** Note a piè di pagina e testo segnaposto. */
  ghost: smoke(0.28),
  /** Sopra una superficie arancione. */
  onAccent: Brand.onAccent,
} as const;

export const Line = {
  /** Divisori dentro una card o fra righe d'elenco. */
  hairline: smoke(0.09),
  /** Bordo di un campo in quiete. */
  field: smoke(0.1),
  /** La linea di luce in cima al vetro. */
  glass: smoke(0.14),
  /** Bordo di un blocco in accento. */
  accent: cinnabar(0.28),
  /** Bordo di un controllo in accento. */
  accentStrong: cinnabar(0.4),
} as const;

/**
 * Errore: un solo rosso funzionale, e mai accanto all'accento.
 *
 * Serve anche alle azioni che distruggono — dimenticare una riga di memoria,
 * cancellarla tutta. Un bottone di quel tipo non può essere pieno d'arancio: in questo
 * sistema l'arancio è l'azione che si vuole fare, e «cancella tutto» non lo è mai.
 * Quindi velatura e bordo rossi, testo rosso, superficie quasi nera: si vede che è un
 * bottone, si vede che è l'ultimo che vorresti premere.
 */
export const Danger = {
  text: '#FF6B6B',
  wash: danger(0.1),
  /** Bordo di un controllo che distrugge. */
  line: danger(0.34),
} as const;

export { smoke };
