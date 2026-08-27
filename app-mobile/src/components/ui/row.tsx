import { StyleSheet, View, type ViewProps } from 'react-native';

import { Bevel } from '@/components/ui/bevel';
import { ForwardIcon } from '@/components/ui/icon';
import { Tap } from '@/components/ui/motion';
import { Text } from '@/components/ui/text';
import { Brand, Corner, Ink, Line, Spacing, Surface } from '@/theme';

/**
 * Le righe d'elenco del sistema (Componenti · 03).
 *
 * Nel sistema Revna «da leggere» e «già letto» non sono la stessa riga con un
 * pallino in più: sono due componenti diversi. `AccentRow` è la card in accento
 * con la barra laterale, `QuietRow` è una riga di testo su una linea sottile.
 * Metterli a confronto in un elenco dice da lontano cosa richiede attenzione.
 */

type PressProps = { onPress?: () => void; accessibilityLabel?: string };

/** Riga che richiede attenzione: velatura in accento e barra laterale. */
export function AccentRow({
  title,
  body,
  meta,
  onPress,
  accessibilityLabel,
}: PressProps & { title: string; body?: string; meta?: string }) {
  return (
    <Touchable onPress={onPress} accessibilityLabel={accessibilityLabel ?? title}>
      <Bevel radius={Corner.card} fill={Surface.accentTint} style={styles.accentRow}>
        <View style={styles.bar} />
        <View style={styles.grow}>
          <Text variant="rowTitle">{title}</Text>
          {body ? (
            <Text variant="service" color={Ink.secondary} numberOfLines={3} style={styles.rowBody}>
              {body}
            </Text>
          ) : null}
          {meta ? (
            <Text variant="tab" color={Brand.accent} style={styles.rowMeta}>
              {meta}
            </Text>
          ) : null}
        </View>
      </Bevel>
    </Touchable>
  );
}

/** Riga già consumata: nessuna superficie, solo una linea sopra. */
export function QuietRow({
  title,
  meta,
  onPress,
  accessibilityLabel,
}: PressProps & { title: string; meta?: string }) {
  return (
    <Touchable onPress={onPress} accessibilityLabel={accessibilityLabel ?? title}>
      <View style={styles.quietRow}>
        <Text variant="service" color={Ink.secondary} style={styles.quietTitle}>
          {title}
        </Text>
        {meta ? (
          <Text variant="tab" color={Ink.ghost} style={styles.rowMeta}>
            {meta}
          </Text>
        ) : null}
      </View>
    </Touchable>
  );
}

/**
 * Tessera a piena larghezza: gli spunti della chat vuota e le righe che si
 * aprono. A piena larghezza e non tre bottoni in fila: si legge con una mano.
 */
export function Tile({
  onPress,
  accessibilityLabel,
  chevron = true,
  style,
  children,
}: PressProps & ViewProps & { chevron?: boolean }) {
  return (
    <Touchable onPress={onPress} accessibilityLabel={accessibilityLabel}>
      <Bevel radius={Corner.card - 2} fill={Surface.element} style={[styles.tile, style]}>
        <View style={styles.grow}>{children}</View>
        {chevron && <ForwardIcon color={Ink.faint} />}
      </Bevel>
    </Touchable>
  );
}

/**
 * Un `Tap` che sparisce quando non c'è niente da toccare.
 *
 * Non è un `Tap` disabilitato: una riga che non si apre non deve avere un ruolo
 * d'accessibilità «bottone», e non deve nemmeno cedere sotto il dito.
 */
function Touchable({
  onPress,
  accessibilityLabel,
  children,
}: PressProps & { children: React.ReactNode }) {
  if (!onPress) return <>{children}</>;

  return (
    <Tap onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {children}
    </Tap>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  accentRow: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg },
  bar: { width: 3, alignSelf: 'stretch', backgroundColor: Brand.accent },
  rowBody: { marginTop: Spacing.xs },
  rowMeta: { marginTop: Spacing.sm + 2 },
  quietRow: {
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Line.hairline,
  },
  quietTitle: { fontSize: 14, lineHeight: 19 },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg - 1,
  },
});
