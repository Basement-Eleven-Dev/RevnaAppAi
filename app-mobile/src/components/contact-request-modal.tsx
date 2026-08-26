import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useT } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { MAX_MESSAGE_CHARS } from '@/lib/contact-requests';

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
 * Vale per entrambe le strade: dalla chat, dove il testo arriva già scritto, e dalla
 * sezione «Richieste», dove si parte dal foglio bianco.
 */
export function ContactRequestModal({ visible, draft, onClose, onConfirm }: Props) {
  const theme = useTheme();
  const t = useT();
  // Il testo parte dalla proposta e da lì è del cliente. Riaprire la modale su
  // un'altra proposta non lo risincronizza da qui: chi la apre passa una `key`
  // diversa e questo stato nasce di nuovo (vedi chi usa il componente). Costa una
  // riga in più a chi chiama e risparmia un effetto che rincorre le prop.
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
      animationType="slide"
      transparent
      onRequestClose={sending ? undefined : onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Il tocco fuori chiude, come si aspetta chiunque abbia già visto una modale. */}
        <Pressable style={styles.flex} onPress={sending ? undefined : onClose} />

        <ThemedView style={[styles.sheet, { borderColor: theme.border }]}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText type="smallBold" style={styles.title}>
              {t.richieste.modale.titolo}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.help}>
              {draft ? t.richieste.modale.aiutoProposta : t.richieste.modale.aiuto}
            </ThemedText>

            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
              placeholder={t.richieste.modale.placeholder}
              placeholderTextColor={theme.textSecondary}
              multiline
              autoFocus
              maxLength={MAX_MESSAGE_CHARS}
              value={text}
              onChangeText={setText}
              editable={!sending}
            />

            {error !== '' && (
              <ThemedText type="small" style={styles.error}>
                {error}
              </ThemedText>
            )}

            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                disabled={sending}
                style={[styles.button, styles.ghost, { borderColor: theme.border }]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t.comune.annulla}
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={confirm}
                disabled={sending}
                style={[
                  styles.button,
                  { backgroundColor: sending ? theme.backgroundSelected : theme.primary },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={sending ? undefined : styles.primaryLabel}
                  themeColor={sending ? 'textSecondary' : undefined}>
                  {sending ? t.richieste.modale.inCorso : t.richieste.modale.conferma}
                </ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    borderWidth: 1,
    maxHeight: '86%',
  },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.five },
  title: { fontSize: 18, lineHeight: 24 },
  help: { lineHeight: 20 },
  input: {
    minHeight: 132,
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
    // I campi non passano da ThemedText: il font del brand va detto qui.
    fontFamily: Fonts.sans,
  },
  error: { color: '#B3261E' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: { borderWidth: 1 },
  primaryLabel: { color: '#FFFFFF' },
});
