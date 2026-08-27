import { useLocalSearchParams } from 'expo-router';
import {
  confirmPasswordReset,
  signInWithEmailAndPassword,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/brand/wordmark';
import { LegalLinks } from '@/components/legal-links';
import { Button, Field, FieldNote, PasswordField, Screen, ScreenBar, Text } from '@/components/ui';
import { useT } from '@/hooks/use-language';
import { authErrorMessage, MIN_PASSWORD } from '@/lib/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { Brand, Gutter, Ink, Spacing } from '@/theme';

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
    <Screen>
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
        {verifying && <ActivityIndicator color={Brand.accent} />}

        {!email && !verifying && (
          <>
            <Text variant="service" color={Ink.secondary} style={styles.help}>
              {testi.incollaCodice}
            </Text>
            <Field
              placeholder={testi.codice}
              autoCapitalize="none"
              value={code}
              onChangeText={setCode}
            />
            <Button
              label={t.comune.continua}
              disabled={code.trim() === ''}
              onPress={verifyManualCode}
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
            />
            <PasswordField
              placeholder={t.attivazione.ripetiPassword}
              autoComplete="new-password"
              showLabel={t.comune.mostra}
              hideLabel={t.comune.nascondi}
              value={confirmation}
              onChangeText={setConfirmation}
              onSubmitEditing={activate}
            />
            <Button
              label={conferma}
              loading={busy}
              loadingLabel={testi.inCorso}
              disabled={!passwordsMatch}
              onPress={activate}
            />
          </>
        )}

        {error !== '' && <FieldNote tone="error">{error}</FieldNote>}

        <LegalLinks nota={!isReset} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: Gutter + 2 },
  spacer: { flex: 1 },
  title: { marginTop: Spacing.xl },
  form: { paddingHorizontal: Gutter + 2, paddingBottom: Spacing.huge - 4, gap: Spacing.md - 1 },
  help: { lineHeight: 20 },
});
