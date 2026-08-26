import { useLocalSearchParams } from 'expo-router';
import { confirmPasswordReset, signInWithEmailAndPassword, verifyPasswordResetCode } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand-logo';
import { LegalLinks } from '@/components/legal-links';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useT } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { authErrorMessage, MIN_PASSWORD } from '@/lib/auth';
import { getFirebaseAuth } from '@/lib/firebase';

/**
 * Il cliente sceglie qui la sua password, dentro l'app.
 *
 * Ci si arriva dal link nell'email (deep link `revnaai://attiva?code=...`) oppure
 * incollando a mano il codice, utile quando il deep link non scatta.
 *
 * Serve due momenti con lo stesso codice: la prima attivazione e il recupero
 * della password. Firebase non li distingue — è lo stesso `oobCode` in entrambi i
 * casi — quindi a dirlo è il parametro `reset` che l'email di recupero porta con
 * sé. Cambia solo cosa legge il cliente: il meccanismo è identico, e sdoppiare lo
 * schermo vorrebbe dire mantenere due volte la stessa gestione del codice.
 */
export default function ActivationScreen() {
  const theme = useTheme();
  const t = useT();
  const params = useLocalSearchParams<{ code?: string; reset?: string }>();

  // I parametri di un deep link sono sempre stringhe: `reset=1` è la forma che
  // scrive l'email, ma qualunque valore non vuoto vale come «sì».
  const isReset = (params.reset ?? '') !== '';
  const testi = isReset ? t.attivazione.reset : t.attivazione;
  const conferma = isReset ? t.attivazione.reset.conferma : t.attivazione.attiva;

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
      .catch((cause) => setError(authErrorMessage(t, cause, testi.fallita)))
      .finally(() => setVerifying(false));
  }, [params.code, t, testi]);

  async function verifyManualCode() {
    if (code.trim() === '') return;
    setVerifying(true);
    setError('');
    try {
      setEmail(await verifyPasswordResetCode(getFirebaseAuth(), code.trim()));
    } catch (cause) {
      setError(authErrorMessage(t, cause, testi.fallita));
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
      setError(authErrorMessage(t, cause, testi.fallita));
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
            {email ? testi.titoloPer(email) : testi.titolo}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.form}>
          {verifying && <ActivityIndicator color={theme.primary} />}

          {!email && !verifying && (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {testi.incollaCodice}
              </ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholder={testi.codice}
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
                  {t.comune.continua}
                </ThemedText>
              </TouchableOpacity>
            </>
          )}

          {email !== '' && (
            <>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholder={t.attivazione.nuovaPassword(MIN_PASSWORD)}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholder={t.attivazione.ripetiPassword}
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
                  {busy ? testi.inCorso : conferma}
                </ThemedText>
              </TouchableOpacity>
            </>
          )}

          {error !== '' && (
            <ThemedText type="small" style={{ color: '#B3261E' }}>
              {error}
            </ThemedText>
          )}

          <LegalLinks nota={!isReset} />
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
  buttonLabel: { color: '#FFFFFF' },
  centeredText: { textAlign: 'center' },
});
