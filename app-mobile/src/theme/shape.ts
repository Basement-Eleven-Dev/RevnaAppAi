/**
 * La forma del sistema Revna (Fondamenta · 01): la smussatura.
 *
 * Due angoli e sempre gli stessi due — alto a sinistra e basso a destra —
 * proporzionati al box. La diagonale non si specchia e non si somma: un box
 * smussato su tutti e quattro gli angoli non è più il segno Revna, è un ottagono.
 *
 * In React Native `clip-path` non esiste. La smussatura la disegna
 * `components/ui/bevel.tsx` con `react-native-svg`, con un `Path` di fondo che fa
 * sia riempimento sia bordo, così la diagonale ha il filo come gli altri lati. I
 * quattro valori stanno qui, e le schermate scelgono fra questi quattro: è
 * l'unico modo per non ridisegnare la smussatura schermata per schermata.
 */

export const Corner = {
  /** Superfici a piena larghezza: pannelli, fogli, schermate intere. */
  surface: 22,
  /** Card e blocchi di contenuto. */
  card: 14,
  /** Bottoni, campi, bottoni icona. */
  control: 8,
  /** Badge, chip, contatori. */
  badge: 4,
} as const;

/**
 * Il contorno smussato di un box `width` × `height`, come `d` di un `Path` SVG.
 *
 * Il taglio si accorcia da sé sui box piccoli — mezzo lato è il massimo che una
 * diagonale può prendersi senza mangiare il box: così un badge alto 20px con il
 * raggio della card non degenera in un triangolo.
 */
export function bevelPath(width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));

  return [
    `M ${r} 0`,
    `L ${width} 0`,
    `L ${width} ${height - r}`,
    `L ${width - r} ${height}`,
    `L 0 ${height}`,
    `L 0 ${r}`,
    'Z',
  ].join(' ');
}
