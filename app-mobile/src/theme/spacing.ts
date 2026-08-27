/**
 * La griglia dei margini, in multipli di 4.
 *
 * `gutter` è il margine laterale delle schermate: 20px, la misura su cui sono
 * disegnate tutte le schermate del sistema.
 */

export const Spacing = {
  hair: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 32,
  huge: 48,
} as const;

/** Margine laterale delle schermate. */
export const Gutter = 20;

/**
 * Larghezza massima della colonna di contenuto: l'app è verticale, ma sul web e
 * su tablet il testo non deve stendersi per tutto lo schermo.
 */
export const MaxContentWidth = 560;
