import { useLocalSearchParams } from 'expo-router';
import { confirmPasswordReset, signInWithEmailAndPassword, verifyPasswordResetCode } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand-logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getFirebaseAuth } from '@/lib/firebase';

const MIN_PASSWORD = 8;

/**
 * Attivazione dell'account: il cliente sceglie qui la sua password, dentro l'app.
 *
 * Ci si arriva dal link nell'email (deep link `revnaai://attiva?code=...`) oppure
 * incollando a mano il codice, utile quando il deep link non scatta.
 */
export default function ActivationScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();

  const [code, setCode] = useState(params.code ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Il codice arrivato dal link viene validato subito: così il cliente scopre
  // un link scaduto prima di scegliere la password, non dopo.
  useEffect(() => {
    const incoming = params.code;
    if (!incoming) return;

    setVerifying(true);
    verifyPasswordResetCode(getFirebaseAuth(), incoming)
      .then(setEmail)
      .catch((cause) => setError(describeError(cause)))
      .finally(() => setVerifying(false));
  }, [params.code]);

  async function verifyManualCode() {
    if (code.trim() === '') return;
    setVerifying(true);
    setError('');
    try {
      setEmail(await verifyPasswordResetCode(getFirebaseAuth(), code.trim()));
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setVerifying(false);
    }
  }

  const passwordsMatch = password.length >= MIN_PASSWORD && password === confirmation;

  async function activate() {
    if (!passwordsMatch || busy) return;
    setBusy(true);
    setError('');
    try {
      const auth = getFirebaseAuth();
      await confirmPasswordReset(auth, code.trim(), password);
      // Password impostata: entriamo subito, senza far ridigitare le credenziali.
      await signInWithEmailAndPassword(auth, email, password);
    } catch (cause) {
      setError(describeError(cause));
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
            {email ? `Attiva l'accesso di ${email}` : 'Attiva il tuo accesso'}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.form}>
          {verifying && <ActivityIndicator color={theme.primary} />}

          {!email && !verifying && (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Incolla il codice che trovi nell'email di attivazione.
              </ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholder="Codice di attivazione"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                value={code}
                onChangeText={setCode}
              />
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary, opacity: code.trim() ? 1 : 0.5 }]}
                disabled={code.trim() === ''}
                onPress={verifyManualCode}>
                <ThemedText type="smallBold" style={styles.buttonLabel}>
                  Continua
                </ThemedText>
              </TouchableOpacity>
            </>
          )}

          {email !== '' && (
            <>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholder={`Nuova password (min ${MIN_PASSWORD} caratteri)`}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholder="Ripeti la password"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                secureTextEntry
                value={confirmation}
                onChangeText={setConfirmation}
                onSubmitEditing={activate}
              />
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary, opacity: passwordsMatch && !busy ? 1 : 0.5 }]}
                disabled={!passwordsMatch || busy}
                onPress={activate}>
                <ThemedText type="smallBold" style={styles.buttonLabel}>
                  {busy ? 'Attivazione in corso…' : 'Attiva ed entra'}
                </ThemedText>
              </TouchableOpacity>
            </>
          )}

          {error !== '' && (
            <ThemedText type="small" style={{ color: '#B3261E' }}>
              {error}
            </ThemedText>
          )}
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

function describeError(cause: unknown): string {
  switch ((cause as { code?: string }).code) {
    case 'auth/expired-action-code':
      return 'Il link di attivazione è scaduto. Chiedi al tuo referente Revna di rimandartelo.';
    case 'auth/invalid-action-code':
      return 'Codice di attivazione non valido o già usato.';
    case 'auth/user-disabled':
      return 'Questa utenza è stata disattivata.';
    case 'auth/weak-password':
      return 'Password troppo debole: usane una più lunga.';
    default:
      return cause instanceof Error ? cause.message : 'Attivazione non riuscita.';
  }
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
  },
  button: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center' },
  buttonLabel: { color: '#FFFFFF' },
  centeredText: { textAlign: 'center' },
});
