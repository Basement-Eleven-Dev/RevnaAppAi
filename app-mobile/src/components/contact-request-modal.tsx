import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Appear, Bevel, Button, Field, FieldNote, Text } from '@/components/ui';
import { useT } from '@/hooks/use-language';
import { MAX_MESSAGE_CHARS } from '@/lib/contact-requests';
import { Corner, Duration, Glass, Ink, Line, Spacing, Surface } from '@/theme';

type Props = {
  visible: boolean;
  /**
   * Il testo di partenza. Quando arriva dall'assistente è la sua proposta, e la
   * schermata lo dice: chi sta per firmare una richiesta deve sapere chi l'ha scritta.
   */
  draft?: string;
  onClose: () => void;
  onConfirm: (messaggio: string) => Promise<void>;
};

/**
 * La conferma di una richiesta di contatto.
 *
 * È una modale e non una schermata perché interrompe: si arriva qui in mezzo a una
 * conversazione o scorrendo un elenco, e alla fine si torna dove si era. Ed è una
 * modale con un campo modificabile e non un semplice «Sei sicuro?» perché la
 * richiesta la scrive il cliente — l'assistente può proporre le parole, ma quelle
 * che partono devono essere quelle che il cliente ha letto e ha voluto.
 *
 * Il foglio galleggia, quindi ha il vetro e la linea di luce in cima: la
 * smussatura è quella delle superfici, la più larga del sistema.
 *
 * **Il velo sfuma, il foglio sale.** Sono due movimenti e non uno perché sono due
 * cose: lo `slide` di serie fa scorrere verso l'alto tutto il contenitore, velo
 * compreso, e un velo che entra da sotto si vede per quello che è — una tendina
 * nera tirata su. Così invece il fondo si oscura dove sta, e l'unica cosa che si
 * muove è il foglio, nei 320 ms che il sistema dà a un foglio.
 */
export function ContactRequestModal({ visible, draft, onClose, onConfirm }: Props) {
  const t = useT();
  // Il testo parte dalla proposta e da lì è del cliente. Riaprire la modale su
  // un'altra proposta non lo risincronizza da qui: chi la apre passa una `key`
  // diversa e questo stato nasce di nuovo (vedi chi usa il componente).
  const [text, setText] = useState(draft ?? '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    const messaggio = text.trim();
    if (!messaggio) {
      setError(t.richieste.modale.vuota);
      return;
    }

    setSending(true);
    setError('');
    try {
      await onConfirm(messaggio);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.richieste.modale.fallita);
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={sending ? undefined : onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Il tocco fuori chiude, come si aspetta chiunque abbia già visto una modale. */}
        <Pressable style={styles.flex} onPress={sending ? undefined : onClose} />

        <Appear rise={40} duration={Duration.sheet} style={styles.sheet}>
          <Bevel
            radius={Corner.surface}
            fill={Surface.raised}
            highlight={Line.glass}
            style={styles.flexShrink}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text variant="section">{t.richieste.modale.titolo}</Text>
              <Text variant="service" color={Ink.secondary} style={styles.help}>
                {draft ? t.richieste.modale.aiutoProposta : t.richieste.modale.aiuto}
              </Text>

              <Field
                multiline
                placeholder={t.richieste.modale.placeholder}
                autoFocus
                maxLength={MAX_MESSAGE_CHARS}
                value={text}
                onChangeText={setText}
                editable={!sending}
              />

              {error !== '' && <FieldNote tone="error">{error}</FieldNote>}

              <View style={styles.actions}>
                <Button
                  label={t.comune.annulla}
                  variant="secondary"
                  disabled={sending}
                  onPress={onClose}
                />
                <Button
                  label={t.richieste.modale.conferma}
                  loading={sending}
                  loadingLabel={t.richieste.modale.inCorso}
                  onPress={confirm}
                />
              </View>
            </ScrollView>
          </Bevel>
        </Appear>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: Glass.scrim },
  sheet: { maxHeight: '86%' },
  // Il foglio sta dentro la sua entrata, che è quella con l'altezza massima: senza
  // questo, un messaggio lungo lo farebbe uscire dal contenitore invece di
  // rendere scorrevole il contenuto.
  flexShrink: { flexShrink: 1 },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.huge - 8,
    gap: Spacing.md,
  },
  help: { lineHeight: 20 },
  actions: { gap: Spacing.sm + 1, marginTop: Spacing.xs },
});
