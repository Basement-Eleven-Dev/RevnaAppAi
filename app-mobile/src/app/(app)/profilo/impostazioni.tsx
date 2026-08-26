import { useRouter } from 'expo-router';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  verifyBeforeUpdateEmail,
  type User,
} from 'firebase/auth';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackIcon, CheckIcon } from '@/components/tab-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { authErrorMessage, MIN_PASSWORD } from '@/lib/auth';
import { LANGUAGES, LANGUAGE_NAMES } from '@/lib/i18n';

/**
 * Impostazioni del cliente: lingua dell'interfaccia e credenziali di accesso.
 *
 * Password ed email si cambiano da qui e non dal backoffice: sono le credenziali di
 * chi entra, e il consulente Revna non deve poterle né vedere né scegliere.
 * Entrambe le operazioni chiedono di nuovo la password attuale — è quello che
 * Firebase pretende per un'operazione sensibile, e ha senso anche per noi: il
 * telefono sbloccato di qualcun altro non basta a prendersi l'accesso.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={[styles.topbar, { borderBottomColor: theme.border }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel={t.comune.indietro}
            style={[styles.iconButton, { borderColor: theme.border }]}>
            <BackIcon color={theme.textSecondary} size={18} />
          </Pressable>
          <ThemedText type="smallBold" numberOfLines={1}>
            {t.impostazioni.titolo}
          </ThemedText>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <LanguageCard />
            {user && <PasswordCard user={user} />}
            {user && <EmailCard user={user} />}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function LanguageCard() {
  const theme = useTheme();
  const { language, setLanguage, t } = useLanguage();

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{t.impostazioni.lingua.titolo}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t.impostazioni.lingua.aiuto}
      </ThemedText>

      <View style={styles.options}>
        {LANGUAGES.map((option) => {
          const active = option === language;
          return (
            <Pressable
              key={option}
              onPress={() => setLanguage(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[
                styles.option,
                {
                  borderColor: active ? theme.primary : theme.border,
                  backgroundColor: active ? theme.backgroundSelected : 'transparent',
                },
              ]}>
              <ThemedText type="small" style={styles.optionLabel}>
                {LANGUAGE_NAMES[option]}
              </ThemedText>
              {active && <CheckIcon color={theme.primary} size={18} />}
            </Pressable>
          );
        })}
      </View>
    </ThemedView>
  );
}

function PasswordCard({ user }: { user: User }) {
  const theme = useTheme();
  const { t } = useLanguage();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const filled = current !== '' && next.length >= MIN_PASSWORD && repeat !== '';

  async function submit() {
    if (!filled || busy) return;

    // Il confronto si fa qui e non a ogni tasto: segnalare «non coincidono»
    // mentre si sta ancora scrivendo la seconda password è solo rumore.
    if (next !== repeat) {
      setDone('');
      setError(t.impostazioni.password.nonCoincidono);
      return;
    }

    setBusy(true);
    setError('');
    setDone('');
    try {
      await reauthenticate(user, current);
      await updatePassword(user, next);
      setCurrent('');
      setNext('');
      setRepeat('');
      setDone(t.impostazioni.password.fatto);
    } catch (cause) {
      setError(authErrorMessage(t, cause, t.impostazioni.password.fallito));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{t.impostazioni.password.titolo}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t.impostazioni.password.aiuto}
      </ThemedText>

      <Field
        placeholder={t.impostazioni.password.attuale}
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoComplete="current-password"
      />
      <Field
        placeholder={t.impostazioni.password.nuova(MIN_PASSWORD)}
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoComplete="new-password"
      />
      <Field
        placeholder={t.impostazioni.password.ripeti}
        value={repeat}
        onChangeText={setRepeat}
        secureTextEntry
        autoComplete="new-password"
        onSubmitEditing={submit}
      />

      <Feedback error={error} done={done} />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary, opacity: filled && !busy ? 1 : 0.5 }]}
        disabled={!filled || busy}
        onPress={submit}>
        <ThemedText type="smallBold" style={styles.buttonLabel}>
          {busy ? t.impostazioni.password.inCorso : t.impostazioni.password.salva}
        </ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

/**
 * Cambio dell'email di accesso.
 *
 * `verifyBeforeUpdateEmail` e non `updateEmail`: il cambio scatta solo quando il
 * cliente apre il link mandato al NUOVO indirizzo. Un refuso in fase di digitazione
 * quindi non lo chiude fuori dal suo account — finché non verifica, entra ancora
 * con l'email di prima.
 */
function EmailCard({ user }: { user: User }) {
  const theme = useTheme();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const filled = email.trim() !== '' && password !== '';

  async function submit() {
    if (!filled || busy) return;

    const wanted = email.trim().toLowerCase();
    if (wanted === user.email?.toLowerCase()) {
      setDone('');
      setError(t.impostazioni.emailAccesso.ugualeAllaAttuale);
      return;
    }

    setBusy(true);
    setError('');
    setDone('');
    try {
      await reauthenticate(user, password);
      await verifyBeforeUpdateEmail(user, wanted);
      setEmail('');
      setPassword('');
      setDone(t.impostazioni.emailAccesso.fatto(wanted));
    } catch (cause) {
      setError(authErrorMessage(t, cause, t.impostazioni.emailAccesso.fallito));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{t.impostazioni.emailAccesso.titolo}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t.impostazioni.emailAccesso.aiuto}
      </ThemedText>

      <View style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>
          {t.impostazioni.emailAccesso.attuale}
        </ThemedText>
        <ThemedText type="small" style={styles.rowValue}>
          {user.email}
        </ThemedText>
      </View>

      <Field
        placeholder={t.impostazioni.emailAccesso.nuova}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Field
        placeholder={t.impostazioni.emailAccesso.conferma}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        onSubmitEditing={submit}
      />

      <Feedback error={error} done={done} />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary, opacity: filled && !busy ? 1 : 0.5 }]}
        disabled={!filled || busy}
        onPress={submit}>
        <ThemedText type="smallBold" style={styles.buttonLabel}>
          {busy ? t.impostazioni.emailAccesso.inCorso : t.impostazioni.emailAccesso.salva}
        </ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

/**
 * Riprova le credenziali prima di un'operazione sensibile. Senza questo Firebase
 * risponde `auth/requires-recent-login` a chi ha la sessione aperta da un po' —
 * cioè quasi sempre, dato che qui la sessione dura.
 */
async function reauthenticate(user: User, password: string): Promise<void> {
  if (!user.email) return;
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
}

type FieldProps = React.ComponentProps<typeof TextInput>;

function Field({ style, ...rest }: FieldProps) {
  const theme = useTheme();

  return (
    <TextInput
      style={[styles.input, { color: theme.text, borderColor: theme.border }, style]}
      placeholderTextColor={theme.textSecondary}
      autoCapitalize="none"
      {...rest}
    />
  );
}

/** Esito dell'ultima operazione: l'errore in rosso, la conferma nel colore del brand. */
function Feedback({ error, done }: { error: string; done: string }) {
  if (error !== '') {
    return (
      <ThemedText type="small" style={{ color: '#B3261E' }}>
        {error}
      </ThemedText>
    );
  }

  if (done !== '') {
    return (
      <ThemedText type="small" themeColor="primary">
        {done}
      </ThemedText>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  flex: { flex: 1 },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  card: { gap: Spacing.two, padding: Spacing.four, borderRadius: Spacing.four },
  options: { gap: Spacing.two, marginTop: Spacing.one },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  optionLabel: { flex: 1 },
  row: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.one },
  rowLabel: { width: 110 },
  rowValue: { flex: 1 },
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
    marginTop: Spacing.one,
  },
  buttonLabel: { color: '#FFFFFF' },
});
