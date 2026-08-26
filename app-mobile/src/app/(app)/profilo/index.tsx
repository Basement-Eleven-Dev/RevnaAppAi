import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/menu-button';
import { SettingsIcon } from '@/components/tab-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useClientProfile } from '@/hooks/use-client-profile';
import { useT } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { getFirebaseAuth } from '@/lib/firebase';
import { unregisterPushToken } from '@/lib/push';
import { labelOf, labelsOf, type Dictionary } from '@/lib/i18n';
import { type ClientProfile } from '@/lib/profile';

export default function ProfileScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const { user } = useAuth();
  const { profile, loading, error, saveNote } = useClientProfile();

  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState('');

  // La nota arriva dal server: la copiamo nello stato locale solo quando cambia
  // là, altrimenti sovrascriveremmo quello che l'utente sta scrivendo.
  useEffect(() => {
    if (profile) setNote(profile.noteCliente);
  }, [profile?.noteCliente]);

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  /**
   * Esce dall'account, dopo aver dimenticato questo dispositivo.
   *
   * Prima il token e poi la sessione, perché cancellare il token è una scrittura su
   * Firestore e la vogliono fare le regole di chi è ancora dentro. Se non riesce non si
   * blocca l'uscita — restare dentro per un token è la reazione sbagliata — e al primo
   * rifiuto del servizio push lo pota il server.
   */
  async function esci() {
    if (user) await unregisterPushToken(user.uid).catch(() => {});
    await signOut(getFirebaseAuth());
  }

  async function onSaveNote() {
    setSavingNote(true);
    setNoteError('');
    try {
      await saveNote(note);
    } catch (cause) {
      setNoteError(cause instanceof Error ? cause.message : t.profilo.note.fallito);
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.topbar}>
          <MenuButton />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <View style={styles.headerTitles}>
              <ThemedText type="subtitle">{t.profilo.titolo}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {user?.email}
              </ThemedText>
            </View>

            <Pressable
              onPress={() => router.push('/profilo/impostazioni')}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel={t.profilo.apriImpostazioni}
              style={[styles.iconButton, { borderColor: theme.border }]}>
              <SettingsIcon color={theme.textSecondary} size={18} />
            </Pressable>
          </View>

          {error !== '' && (
            <ThemedText type="small" style={{ color: '#B3261E' }}>
              {error}
            </ThemedText>
          )}

          {!profile && error === '' && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {t.profilo.nonCompilato}
              </ThemedText>
            </ThemedView>
          )}

          {profile && <ProfileSections profile={profile} t={t} />}

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">{t.profilo.note.titolo}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t.profilo.note.aiuto}
            </ThemedText>
            <TextInput
              style={[styles.textarea, { color: theme.text, borderColor: theme.border }]}
              multiline
              value={note}
              onChangeText={setNote}
              placeholder={t.profilo.note.placeholder}
              placeholderTextColor={theme.textSecondary}
            />
            {noteError !== '' && (
              <ThemedText type="small" style={{ color: '#B3261E' }}>
                {noteError}
              </ThemedText>
            )}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.primary, opacity: savingNote ? 0.5 : 1 }]}
              disabled={savingNote}
              onPress={onSaveNote}>
              <ThemedText type="smallBold" style={styles.buttonLabel}>
                {savingNote ? t.profilo.note.inCorso : t.profilo.note.salva}
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>

          <TouchableOpacity
            style={[styles.logout, { borderColor: theme.border }]}
            onPress={() => void esci()}>
            <ThemedText type="smallBold">{t.profilo.esci}</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ProfileSections({ profile, t }: { profile: ClientProfile; t: Dictionary }) {
  const { referente, struttura, indirizzo, alloggi } = profile;
  const { campi, liste, sezioni } = t.profilo;
  const totaleUnita = alloggi.reduce((sum, row) => sum + row.quantita, 0);
  const luogo = [indirizzo.via, indirizzo.citta, indirizzo.provincia, indirizzo.regione]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <Section title={sezioni.struttura}>
        <Row label={campi.nome} value={struttura.nome} />
        <Row label={campi.tipologia} value={labelOf(liste.tipologiaStruttura, struttura.tipologia)} />
        <Row label={campi.categoria} value={labelOf(liste.categoria, struttura.categoria)} />
        <Row label={campi.apertaDal} value={struttura.annoApertura?.toString() ?? ''} />
        <Row label={campi.sito} value={struttura.sitoWeb} />
        <Row label={campi.dove} value={luogo} />
      </Section>

      <Section title={sezioni.referente}>
        <Row label={campi.nome} value={`${referente.nome} ${referente.cognome}`.trim()} />
        <Row label={campi.ruolo} value={referente.ruolo} />
        <Row label={campi.telefono} value={referente.telefono} />
      </Section>

      {alloggi.length > 0 && (
        <Section title={sezioni.alloggi(totaleUnita)}>
          {alloggi.map((row, index) => (
            <Row
              key={`${row.tipologia}-${index}`}
              label={labelOf(liste.tipologiaAlloggio, row.tipologia)}
              value={String(row.quantita)}
            />
          ))}
        </Section>
      )}

      <Section title={sezioni.comeLavora}>
        <Row label={campi.stagionalita} value={labelOf(liste.stagionalita, profile.stagionalita)} />
        <Row label={campi.servizi} value={labelsOf(liste.servizi, profile.servizi).join(' · ')} />
        <Row label={campi.canali} value={labelsOf(liste.canali, profile.canali).join(' · ')} />
        <Row label={campi.target} value={labelsOf(liste.target, profile.target).join(' · ')} />
      </Section>

      {profile.obiettivi !== '' && (
        <Section title={sezioni.obiettivi}>
          <ThemedText type="small">{profile.obiettivi}</ThemedText>
        </Section>
      )}

      {profile.noteRevna !== '' && (
        <Section title={sezioni.noteConsulente}>
          <ThemedText type="small">{profile.noteRevna}</ThemedText>
        </Section>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {children}
    </ThemedView>
  );
}

/** Le righe vuote non si mostrano: un profilo parziale non deve sembrare rotto. */
function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;

  return (
    <ThemedView style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.rowValue}>
        {value}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  topbar: { flexDirection: 'row', paddingHorizontal: Spacing.four },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  headerTitles: { flex: 1, gap: Spacing.one },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  card: { gap: Spacing.two, padding: Spacing.four, borderRadius: Spacing.four },
  row: { flexDirection: 'row', gap: Spacing.three, backgroundColor: 'transparent' },
  rowLabel: { width: 110 },
  rowValue: { flex: 1 },
  textarea: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    minHeight: 96,
    textAlignVertical: 'top',
    fontSize: 16,
    // I campi non passano da ThemedText: il font del brand va detto qui.
    fontFamily: Fonts.sans,
  },
  button: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center' },
  buttonLabel: { color: '#FFFFFF' },
  logout: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    marginTop: Spacing.two,
  },
});
