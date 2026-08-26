import { Link, Redirect } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand-logo';
import { LegalLinks } from '@/components/legal-links';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useT } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { authErrorMessage } from '@/lib/auth';
import { getFirebaseAuth, isFirebaseConfigured, missingFirebaseEnvKeys } from '@/lib/firebase';

export default function LoginScreen() {
  const theme = useTheme();
  const t = useT();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  if (user) {
    return <Redirect href="/chat" />;
  }

  const canSubmit = email.trim().length > 0 && password.length >= 6 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    } catch (cause) {
      setError(authErrorMessage(t, cause, t.login.fallito));
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
            {t.login.sottotitolo}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.form}>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            placeholder={t.comune.email}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            placeholder={t.comune.password}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoComplete="current-password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
          />

          {error !== '' && (
            <ThemedText type="small" style={{ color: '#B3261E' }}>
              {error}
            </ThemedText>
          )}

          {!isFirebaseConfigured && (
            <ThemedText type="code" themeColor="textSecondary">
              {t.login.firebaseDaConfigurare(missingFirebaseEnvKeys().join(', '))}
            </ThemedText>
          )}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary, opacity: canSubmit ? 1 : 0.5 }]}
            disabled={!canSubmit}
            onPress={submit}>
            <ThemedText type="smallBold" style={styles.buttonLabel}>
              {busy ? t.login.inCorso : t.login.accedi}
            </ThemedText>
          </TouchableOpacity>

          <Link href="/recupera" style={styles.centeredText}>
            <ThemedText type="small" themeColor="primary">
              {t.login.passwordDimenticata}
            </ThemedText>
          </Link>

          <Link href="/attiva" style={styles.centeredText}>
            <ThemedText type="small" themeColor="primary">
              {t.login.hoUnCodice}
            </ThemedText>
          </Link>

          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            {t.login.nessunAccesso}
          </ThemedText>

          <LegalLinks nota />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  button: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  buttonLabel: { color: '#FFFFFF' },
  centeredText: { textAlign: 'center' },
});
