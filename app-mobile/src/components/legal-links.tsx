import { StyleSheet, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { LegalUrls } from '@/constants/legal';
import { useT } from '@/hooks/use-language';

/**
 * Piè di pagina delle schermate di accesso: privacy policy e trattamento dei dati.
 *
 * Le pagine si aprono nel browser dentro l'app (`ExternalLink`) e non in Safari o
 * Chrome: chi sta scegliendo una password non deve uscire dall'app per leggere
 * un'informativa e poi ritrovare la strada per tornare indietro.
 *
 * `nota` è la riga di contesto sopra i due link. Si mostra dove c'è un consenso da
 * dare — accesso e attivazione — e si tace dove non c'è: nel recupero password non
 * si sta accettando niente, si sta solo chiedendo un link.
 */
export function LegalLinks({ nota = false }: { nota?: boolean }) {
  const t = useT();

  return (
    <View style={styles.container}>
      {nota && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.nota}>
          {t.legale.nota}
        </ThemedText>
      )}

      <View style={styles.links}>
        <ExternalLink href={LegalUrls.privacy}>
          <ThemedText type="small" themeColor="primary">
            {t.legale.privacy}
          </ThemedText>
        </ExternalLink>

        <ThemedText type="small" themeColor="textSecondary" accessibilityElementsHidden>
          ·
        </ThemedText>

        <ExternalLink href={LegalUrls.trattamentoDati}>
          <ThemedText type="small" themeColor="primary">
            {t.legale.trattamentoDati}
          </ThemedText>
        </ExternalLink>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two, marginTop: Spacing.two },
  nota: { textAlign: 'center' },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
});
