import { StyleSheet, View } from 'react-native';

import Monogram from '@/assets/images/brand/revna_R.svg';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Intestazione dei messaggi dell'assistente.
 *
 * Dichiara in chiaro che chi scrive è un'intelligenza artificiale: è un requisito
 * di trasparenza, non un dettaglio grafico, e va tenuto visibile su ogni risposta.
 */
export function AssistantBadge() {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
        <Monogram width={11} height={14} />
      </View>
      <ThemedText type="smallBold">Revna AI</ThemedText>
      <View style={[styles.tag, { borderColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.tagLabel}>
          Risposta generata da AI
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  tagLabel: { fontSize: 11, lineHeight: 16 },
});
