import { StyleSheet, View, type ViewProps } from 'react-native';

import { Bevel } from '@/components/ui/bevel';
import { Text } from '@/components/ui/text';
import { Corner, Ink, Line, Spacing, Surface as Fill } from '@/theme';

/**
 * Le superfici del sistema (Fondamenta · 01): tre piani, non un'ombra.
 *
 * Il contenuto sta sul nero. Una **card** è bianco al 4,5% e non ha bordo — il
 * bordo lo prende solo quando è in accento, cioè quando c'è qualcosa da fare o da
 * leggere. Solo ciò che galleggia ha vetro, e quello sta in `glass.tsx`.
 */
export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <Bevel radius={Corner.card} fill={Fill.card} style={[styles.card, style]} {...rest}>
      {children}
    </Bevel>
  );
}

/** Card in accento: un blocco che chiede attenzione, una volta per schermata. */
export function AccentCard({ style, children, ...rest }: ViewProps) {
  return (
    <Bevel
      radius={Corner.card}
      fill={Fill.accentWash}
      stroke={Line.accent}
      style={[styles.card, style]}
      {...rest}>
      {children}
    </Bevel>
  );
}

/** L'occhiello di un blocco: micro in maiuscoletto, sopra il contenuto. */
export function BlockLabel({ children, color }: { children: string; color?: string }) {
  return (
    <Text variant="micro" color={color} style={styles.blockLabel}>
      {children}
    </Text>
  );
}

/**
 * La tabella chiave/valore di una scheda: etichetta spenta a sinistra, valore
 * pieno a destra, una linea sottile fra le righe.
 */
export function DataRow({
  label,
  value,
  first = false,
}: {
  label: string;
  value: string;
  first?: boolean;
}) {
  if (!value) return null;

  return (
    <View style={[styles.dataRow, !first && styles.dataRowRuled]}>
      <Text variant="service" color={Ink.muted} style={styles.dataLabel}>
        {label}
      </Text>
      <Text variant="service" color={Ink.primary} style={styles.dataValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg + 1 },
  blockLabel: { marginBottom: Spacing.md + 2 },
  dataRow: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.md - 1 },
  dataRowRuled: { borderTopWidth: 1, borderTopColor: Line.hairline },
  dataLabel: { width: 92 },
  dataValue: { flex: 1 },
});
