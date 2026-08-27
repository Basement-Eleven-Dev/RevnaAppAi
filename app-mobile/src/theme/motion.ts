/**
 * I tempi del sistema Revna (Fondamenta · 01).
 *
 * L'arancio non pulsa mai, tranne il caret dello streaming: è l'unica cosa
 * nell'app che deve dire «sta succedendo adesso». Tutto il resto si muove una
 * volta e si ferma.
 *
 * Qui ci sono solo i **numeri**: chi li usa è `components/ui/motion.tsx`, che è
 * l'unico posto in cui il movimento è scritto. Una schermata non decide una
 * durata più di quanto decida un colore.
 */

import { Easing as NavigatorEasing } from 'react-native';
import { Easing } from 'react-native-reanimated';

export const Duration = {
  /** Quanto ci mette un elemento premuto ad affondare. */
  tap: 120,
  /**
   * Quanto ci mette a tornare su.
   *
   * Più lungo dell'affondo di proposito: il tocco deve rispondere subito, il
   * rilascio deve *lasciare andare*. Uguali, il tocco sembra un interruttore.
   */
  release: 180,
  /** Entrata di un elemento in scena. */
  enter: 220,
  /** Foglio che sale dal basso. */
  sheet: 320,
  /** Mezzo battito del caret e dei puntini d'attesa. */
  pulse: 500,
} as const;

/**
 * La curva del sistema: 0.2 / 0.8 / 0.2 / 1.
 *
 * Parte deciso e si posa: è il contrario di `ease-in-out`, che parte piano e fa
 * sembrare in ritardo ogni cosa che si muove. Tutto quello che si anima nell'app
 * passa da qui — se una transizione ha una curva sua, è un secondo sistema.
 */
export const Curve = Easing.bezier(0.2, 0.8, 0.2, 1);

/**
 * La stessa curva per i navigatori.
 *
 * Le transizioni di React Navigation girano sull'`Animated` di React Native, che
 * non sa leggere una curva di Reanimated: sono gli stessi quattro numeri, scritti
 * nell'altra lingua.
 */
export const NavigatorCurve = NavigatorEasing.bezier(0.2, 0.8, 0.2, 1);

/** Opacità di un elemento premuto. */
export const PRESSED_OPACITY = 0.62;

/**
 * Scala di un elemento premuto: 2,3% e non di più.
 *
 * Deve leggersi come una superficie che cede sotto il dito, non come un elemento
 * che rimpicciolisce. Sopra il 5% su una card larga si vede il bordo muoversi, e
 * quello è un effetto, non una risposta.
 */
export const PRESSED_SCALE = 0.977;

/**
 * Di quanto sale un elemento che entra in scena: 8px.
 *
 * Serve a dare una direzione all'entrata — il contenuto arriva da sotto, come lo
 * scorrimento — senza che nulla si sposti abbastanza da far rileggere la riga.
 */
export const Rise = 8;

/** Ritardo fra una riga e la successiva di un elenco che entra in scena. */
export const Stagger = 45;
