import { Link, router, useLocalSearchParams } from 'expo-router';
import {
  confirmPasswordReset,
  signInWithEmailAndPassword,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { Wordmark } from '@/components/brand/wordmark';
import { LegalLinks } from '@/components/legal-links';
import {
  Button,
  Field,
  FieldNote,
  FormScreen,
  Loading,
  PasswordField,
  ScreenBar,
  Text,
  TextAction,
} from '@/components/ui';
import { useT } from '@/hooks/use-language';
import { MIN_PASSWORD } from '@/lib/auth';
import { errorMessage } from '@/lib/i18n';
import { getFirebaseAuth } from '@/lib/firebase';
import { Brand, Family, Gutter, Ink, Spacing } from '@/theme';

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
  const params = useLocalSearchParams<{ code?: string; reset?: string }>();

  // Un link nuovo aperto con lo schermo già in piedi riparte da zero: la `key`
  // rimonta il modulo, che rilegge e rivalida il codice.
  return (
    <ActivationForm
      key={params.code ?? ''}
      linkCode={params.code ?? ''}
      // I parametri di un deep link sono sempre stringhe: `reset=1` è la forma che
      // scrive l'email, ma qualunque valore non vuoto vale come «sì».
      linkReset={(params.reset ?? '') !== ''}
    />
  );
}

function ActivationForm({ linkCode, linkReset }: { linkCode: string; linkReset: boolean }) {
  const t = useT();

  const [pastedReset, setPastedReset] = useState(false);
  const isReset = linkReset || pastedReset;
  const testi = isReset ? t.attivazione.reset : t.attivazione;
  const conferma = isReset ? t.attivazione.reset.conferma : t.attivazione.attiva;

  const [pasted, setPasted] = useState('');
  const [code, setCode] = useState(linkCode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const confirmationField = useRef<TextInput>(null);
  const [verifying, setVerifying] = useState(linkCode !== '');
  const [busy, setBusy] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);
  const [problem, setProblem] = useState<'corta' | 'diverse' | null>(null);
  // La causa e non la frase: la frase dipende da attivazione o recupero, che un
  // link incollato può cambiare dopo l'errore.
  const [failure, setFailure] = useState<unknown>(null);

  // Il codice arrivato dal link viene validato subito: così il cliente scopre
  // un link scaduto prima di scegliere la password, non dopo.
  useEffect(() => {
    if (!linkCode) return;

    verifyPasswordResetCode(getFirebaseAuth(), linkCode)
      .then(setEmail)
      .catch(setFailure)
      .finally(() => setVerifying(false));
  }, [linkCode]);

  async function verifyPastedCode() {
    const read = readPasted(pasted);
    if (read.code === '') return;
    if (read.reset) setPastedReset(true);

    setVerifying(true);
    setFailure(null);
    try {
      setEmail(await verifyPasswordResetCode(getFirebaseAuth(), read.code));
      setCode(read.code);
    } catch (cause) {
      setFailure(cause);
    } finally {
      setVerifying(false);
    }
  }

  const filled = password !== '' && confirmation !== '';

  async function activate() {
    if (!filled || busy) return;

    // Al bottone e non a ogni tasto: «troppo corta» mentre si sta ancora
    // scrivendo è solo rumore.
    const problemNow =
      password.length < MIN_PASSWORD ? 'corta' : password !== confirmation ? 'diverse' : null;
    setProblem(problemNow);
    if (problemNow) return;

    setBusy(true);
    setFailure(null);
    const auth = getFirebaseAuth();
    try {
      await confirmPasswordReset(auth, code, password);
    } catch (cause) {
      setFailure(cause);
      setBusy(false);
      return;
    }

    // Password impostata: entriamo subito, senza far ridigitare le credenziali.
    // Se l'accesso non riesce il codice è comunque consumato, quindi niente
    // errore da riprovare: il cliente entra dal login con la password appena scelta.
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/chat');
    } catch {
      setPasswordSet(true);
      setBusy(false);
    }
  }

  function describe(cause: unknown): string {
    return errorMessage(t, cause, testi.fallita, {
      'expired-action-code': testi.scaduto,
      'invalid-action-code': testi.nonValido,
    });
  }

  const error =
    problem === 'corta'
      ? t.attivazione.troppoCorta(MIN_PASSWORD)
      : problem === 'diverse'
        ? t.attivazione.nonCoincidono
        : failure !== null
          ? describe(failure)
          : '';

  return (
    <FormScreen>
      {/* La barra vuota prende lo spazio della status bar: il lettering parte da
          lì, e il form resta ancorato in basso come nella schermata d'accesso. */}
      <ScreenBar />

      <View style={styles.hero}>
        <Wordmark width={112} />
        <Text variant="title" style={styles.title}>
          {email ? testi.titoloPer(email) : testi.titolo}
        </Text>
      </View>

      <View style={styles.spacer} />

      <View style={styles.form}>
        {verifying && <Loading />}

        {passwordSet ? (
          <Text variant="service" color={Brand.accent} style={styles.help}>
            {testi.impostataAccedi}
          </Text>
        ) : (
          <>
            {!email && !verifying && (
              <>
                <Text variant="service" color={Ink.secondary} style={styles.help}>
                  {testi.incollaCodice}
                </Text>
                <Field
                  placeholder={testi.codice}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={pasted}
                  onChangeText={setPasted}
                  enterKeyHint="go"
                  onSubmitEditing={verifyPastedCode}
                />
                <Button
                  label={t.comune.continua}
                  disabled={pasted.trim() === ''}
                  onPress={verifyPastedCode}
                />
              </>
            )}

            {email !== '' && (
              <>
                <PasswordField
                  placeholder={t.attivazione.nuovaPassword(MIN_PASSWORD)}
                  autoComplete="new-password"
                  showLabel={t.comune.mostra}
                  hideLabel={t.comune.nascondi}
                  value={password}
                  onChangeText={setPassword}
                  enterKeyHint="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => confirmationField.current?.focus()}
                />
                <PasswordField
                  ref={confirmationField}
                  placeholder={t.attivazione.ripetiPassword}
                  autoComplete="new-password"
                  showLabel={t.comune.mostra}
                  hideLabel={t.comune.nascondi}
                  value={confirmation}
                  onChangeText={setConfirmation}
                  enterKeyHint="go"
                  onSubmitEditing={activate}
                />
                <Button
                  label={conferma}
                  loading={busy}
                  loadingLabel={testi.inCorso}
                  disabled={!filled}
                  onPress={activate}
                />
              </>
            )}
          </>
        )}

        {error !== '' && <FieldNote tone="error">{error}</FieldNote>}

        {/* Un link di recupero che non vale più si rimedia da soli, chiedendone
            un altro: quello di attivazione no, lo rimanda il referente. */}
        {isReset && !email && !verifying && !passwordSet && (
          <View style={styles.back}>
            <Link href="/recupera" asChild>
              <TextAction accessibilityRole="link">
                <Text variant="service" color={Brand.accent} style={styles.backLabel}>
                  {t.attivazione.reset.chiediNuovo}
                </Text>
              </TextAction>
            </Link>
          </View>
        )}

        <View style={styles.back}>
          <Link href="/login" dismissTo asChild>
            <TextAction accessibilityRole="link">
              <Text variant="service" color={Ink.secondary} style={styles.backLabel}>
                {t.comune.tornaAllAccesso}
              </Text>
            </TextAction>
          </Link>
        </View>

        <LegalLinks nota={!isReset} />
      </View>
    </FormScreen>
  );
}

/**
 * Il codice da quello che il cliente incolla: il codice da solo, oppure il link
 * intero dell'email, che è la cosa più facile da copiare.
 */
function readPasted(text: string): { code: string; reset: boolean } {
  const trimmed = text.trim();
  const match = /[?&]code=([^&#\s]+)/.exec(trimmed);
  if (!match) return { code: trimmed, reset: false };

  let code = match[1];
  try {
    code = decodeURIComponent(code);
  } catch {
    // Un `%` spezzato: lo lasciamo com'è e sarà Firebase a dire che non vale.
  }
  return { code, reset: /[?&]reset=[^&#\s]/.test(trimmed) };
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: Gutter + 2 },
  spacer: { flex: 1 },
  title: { marginTop: Spacing.xl },
  form: { paddingHorizontal: Gutter + 2, paddingBottom: Spacing.huge - 4, gap: Spacing.md - 1 },
  help: { lineHeight: 20 },
  back: { alignSelf: 'center', marginTop: Spacing.sm },
  backLabel: { fontFamily: Family.sansSemibold, fontSize: 12.5 },
});
