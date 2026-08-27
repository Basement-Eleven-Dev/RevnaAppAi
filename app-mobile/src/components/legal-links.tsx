import { StyleSheet, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { Text } from '@/components/ui';
import { LegalUrls } from '@/constants/legal';
import { useT } from '@/hooks/use-language';
import { Family, Ink, Spacing } from '@/theme';

/**
 * Il piè di pagina delle schermate d'accesso: chi apre l'accesso, e le due
 * informative.
 *
 * Una riga sola e in fondo, al 28% di White Smoke: è testo che va letto una volta
 * e che non deve competere con il campo su cui sta il pollice. Le pagine si aprono
 * nel browser dentro l'app — chi sta scegliendo una password non deve uscire per
 * leggere un'informativa e poi ritrovare la strada per tornare.
 *
 * `nota` è la riga di consenso: si mostra dove c'è un consenso da dare — accesso e
 * attivazione — e si tace dove non c'è, cioè nel recupero password.
 */
export function LegalLinks({ nota = false, intro }: { nota?: boolean; intro?: string }) {
  const t = useT();

  return (
    <View style={styles.container}>
      <Text variant="tab" color={Ink.ghost} style={styles.line}>
        {intro ? `${intro} ` : ''}
        {nota ? `${t.legale.nota} ` : ''}
        <ExternalLink href={LegalUrls.privacy} style={styles.link}>
          {t.legale.privacy}
        </ExternalLink>
        {' · '}
        <ExternalLink href={LegalUrls.trattamentoDati} style={styles.link}>
          {t.legale.trattamentoDati}
        </ExternalLink>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: Spacing.md },
  // Peso regolare e non semibold: è una nota a piè di pagina, non un'etichetta.
  line: { fontFamily: Family.sans, fontSize: 11, lineHeight: 17.6 },
  link: { color: Ink.faint },
});
