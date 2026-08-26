import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand-logo';
import { LegalLinks } from '@/components/legal-links';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useT } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { authErrorMessage, requestPasswordReset } from '@/lib/auth';

/**
 * Recupero della password: il cliente chiede il link, poi lo riceve per email.
 *
 * La schermata non sa — e non deve sapere — se l'email esiste: la conferma è la
 * stessa in entrambi i casi. Chi ha sbagliato indirizzo se ne accorge perché non
 * riceve niente, non perché glielo diciamo noi.
 *
 * Il link porta su `/attiva`, che è lo stesso schermo dell'attivazione: da lì in
 * poi le due strade sono la stessa cosa — un codice e una password nuova.
 */
export default function RecoverScreen() {
  const theme = useTheme();
  const t = useT();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  const canSubmit = email.trim().length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    const wanted = email.trim().toLowerCase();

    setBusy(true);
    setError('');
    try {
      await requestPasswordReset(wanted);
      setSentTo(wanted);
    } catch (cause) {
      setError(authErrorMessage(t, cause, t.recupero.fallito));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.hero}>
          <BrandLogo width={200} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            {t.recupero.titolo}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.form}>
          {sentTo === '' ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {t.recupero.sottotitolo}
              </ThemedText>

              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholder={t.comune.email}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoComplete="email"
                autoFocus
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={submit}
              />

              {error !== '' && (
                <ThemedText type="small" style={styles.error}>
                  {error}
                </ThemedText>
              )}

              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: theme.primary, opacity: canSubmit ? 1 : 0.5 },
                ]}
                disabled={!canSubmit}
                onPress={submit}>
                <ThemedText type="smallBold" style={styles.buttonLabel}>
                  {busy ? t.recupero.inCorso : t.recupero.invia}
                </ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ThemedText type="small" themeColor="primary">
                {t.recupero.fatto(sentTo)}
              </ThemedText>

              {/* Rimandare indietro invece di rinviare subito: il secondo invio
                  invalida il codice del primo, e la mail più vecchia è spesso
                  quella che il cliente ha già aperto. */}
              <TouchableOpacity
                style={[styles.button, styles.buttonGhost, { borderColor: theme.border }]}
                onPress={() => {
                  setSentTo('');
                  setError('');
                }}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t.recupero.riprova}
                </ThemedText>
              </TouchableOpacity>
            </>
          )}

          {/* `dismissTo` e non un push: si torna alla schermata di accesso che c'è
              già nello stack, non se ne impila una seconda. */}
          <Link href="/login" dismissTo style={styles.centeredText}>
            <ThemedText type="small" themeColor="primary">
              {t.recupero.tornaAllAccesso}
            </ThemedText>
          </Link>

          <LegalLinks />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  form: { gap: Spacing.three },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    // I campi non passano da ThemedText: il font del brand va detto qui.
    fontFamily: Fonts.sans,
  },
  button: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center' },
  buttonGhost: { borderWidth: 1 },
  buttonLabel: { color: '#FFFFFF' },
  centeredText: { textAlign: 'center' },
  error: { color: '#B3261E' },
});
