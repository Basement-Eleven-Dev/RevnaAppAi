import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { Brand } from '@/theme';

type Props = {
  /** Diametro dell'alone in px. */
  size: number;
  /** Opacità al centro; ai bordi va a zero. */
  opacity?: number;
  /** Posizione rispetto al genitore: l'alone non occupa spazio nel layout. */
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
};

/**
 * L'alone dell'accento.
 *
 * Un gradiente radiale e non un'ombra: su una superficie smussata l'ombra di
 * sistema seguirebbe il rettangolo del box, non la diagonale, e su Android non si
 * potrebbe nemmeno colorare. Così invece la luce è la stessa su tutte le
 * piattaforme.
 *
 * Si usa in due posti e basta: dietro il monogramma quando l'assistente è in
 * attesa di una domanda, e nell'angolo della schermata d'accesso.
 */
export function AccentGlow({ size, opacity = 0.22, top, left, right, bottom }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      pointerEvents="none"
      style={[styles.glow, { top, left, right, bottom }]}>
      <Defs>
        <RadialGradient id="accentGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={Brand.accent} stopOpacity={opacity} />
          <Stop offset="70%" stopColor={Brand.accent} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#accentGlow)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute' },
});
