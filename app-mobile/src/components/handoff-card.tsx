import { StyleSheet, View } from 'react-native';

import { AccentCard, Appear, BlockLabel, Button, Text } from '@/components/ui';
import { useT } from '@/hooks/use-language';
import { Brand, Ink, Spacing } from '@/theme';

/**
 * L'offerta di essere ricontattati, sotto la risposta che l'ha motivata.
 *
 * Sta lì e non in fondo alla schermata perché è la coda di quella risposta: è
 * quando si legge «questo non me ne occupo io» che ha senso chiedere una persona,
 * e un bottone lontano da quella frase costringerebbe a ricordarsi perché era
 * comparso.
 *
 * Il testo proposto si legge già qui, prima di aprire qualsiasi cosa: chi sta per
 * firmare una richiesta deve sapere cosa c'è scritto. «Rivedi e invia» apre il
 * foglio in cui correggerlo — l'assistente propone le parole, quelle che partono
 * sono quelle che il cliente ha letto e ha voluto.
 *
 * Entra in scena, ed è l'entrata che più conta nell'app: compare **dopo** che la
 * risposta ha finito di scriversi, sotto un testo che il cliente sta già leggendo.
 * Senza, sono due bottoni che sbucano sotto le dita mentre si scorre.
 */
export function HandoffCard({
  proposal,
  onReview,
  onDismiss,
}: {
  proposal: string;
  onReview: () => void;
  onDismiss: () => void;
}) {
  const t = useT();

  return (
    <Appear>
      <AccentCard style={styles.card}>
        <BlockLabel color={Brand.accent}>{t.richieste.tiFaccioRichiamare}</BlockLabel>
        <Text variant="service" color={Ink.body} style={styles.quote}>
          «{proposal}»
        </Text>
        <View style={styles.actions}>
          <View style={styles.grow}>
            <Button label={t.richieste.rivediEInvia} onPress={onReview} />
          </View>
          <Button
            label={t.richieste.noGrazie}
            variant="secondary"
            block={false}
            onPress={onDismiss}
          />
        </View>
        <Text variant="tab" color={Ink.faint} style={styles.note}>
          {t.richieste.testoModificabile}
        </Text>
      </AccentCard>
    </Appear>
  );
}

/** La conferma che resta al posto della card, a richiesta inviata. */
export function HandoffSent({ onGoToRequests }: { onGoToRequests: () => void }) {
  const t = useT();

  return (
    <Appear>
      <AccentCard style={styles.card}>
        <BlockLabel color={Brand.accent}>{t.richieste.inviata}</BlockLabel>
        <Text variant="service" color={Ink.body} onPress={onGoToRequests} style={styles.link}>
          {t.richieste.trovaInSezione}
        </Text>
      </AccentCard>
    </Appear>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: Spacing.lg },
  grow: { flex: 1 },
  quote: { fontSize: 13.5, lineHeight: 21, marginTop: Spacing.xs + 1 },
  actions: { flexDirection: 'row', gap: Spacing.sm + 1, marginTop: Spacing.md + 2 },
  note: { lineHeight: 16, marginTop: Spacing.md - 1 },
  link: { textDecorationLine: 'underline', marginTop: Spacing.xs + 1 },
});
