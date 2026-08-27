import Svg, { Path } from 'react-native-svg';

import { Brand } from '@/theme';

/**
 * Il monogramma Revna: la «R» tagliata in diagonale da cui viene la smussatura di
 * tutto il sistema.
 *
 * Il tracciato è esportato perché serve anche a `components/ui/mark.tsx`, che
 * disegna monogramma e quadrato arancione **dentro lo stesso** `Svg`: il segno è
 * un grafico solo, e due `Svg` sovrapposti sono due livelli che una piattaforma
 * può decidere di comporre a modo suo.
 *
 * I numeri sono arrotondati alla terza cifra: i file originali del brand ne hanno
 * diciotto e omettono il separatore fra un numero e il successivo, che è SVG
 * valido ma è la forma che i parser dei path digeriscono peggio.
 */
export const MONOGRAM_PATH = 'M255.481 0H82.215c-0.82 0 -1.621 0.247 -2.298 0.708L1.785 53.92c-1.116 0.76 -1.785 2.024 -1.785 3.375v135.341c0 3.254 3.621 5.201 6.335 3.405l72.791 -48.154c1.143 -0.756 1.83 -2.035 1.83 -3.405v-59.442c0 -2.255 1.828 -4.083 4.083 -4.083h89.484c2.255 0 4.083 1.828 4.083 4.083v42.665c0 1.402 -0.719 2.706 -1.906 3.454l-123.299 77.73c-3.463 2.183 -1.916 7.537 2.177 7.537h118.945c2.255 0 4.083 1.828 4.083 4.083v116.915c0 3.583 4.286 5.429 6.889 2.965l72.791 -68.886c0.815 -0.771 1.276 -1.844 1.276 -2.965v-78.002c0 -1.869 -1.269 -3.499 -3.081 -3.958l-35.435 -8.972c-3.405 -0.862 -4.204 -5.337 -1.308 -7.325l38.05 -26.105c1.11 -0.761 1.773 -2.021 1.773 -3.367V4.083c0 -2.255 -1.828 -4.083 -4.083 -4.083Z';

/** Il riquadro del tracciato, da cui si ricavano proporzioni e scala. */
export const MONOGRAM_BOX = { width: 259.56, height: 341.51 } as const;

type Props = {
  /** Altezza in px; la larghezza si ricava dalle proporzioni. */
  height?: number;
  color?: string;
};

/** Il monogramma da solo, senza il suo quadrato: l'angolo della schermata d'accesso. */
export function Monogram({ height = 14, color = Brand.accent }: Props) {
  return (
    <Svg
      width={(height * MONOGRAM_BOX.width) / MONOGRAM_BOX.height}
      height={height}
      viewBox={`0 0 ${MONOGRAM_BOX.width} ${MONOGRAM_BOX.height}`}>
      <Path d={MONOGRAM_PATH} fill={color} />
    </Svg>
  );
}
