import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Source } from '@/hooks/use-conversations';
import { useT } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';

/**
 * Il materiale Revna su cui poggia una risposta.
 *
 * I numeri corrispondono ai marcatori dentro il testo, così si può risalire da una
 * singola affermazione alla sua fonte e non solo alla risposta nel suo insieme.
 *
 * È la differenza fra questo assistente e un modello generico con un logo sopra: sta
 * in fondo alla risposta e non in cima perché non è un disclaimer, è una firma.
 */
export function Sources({ sources }: { sources: Source[] }) {
  const theme = useTheme();
  const t = useT();

  if (!sources.length) return null;

  return (
    <View style={[styles.block, { borderTopColor: theme.border }]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {t.assistente.materialeRevna}
      </ThemedText>

      {sources.map((source) => (
        <View key={source.n} style={styles.row}>
          <ThemedText type="smallBold" style={[styles.number, { color: theme.primary }]}>
            {source.n}
          </ThemedText>
          <ThemedText type="small" style={styles.titolo}>
            {source.titolo}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    gap: Spacing.two,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  row: { flexDirection: 'row', gap: Spacing.two },
  number: { minWidth: 14, fontSize: 12, lineHeight: 17 },
  titolo: { flex: 1, fontSize: 13, lineHeight: 17 },
});
