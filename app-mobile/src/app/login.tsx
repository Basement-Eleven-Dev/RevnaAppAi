import { Link, Redirect } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Monogram } from '@/components/brand/monogram';
import { Wordmark } from '@/components/brand/wordmark';
import { LegalLinks } from '@/components/legal-links';
import {
  AccentGlow,
  Appear,
  Button,
  Field,
  FieldNote,
  PasswordField,
  Screen,
  stagger,
  Text,
} from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { useT } from '@/hooks/use-language';
import { authErrorMessage } from '@/lib/auth';
import { getFirebaseAuth, isFirebaseConfigured, missingFirebaseEnvKeys } from '@/lib/firebase';
import { Brand, Family, Gutter, Ink, Spacing, Surface } from '@/theme';

/**
 * Il claim del brand, che nel sistema **è** la schermata d'accesso: il lettering
 * non è un logo appoggiato in cima, è il contenuto. Non si traduce, come non si
 * traduce il nome.
 */
const CLAIM = ['Rethink', 'your', 'revenue.'] as const;

/**
 * Accesso.
 *
 * Il form è ancorato in basso e il lettering sta sopra: il pollice arriva prima al
 * campo che al titolo, ed è al campo che serve arrivare. Nessuna barra in fondo —
 * si entra da qui, non si naviga.
 *
 * È l'unica delle tre schermate d'accesso che entra in scena, e per un motivo
 * preciso: le altre due si raggiungono da qui, quindi arrivano già con lo
 * scorrimento dello Stack, e sommare un'entrata a uno scorrimento è movimento
 * sopra movimento. Questa invece prende il posto dello splash, che è un taglio
 * secco — il claim che si accende è la prima cosa che l'app fa vedere di sé.
 */
export default function LoginScreen() {
  const t = useT();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Brand.accent} />
      </View>
    );
  }

  if (user) return <Redirect href="/chat" />;

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
    <Screen>
      <AccentGlow size={280} opacity={0.22} top={-40} right={-70} />

      <View style={styles.monogram}>
        <Monogram height={46} color={Brand.accent} />
      </View>

      <Appear style={styles.hero}>
        <Wordmark width={132} />
        <Text variant="display" style={styles.claim}>
          {CLAIM[0]}
          {'\n'}
          {CLAIM[1]}
          {'\n'}
          <Text variant="display" color={Brand.accent}>
            {CLAIM[2]}
          </Text>
        </Text>
        <Text variant="service" color={Ink.secondary} style={styles.tagline}>
          {t.login.sottotitolo}
        </Text>
      </Appear>

      <Appear delay={stagger(2)} style={styles.form}>
        <Field
          placeholder={t.comune.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <PasswordField
          placeholder={t.comune.password}
          autoComplete="current-password"
          showLabel={t.comune.mostra}
          hideLabel={t.comune.nascondi}
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
        />

        {error !== '' && <FieldNote tone="error">{error}</FieldNote>}

        {!isFirebaseConfigured && (
          <FieldNote>{t.login.firebaseDaConfigurare(missingFirebaseEnvKeys().join(', '))}</FieldNote>
        )}

        <Button
          label={t.login.accedi}
          loading={busy}
          loadingLabel={t.login.inCorso}
          disabled={!canSubmit}
          onPress={submit}
        />

        <View style={styles.links}>
          <Link href="/recupera">
            <Text variant="service" color={Ink.secondary} style={styles.link}>
              {t.login.passwordDimenticata}
            </Text>
          </Link>
          <Link href="/attiva">
            <Text variant="service" color={Brand.accent} style={styles.linkStrong}>
              {t.login.hoUnCodice}
            </Text>
          </Link>
        </View>

        <LegalLinks nota intro={t.login.nessunAccesso} />
      </Appear>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Surface.base,
  },
  monogram: { position: 'absolute', top: 58, right: Spacing.xl + 2 },
  hero: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: Gutter + 2,
    paddingBottom: Spacing.xxl + 2,
  },
  claim: { marginTop: Spacing.xl + 4 },
  tagline: { marginTop: Spacing.lg + 2, maxWidth: 270 },
  form: { paddingHorizontal: Gutter + 2, paddingBottom: Spacing.huge - 4, gap: Spacing.md - 1 },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs + 2 },
  link: { fontSize: 12.5 },
  linkStrong: { fontFamily: Family.sansSemibold, fontSize: 12.5 },
});
