import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/brand/wordmark';
import { LegalLinks } from '@/components/legal-links';
import { Button, Field, FieldNote, Screen, ScreenBar, Text } from '@/components/ui';
import { useT } from '@/hooks/use-language';
import { authErrorMessage, requestPasswordReset } from '@/lib/auth';
import { Brand, Family, Gutter, Ink, Spacing } from '@/theme';

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
    <Screen>
      {/* La barra vuota prende lo spazio della status bar: il lettering parte da
          lì, e il form resta ancorato in basso come nella schermata d'accesso. */}
      <ScreenBar />

      <View style={styles.hero}>
        <Wordmark width={112} />
        <Text variant="title" style={styles.title}>
          {t.recupero.titolo}
        </Text>
      </View>

      <View style={styles.spacer} />

      <View style={styles.form}>
        {sentTo === '' ? (
          <>
            <Text variant="service" color={Ink.secondary} style={styles.help}>
              {t.recupero.sottotitolo}
            </Text>

            <Field
              placeholder={t.comune.email}
              autoCapitalize="none"
              autoComplete="email"
              autoFocus
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={submit}
            />

            {error !== '' && <FieldNote tone="error">{error}</FieldNote>}

            <Button
              label={t.recupero.invia}
              loading={busy}
              loadingLabel={t.recupero.inCorso}
              disabled={!canSubmit}
              onPress={submit}
            />
          </>
        ) : (
          <>
            <Text variant="service" color={Brand.accent} style={styles.help}>
              {t.recupero.fatto(sentTo)}
            </Text>

            {/* Rimandare indietro invece di rinviare subito: il secondo invio
                invalida il codice del primo, e la mail più vecchia è spesso
                quella che il cliente ha già aperto. */}
            <Button
              label={t.recupero.riprova}
              variant="secondary"
              onPress={() => {
                setSentTo('');
                setError('');
              }}
            />
          </>
        )}

        {/* `dismissTo` e non un push: si torna alla schermata di accesso che c'è
            già nello stack, non se ne impila una seconda. */}
        <Link href="/login" dismissTo style={styles.back}>
          <Text variant="service" color={Ink.secondary} style={styles.backLabel}>
            {t.recupero.tornaAllAccesso}
          </Text>
        </Link>

        <LegalLinks />
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
  back: { alignSelf: 'center', marginTop: Spacing.sm },
  backLabel: { fontFamily: Family.sansSemibold, fontSize: 12.5 },
});
