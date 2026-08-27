/**
 * Il sistema visivo Revna, in un posto solo.
 *
 * Tre regole da cui derivano tutte le schermate: **colore** (un accento, il resto
 * White Smoke a opacità decrescente), **forma** (due angoli smussati, quattro
 * misure) e **movimento** (tempi fissi, e l'arancio che non pulsa mai tranne il
 * caret). I file di questa cartella le tengono separate; le schermate importano
 * da qui.
 */

export { bevelPath, Corner } from './shape';
export {
  Curve,
  Duration,
  NavigatorCurve,
  PRESSED_OPACITY,
  PRESSED_SCALE,
  Rise,
  Stagger,
} from './motion';
export { Gutter, MaxContentWidth, Spacing } from './spacing';
export { Brand, Danger, Glass, Ink, Line, smoke, Surface } from './palette';
export { Family, FontAssets, Type, type TypeRole } from './typography';
