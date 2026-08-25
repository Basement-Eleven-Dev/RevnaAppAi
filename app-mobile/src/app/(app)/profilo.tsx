import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useClientProfile } from '@/hooks/use-client-profile';
import { useTheme } from '@/hooks/use-theme';
import { getFirebaseAuth } from '@/lib/firebase';
import {
  CANALI,
  CATEGORIE,
  SERVIZI,
  STAGIONALITA,
  TARGET,
  TIPOLOGIE_ALLOGGIO,
  TIPOLOGIE_STRUTTURA,
  labelOf,
  labelsOf,
  type ClientProfile,
} from '@/lib/profile';

export default function ProfileScreen() {
  const theme = useTheme();
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

  async function onSaveNote() {
    setSavingNote(true);
    setNoteError('');
    try {
      await saveNote(note);
    } catch (cause) {
      setNoteError(cause instanceof Error ? cause.message : 'Salvataggio non riuscito.');
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedView style={styles.header}>
            <ThemedText type="subtitle">Profilo</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {user?.email}
            </ThemedText>
          </ThemedView>

          {error !== '' && (
            <ThemedText type="small" style={{ color: '#B3261E' }}>
              {error}
            </ThemedText>
          )}

          {!profile && error === '' && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                Il tuo profilo non è ancora stato compilato. Lo redige il tuo referente
                Revna: appena pronto lo trovi qui.
              </ThemedText>
            </ThemedView>
          )}

          {profile && <ProfileSections profile={profile} />}

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Le mie note</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Aggiungi quello che ritieni utile. Restano tue: non sovrascrivono il profilo
              scritto da Revna.
            </ThemedText>
            <TextInput
              style={[styles.textarea, { color: theme.text, borderColor: theme.border }]}
              multiline
              value={note}
              onChangeText={setNote}
              placeholder="Note personali…"
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
                {savingNote ? 'Salvataggio…' : 'Salva le mie note'}
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>

          <TouchableOpacity
            style={[styles.logout, { borderColor: theme.border }]}
            onPress={() => signOut(getFirebaseAuth())}>
            <ThemedText type="smallBold">Esci</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ProfileSections({ profile }: { profile: ClientProfile }) {
  const { referente, struttura, indirizzo, alloggi } = profile;
  const totaleUnita = alloggi.reduce((sum, row) => sum + row.quantita, 0);
  const luogo = [indirizzo.via, indirizzo.citta, indirizzo.provincia, indirizzo.regione]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <Section title="Struttura">
        <Row label="Nome" value={struttura.nome} />
        <Row label="Tipologia" value={labelOf(TIPOLOGIE_STRUTTURA, struttura.tipologia)} />
        <Row label="Categoria" value={labelOf(CATEGORIE, struttura.categoria)} />
        <Row label="Aperta dal" value={struttura.annoApertura?.toString() ?? ''} />
        <Row label="Sito" value={struttura.sitoWeb} />
        <Row label="Dove" value={luogo} />
      </Section>

      <Section title="Referente">
        <Row label="Nome" value={`${referente.nome} ${referente.cognome}`.trim()} />
        <Row label="Ruolo" value={referente.ruolo} />
        <Row label="Telefono" value={referente.telefono} />
      </Section>

      {alloggi.length > 0 && (
        <Section title={`Alloggi · ${totaleUnita} unità`}>
          {alloggi.map((row, index) => (
            <Row
              key={`${row.tipologia}-${index}`}
              label={labelOf(TIPOLOGIE_ALLOGGIO, row.tipologia)}
              value={String(row.quantita)}
            />
          ))}
        </Section>
      )}

      <Section title="Come lavora">
        <Row label="Stagionalità" value={labelOf(STAGIONALITA, profile.stagionalita)} />
        <Row label="Servizi" value={labelsOf(SERVIZI, profile.servizi).join(' · ')} />
        <Row label="Canali" value={labelsOf(CANALI, profile.canali).join(' · ')} />
        <Row label="Target" value={labelsOf(TARGET, profile.target).join(' · ')} />
      </Section>

      {profile.obiettivi !== '' && (
        <Section title="Obiettivi">
          <ThemedText type="small">{profile.obiettivi}</ThemedText>
        </Section>
      )}

      {profile.noteRevna !== '' && (
        <Section title="Note del consulente">
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
  scroll: { padding: Spacing.four, gap: Spacing.three },
  header: { gap: Spacing.one },
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
