import { StyleSheet, View } from 'react-native';

import { Bevel } from '@/components/ui/bevel';
import { Tap } from '@/components/ui/motion';
import { Text } from '@/components/ui/text';
import { Brand, Corner, Family, Ink, smoke, Spacing, Surface } from '@/theme';

/**
 * Il chip di una fonte (Componenti · 03): il numero in accento, il titolo accanto.
 *
 * I numeri sono gli stessi marcatori che compaiono in apice dentro la risposta,
 * così si risale da una singola affermazione al materiale che la sostiene — non
 * dalla risposta nel suo insieme. È la differenza fra questo assistente e un
 * modello generico con un logo sopra.
 */
export function SourceChip({ n, label, onPress }: { n: number; label: string; onPress?: () => void }) {
  const content = (
    <Bevel radius={Corner.badge + 2} fill={smoke(0.055)} style={styles.chip}>
      <Text variant="mono" color={Brand.accent} style={styles.chipNumber}>
        {n}
      </Text>
      <Text variant="tab" color={Ink.secondary} style={styles.chipLabel}>
        {label}
      </Text>
    </Bevel>
  );

  if (!onPress) return content;

  return (
    <Tap onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {content}
    </Tap>
  );
}

/** Il marcatore in apice dentro il testo di una risposta. */
export function SourceMarker({ n }: { n: number }) {
  return (
    <Text variant="mono" color={Brand.accent} style={styles.marker}>
      {n}
    </Text>
  );
}

export type ChipTone = 'accent' | 'neutral' | 'quiet';

/**
 * Lo stato di qualcosa (Componenti · 03): tre toni, dal vivo allo spento.
 *
 * `accent` con il pallino è lo stato che aspetta una mossa di qualcun altro,
 * `neutral` quello in corso, `quiet` quello concluso: chiuso non deve più
 * chiamare l'occhio.
 */
export function StatusChip({ label, tone = 'neutral' }: { label: string; tone?: ChipTone }) {
  const skin = TONES[tone];

  return (
    <Bevel radius={Corner.badge} fill={skin.fill} style={styles.status}>
      {tone === 'accent' && <View style={styles.dot} />}
      <Text variant="tab" color={skin.label} style={styles.statusLabel}>
        {label}
      </Text>
    </Bevel>
  );
}

/** Etichetta di formato o di novità: una parola sola, in maiuscoletto. */
export function Tag({ label, color = Brand.accent }: { label: string; color?: string }) {
  return (
    <Text variant="micro" color={color} style={styles.tag}>
      {label}
    </Text>
  );
}

/**
 * Il blocco del formato di un file (schermata 07): il tipo è la prima cosa che si
 * vuole sapere di un documento, quindi diventa un rettangolo a sinistra.
 */
export function FormatBlock({ label, highlight = false }: { label: string; highlight?: boolean }) {
  return (
    <Bevel
      radius={Corner.control + 1}
      fill={highlight ? Surface.accentStrong : smoke(0.09)}
      style={styles.format}>
      <Text
        variant="tab"
        color={highlight ? Brand.accent : Ink.secondary}
        style={styles.formatLabel}>
        {label}
      </Text>
    </Bevel>
  );
}

const TONES: Record<ChipTone, { fill: string; label: string }> = {
  accent: { fill: Surface.accentTint, label: Brand.accent },
  neutral: { fill: smoke(0.08), label: Ink.secondary },
  quiet: { fill: smoke(0.04), label: Ink.muted },
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm - 2,
    paddingHorizontal: Spacing.md - 1,
    paddingVertical: Spacing.sm - 1,
  },
  chipNumber: { fontSize: 9.5 },
  chipLabel: { fontFamily: Family.sansMedium, fontSize: 11.5 },
  marker: { fontFamily: Family.mono, fontSize: 10 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
  },
  statusLabel: { fontSize: 11 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Brand.accent },
  tag: { letterSpacing: 1.1 },
  format: { width: 38, height: 46, alignItems: 'center', justifyContent: 'center' },
  formatLabel: { fontFamily: Family.sansBold, fontSize: 10 },
});
