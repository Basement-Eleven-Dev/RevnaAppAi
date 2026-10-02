import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MenuButton } from '@/components/menu-button';
import {
  Appear,
  BlockLabel,
  Button,
  Card,
  CharCount,
  ConfirmSheet,
  DataRow,
  ErrorNote,
  Field,
  IconButton,
  KeyboardScroll,
  Loading,
  PageHeading,
  Screen,
  ScreenBar,
  SettingsIcon,
  stagger,
  Tap,
  Text,
} from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { useClientProfile } from '@/hooks/use-client-profile';
import { useT } from '@/hooks/use-language';
import { signOutDevice } from '@/lib/auth';
import { errorMessage, labelOf, labelsOf, type Dictionary } from '@/lib/i18n';
import { MAX_NOTE_CHARS, type ClientProfile } from '@/lib/profile';
import { Brand, Family, Gutter, Ink, Spacing } from '@/theme';

/**
 * La scheda della struttura.
 *
 * I dati stanno come **numeri grandi**, non come modulo grigio da compilare: chi
 * apre questa schermata vuole vedere che l'assistente conosce la sua struttura, e
 * tre numeri lo dicono meglio di dodici righe di etichette. Le note del cliente
 * restano in fondo, sempre modificabili.
 *
 * La scheda entra in scena a blocchi, nell'ordine in cui si legge: prima il nome
 * della struttura, poi i numeri, poi le schede. È la sola schermata in cui la
 * rotella copre tutto — quindi è quella in cui l'arrivo dei dati va accompagnato,
 * non fatto sbattere.
 */
export default function ProfileScreen() {
  const t = useT();
  const router = useRouter();
  const { user } = useAuth();
  const { profile, loading, error, saveNote } = useClientProfile();

  /**
   * La nota in corso di scrittura, o `null` se non la si sta scrivendo.
   *
   * Stato derivato invece di una copia tenuta allineata da un effetto: la verità
   * è quella del server, e mentre l'utente scrive è la sua bozza a vincere. A
   * salvataggio riuscito la bozza si azzera e si torna a leggere il server, che è
   * anche il modo in cui una nota cambiata da un altro dispositivo ricompare.
   */
  const [drafted, setDrafted] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [askingDiscard, setAskingDiscard] = useState(false);
  const [askingSignOut, setAskingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const note = drafted ?? profile?.noteCliente ?? '';

  const bar = (
    <ScreenBar
      left={<MenuButton />}
      right={
        <IconButton
          onPress={() => router.navigate('/impostazioni')}
          accessibilityLabel={t.profilo.apriImpostazioni}>
          <SettingsIcon color={Ink.secondary} size={15} />
        </IconButton>
      }
    />
  );

  if (loading) {
    return (
      <Screen>
        {bar}
        <Loading />
      </Screen>
    );
  }

  async function esci() {
    setAskingSignOut(false);
    setSigningOut(true);
    try {
      await signOutDevice();
    } catch {
      // `signOut` di Firebase è locale e non fallisce in pratica: se succede, si resta
      // dentro con il bottone di nuovo premibile.
      setSigningOut(false);
    }
  }

  function closeNote() {
    setAskingDiscard(false);
    setDrafted(null);
    setNoteError('');
    setEditingNote(false);
  }

  function toggleNote() {
    if (!editingNote) setEditingNote(true);
    else if (drafted !== null && drafted !== (profile?.noteCliente ?? '')) setAskingDiscard(true);
    else closeNote();
  }

  async function onSaveNote() {
    setSavingNote(true);
    setNoteError('');
    try {
      await saveNote(note);
      setDrafted(null);
      setEditingNote(false);
    } catch (cause) {
      setNoteError(errorMessage(t, cause, t.profilo.note.fallito));
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <Screen>
      {bar}

      <KeyboardScroll contentContainerStyle={styles.scroll}>
        <Appear>
          <PageHeading
            title={profile?.struttura.nome || t.profilo.titolo}
            subtitle={profile ? identity(profile, t) : (user?.email ?? '')}
          />
        </Appear>

        {error !== null && <ErrorNote>{errorMessage(t, error, t.comune.nonCaricato)}</ErrorNote>}

        {!profile && error === null && (
          <Card>
            <Text variant="service" color={Ink.secondary}>
              {t.profilo.nonCompilato}
            </Text>
          </Card>
        )}

        {profile && <ProfileBody profile={profile} t={t} />}

        <Card>
          <View style={styles.noteHead}>
            <BlockLabel>{t.profilo.note.titolo}</BlockLabel>
            <Tap
              onPress={toggleNote}
              hitSlop={8}
              accessibilityRole="button">
              <Text variant="service" color={Brand.accent} style={styles.noteAction}>
                {editingNote ? t.comune.chiudi : t.profilo.note.modifica}
              </Text>
            </Tap>
          </View>

          {editingNote ? (
            <View style={styles.noteForm}>
              <Text variant="service" color={Ink.secondary}>
                {t.profilo.note.aiuto}
              </Text>
              <Field
                multiline
                maxLength={MAX_NOTE_CHARS}
                value={note}
                onChangeText={setDrafted}
                placeholder={t.profilo.note.placeholder}
              />
              <CharCount length={note.length} max={MAX_NOTE_CHARS} />
              {noteError !== '' && <ErrorNote>{noteError}</ErrorNote>}
              <Button
                label={t.profilo.note.salva}
                loading={savingNote}
                loadingLabel={t.profilo.note.inCorso}
                onPress={onSaveNote}
              />
            </View>
          ) : (
            <Text variant="service" color={note ? Ink.body : Ink.faint} style={styles.noteText}>
              {note || t.profilo.note.aiuto}
            </Text>
          )}
        </Card>

        <Button
          label={t.profilo.esci}
          variant="secondary"
          loading={signingOut}
          loadingLabel={t.profilo.uscita.inCorso}
          onPress={() => setAskingSignOut(true)}
        />
      </KeyboardScroll>

      <ConfirmSheet
        visible={askingDiscard}
        titolo={t.profilo.note.scarta.titolo}
        testo={t.profilo.note.scarta.testo}
        conferma={t.profilo.note.scarta.conferma}
        annulla={t.profilo.note.scarta.annulla}
        onCancel={() => setAskingDiscard(false)}
        onConfirm={closeNote}
      />

      <ConfirmSheet
        visible={askingSignOut}
        tone="primary"
        titolo={t.profilo.uscita.titolo}
        testo={t.profilo.uscita.testo}
        conferma={t.profilo.esci}
        annulla={t.comune.annulla}
        onCancel={() => setAskingSignOut(false)}
        onConfirm={() => void esci()}
      />
    </Screen>
  );
}

/** Tipologia, categoria e luogo su una riga: come la struttura si presenta. */
function identity(profile: ClientProfile, t: Dictionary): string {
  return [
    labelOf(t.profilo.liste.tipologiaStruttura, profile.struttura.tipologia),
    labelOf(t.profilo.liste.categoria, profile.struttura.categoria),
    profile.indirizzo.citta,
  ]
    .filter(Boolean)
    .join(' · ');
}

function ProfileBody({ profile, t }: { profile: ClientProfile; t: Dictionary }) {
  const { referente, struttura, indirizzo, alloggi } = profile;
  const { campi, liste, sezioni, statistiche } = t.profilo;

  const totaleUnita = alloggi.reduce((sum, row) => sum + row.quantita, 0);
  const luogo = [indirizzo.via, indirizzo.citta, indirizzo.provincia, indirizzo.regione]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <Appear delay={stagger(1)} style={styles.stats}>
        <Stat value={totaleUnita} label={statistiche.unita(alloggi.length)} accent />
        <Stat value={struttura.annoApertura ?? 0} label={statistiche.annoApertura} />
        <Stat value={profile.canali.length} label={statistiche.canali(profile.canali.length)} />
      </Appear>

      {/* Le schede entrano come un blocco solo e non una per una: sono la scheda
          della struttura, si leggono insieme, e sei entrate in fila sarebbero sei
          cose che si muovono al posto di una schermata che arriva. */}
      <Appear delay={stagger(2)} style={styles.cards}>
        <Card>
          <BlockLabel>{sezioni.comeLavora}</BlockLabel>
          <DataRow first label={campi.stagionalita} value={labelOf(liste.stagionalita, profile.stagionalita)} />
          <DataRow label={campi.canali} value={labelsOf(liste.canali, profile.canali).join(' · ')} />
          <DataRow label={campi.target} value={labelsOf(liste.target, profile.target).join(' · ')} />
          <DataRow label={campi.servizi} value={labelsOf(liste.servizi, profile.servizi).join(' · ')} />
        </Card>

        {alloggi.length > 0 && (
          <Card>
            <BlockLabel>{sezioni.alloggi(totaleUnita)}</BlockLabel>
            {alloggi.map((row, index) => (
              <DataRow
                key={`${row.tipologia}-${index}`}
                first={index === 0}
                label={labelOf(liste.tipologiaAlloggio, row.tipologia)}
                value={String(row.quantita)}
              />
            ))}
          </Card>
        )}

        <Card>
          <BlockLabel>{sezioni.struttura}</BlockLabel>
          <DataRow first label={campi.dove} value={luogo} />
          <DataRow label={campi.sito} value={struttura.sitoWeb} />
        </Card>

        <Card>
          <BlockLabel>{sezioni.referente}</BlockLabel>
          <DataRow first label={campi.nome} value={`${referente.nome} ${referente.cognome}`.trim()} />
          <DataRow label={campi.ruolo} value={referente.ruolo} />
          <DataRow label={campi.telefono} value={referente.telefono} />
        </Card>

        {profile.obiettivi !== '' && (
          <Card>
            <BlockLabel>{sezioni.obiettivi}</BlockLabel>
            <Text variant="service" color={Ink.body}>
              {profile.obiettivi}
            </Text>
          </Card>
        )}

        {profile.noteRevna !== '' && (
          <Card>
            <BlockLabel>{sezioni.noteConsulente}</BlockLabel>
            <Text variant="service" color={Ink.body}>
              {profile.noteRevna}
            </Text>
          </Card>
        )}
      </Appear>
    </>
  );
}

/** Un numero grande e la sua didascalia: il primo dei tre è in accento. */
function Stat({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  if (!value) return null;

  return (
    <Card style={styles.stat}>
      <Text variant="stat" color={accent ? Brand.accent : Ink.primary}>
        {value}
      </Text>
      <Text variant="tab" color={Ink.muted} style={styles.statLabel}>
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Gutter, paddingBottom: Spacing.xxl, gap: Spacing.sm + 2 },
  stats: { flexDirection: 'row', gap: Spacing.sm + 2, marginTop: Spacing.md },
  // Le schede stanno in un contenitore loro (l'entrata), quindi lo spazio fra una
  // e l'altra si ripete qui: quello dello `ScrollView` non le raggiunge più.
  cards: { gap: Spacing.sm + 2 },
  stat: { flex: 1, padding: Spacing.lg - 1 },
  statLabel: { marginTop: Spacing.sm - 1, lineHeight: 14 },
  noteHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noteAction: { fontFamily: Family.sansSemibold, fontSize: 11.5 },
  noteForm: { gap: Spacing.md },
  noteText: { lineHeight: 21 },
});
