import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Bevel } from '@/components/ui/bevel';
import { Button } from '@/components/ui/button';
import { Appear } from '@/components/ui/motion';
import { Text } from '@/components/ui/text';
import { Corner, Duration, Glass, Ink, Line, Spacing, Surface } from '@/theme';

/**
 * «Sei sicuro?», nel sistema Revna.
 *
 * Esiste perché l'`Alert` di React Native **non esiste sul web**: in
 * react-native-web `Alert.alert` è una funzione vuota (`static alert() {}`), quindi
 * ogni conferma affidata a lei era un tocco che non faceva niente — non un errore,
 * non un messaggio, niente. Un'app che gira anche in un browser non può avere le sue
 * azioni distruttive appese a una funzione che su una delle sue piattaforme è un
 * segnaposto.
 *
 * Ed è un guadagno anche dove `Alert` funzionava: la finestra di sistema arriva col
 * font, gli angoli e i bottoni del sistema operativo, in mezzo a un'app che ha i
 * propri. Questo foglio è fatto degli stessi atomi di tutto il resto.
 *
 * Il foglio galleggia, quindi ha il vetro e la linea di luce in cima, come la modale
 * delle richieste di contatto (`components/contact-request-modal.tsx`) — da cui prende
 * anche i due movimenti separati: il velo sfuma dove sta, l'unica cosa che si muove è
 * il foglio.
 *
 * Non tiene stato e non aspetta niente: chi lo usa chiude e agisce, e mostra l'attesa
 * dove l'attesa si vede meglio, cioè sul bottone che ha aperto la conferma.
 */
export function ConfirmSheet({
  visible,
  titolo,
  testo,
  conferma,
  annulla,
  /** `danger` è il default: un foglio di conferma nasce quasi sempre da un'azione che distrugge. */
  tone = 'danger',
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  titolo: string;
  testo: string;
  /** L'etichetta dell'azione, che dice **cosa fa** e non «Ok»: «Dimentica», «Cancella tutto». */
  conferma: string;
  annulla: string;
  tone?: 'danger' | 'primary';
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        {/* Il tocco fuori annulla: su una conferma è la risposta prudente. */}
        <Pressable style={styles.flex} onPress={onCancel} accessibilityLabel={annulla} />

        <Appear rise={40} duration={Duration.sheet}>
          <Bevel radius={Corner.surface} fill={Surface.raised} highlight={Line.glass}>
            <View style={styles.content}>
              <Text variant="section">{titolo}</Text>
              <Text variant="service" color={Ink.secondary} style={styles.body}>
                {testo}
              </Text>

              {/* L'azione sotto e l'annullamento sopra: l'ultimo bottone prima del
                  bordo è quello che il pollice trova, e su una conferma distruttiva
                  è giusto che sia quello di cui si è appena letto il testo. */}
              <View style={styles.actions}>
                <Button label={annulla} variant="secondary" onPress={onCancel} />
                <Button label={conferma} variant={tone} onPress={onConfirm} />
              </View>
            </View>
          </Bevel>
        </Appear>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: Glass.scrim },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.huge - 8,
    gap: Spacing.md,
  },
  body: { lineHeight: 20 },
  actions: { gap: Spacing.sm + 1, marginTop: Spacing.xs },
});
