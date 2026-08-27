import { StyleSheet, View, type ViewProps } from 'react-native';

import { Bevel } from '@/components/ui/bevel';
import { Corner, Glass, Line } from '@/theme';

/**
 * Il vetro del sistema (Fondamenta · 01): solo ciò che galleggia ne ha.
 *
 * La ricetta è nero al 62–86% con una linea di luce a 1px in cima. La sfocatura
 * vera — `blur(28px)` — chiede un modulo nativo che l'app non ha ancora: a
 * quest'opacità la differenza è quasi solo sul contenuto che passa sotto, e il
 * segno che conta (la linea di luce) c'è. Quando servirà, il posto dove
 * aggiungerla è qui e solo qui.
 */

/** Barra ancorata a un bordo dello schermo: la tab bar. */
export function GlassBar({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.bar, style]} {...rest}>
      {children}
    </View>
  );
}

/** Elemento che galleggia sul contenuto e ha una forma sua: il composer. */
export function GlassPanel({ style, children, ...rest }: ViewProps) {
  return (
    <Bevel
      radius={Corner.card}
      fill={Glass.floating}
      highlight={Line.glass}
      style={style}
      {...rest}>
      {children}
    </Bevel>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Glass.bar,
    borderTopWidth: 1,
    borderTopColor: Line.hairline,
  },
});
