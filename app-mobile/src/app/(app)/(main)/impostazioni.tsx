import { useRouter } from 'expo-router';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  verifyBeforeUpdateEmail,
  type User,
} from 'firebase/auth';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import {
  BackIcon,
  Bevel,
  BlockLabel,
  Button,
  Card,
  CheckIcon,
  DataRow,
  Field,
  IconButton,
  PasswordField,
  Screen,
  ScreenBar,
  Tap,
  Text,
} from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useMemory } from '@/hooks/use-memory';
import { authErrorMessage, MIN_PASSWORD } from '@/lib/auth';
import { LANGUAGES, LANGUAGE_NAMES } from '@/lib/i18n';
import { Brand, Corner, Danger, Gutter, Ink, Line, Spacing, Surface } from '@/theme';

/**
 * Impostazioni del cliente: la memoria dell'assistente, la lingua dell'interfaccia
 * e le credenziali di accesso.
 *
 * La memoria sta in cima perché è la sola di cui valga la pena accorgersi: sono le
 * preferenze che il cliente ha dato all'assistente — come vuole le risposte, cosa non
 * deve fare — e nasconderle dietro una rotta loro le avrebbe rese una funzione da
 * cercare invece di una cosa che si controlla passando.
 *
 * Password ed email si cambiano da qui e non dal backoffice: sono le credenziali di
 * chi entra, e il consulente Revna non deve poterle né vedere né scegliere.
 * Entrambe le operazioni chiedono di nuovo la password attuale — è quello che
 * Firebase pretende per un'operazione sensibile, e ha senso anche per noi: il
 * telefono sbloccato di qualcun altro non basta a prendersi l'accesso.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();

  return (
    <Screen>
      <ScreenBar
        left={
          <IconButton onPress={() => router.back()} accessibilityLabel={t.comune.indietro}>
            <BackIcon color={Ink.secondary} />
          </IconButton>
        }>
        <Text variant="service" color={Ink.muted}>
          {t.impostazioni.titolo}
        </Text>
      </ScreenBar>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <MemoryCard />
          <LanguageCard />
          {user && <PasswordCard user={user} />}
          {user && <EmailCard user={user} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/**
 * Le preferenze che l'assistente ha imparato dal cliente, riga per riga.
 *
 * Preferenze e non dati della struttura: i numeri cambiano, e una lista di numeri che
 * si contraddicono è esattamente quello che il cliente non deve trovare qui (il perché
 * sta in `backend/functions/src/memory.ts`).
 *
 * Tre libertà e nient'altro: **correggere** una riga, **dimenticarne** una,
 * **cancellare tutto**. Aggiungerne una a mano no, ed è una scelta: se il cliente
 * potesse scrivere qui, questa smetterebbe di essere la memoria dell'assistente —
 * cioè quello che ha capito parlando, che è la cosa che vale la pena verificare — e
 * diventerebbe un secondo campo note, che nel profilo c'è già.
 *
 * L'elenco è in ascolto live: con una conversazione in corso su un altro dispositivo,
 * la riga nuova compare qui da sé.
 */
function MemoryCard() {
  const router = useRouter();
  const { t } = useLanguage();
  const { entries, loading, error } = useMemory();

  return (
    <Card>
      <BlockLabel>{t.impostazioni.memoria.titolo}</BlockLabel>
      <Text variant="service" color={Ink.secondary}>
        {loading ? t.comune.caricamento : t.impostazioni.memoria.conteggio(entries.length)}
      </Text>
      {error !== '' && (
        <Text variant="service" color={Danger.text} style={styles.memoryNote}>
          {error}
        </Text>
      )}
      <Button
        label={t.impostazioni.memoria.visualizza}
        variant="secondary"
        disabled={loading}
        onPress={() => router.push('/memoria')}
      />
    </Card>
  );
}

function LanguageCard() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <Card>
      <BlockLabel>{t.impostazioni.lingua.titolo}</BlockLabel>
      <Text variant="service" color={Ink.secondary}>
        {t.impostazioni.lingua.aiuto}
      </Text>

      <View style={styles.options}>
        {LANGUAGES.map((option) => {
          const active = option === language;

          return (
            <Tap
              key={option}
              onPress={() => setLanguage(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}>
              <Bevel
                radius={Corner.control}
                fill={active ? Surface.accentTint : Surface.control}
                stroke={active ? Line.accentStrong : undefined}
                style={styles.option}>
                <Text
                  variant="service"
                  color={active ? Brand.accent : Ink.primary}
                  style={styles.grow}>
                  {LANGUAGE_NAMES[option]}
                </Text>
                {active && <CheckIcon color={Brand.accent} />}
              </Bevel>
            </Tap>
          );
        })}
      </View>
    </Card>
  );
}

function PasswordCard({ user }: { user: User }) {
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
    <Card>
      <BlockLabel>{t.impostazioni.password.titolo}</BlockLabel>
      <Text variant="service" color={Ink.secondary}>
        {t.impostazioni.password.aiuto}
      </Text>

      <View style={styles.form}>
        <PasswordField
          placeholder={t.impostazioni.password.attuale}
          autoComplete="current-password"
          showLabel={t.comune.mostra}
          hideLabel={t.comune.nascondi}
          value={current}
          onChangeText={setCurrent}
        />
        <PasswordField
          placeholder={t.impostazioni.password.nuova(MIN_PASSWORD)}
          autoComplete="new-password"
          showLabel={t.comune.mostra}
          hideLabel={t.comune.nascondi}
          value={next}
          onChangeText={setNext}
        />
        <PasswordField
          placeholder={t.impostazioni.password.ripeti}
          autoComplete="new-password"
          showLabel={t.comune.mostra}
          hideLabel={t.comune.nascondi}
          value={repeat}
          onChangeText={setRepeat}
          onSubmitEditing={submit}
        />

        <Feedback error={error} done={done} />

        <Button
          label={t.impostazioni.password.salva}
          loading={busy}
          loadingLabel={t.impostazioni.password.inCorso}
          disabled={!filled}
          onPress={submit}
        />
      </View>
    </Card>
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
    <Card>
      <BlockLabel>{t.impostazioni.emailAccesso.titolo}</BlockLabel>
      <Text variant="service" color={Ink.secondary}>
        {t.impostazioni.emailAccesso.aiuto}
      </Text>

      <View style={styles.form}>
        <DataRow first label={t.impostazioni.emailAccesso.attuale} value={user.email ?? ''} />

        <Field
          placeholder={t.impostazioni.emailAccesso.nuova}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <PasswordField
          placeholder={t.impostazioni.emailAccesso.conferma}
          autoComplete="current-password"
          showLabel={t.comune.mostra}
          hideLabel={t.comune.nascondi}
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
        />

        <Feedback error={error} done={done} />

        <Button
          label={t.impostazioni.emailAccesso.salva}
          loading={busy}
          loadingLabel={t.impostazioni.emailAccesso.inCorso}
          disabled={!filled}
          onPress={submit}
        />
      </View>
    </Card>
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

/** Esito dell'ultima operazione: l'errore in rosso, la conferma nel colore del brand. */
function Feedback({ error, done }: { error: string; done: string }) {
  if (error !== '') {
    return (
      <Text variant="service" color={Danger.text}>
        {error}
      </Text>
    );
  }

  if (done !== '') {
    return (
      <Text variant="service" color={Brand.accent}>
        {done}
      </Text>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flex: 1 },
  scroll: { paddingHorizontal: Gutter, paddingBottom: Spacing.xxl, gap: Spacing.sm + 2 },
  options: { gap: Spacing.sm, marginTop: Spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
  },
  form: { gap: Spacing.md, marginTop: Spacing.md },
  memoryNote: { marginTop: Spacing.md },
});
