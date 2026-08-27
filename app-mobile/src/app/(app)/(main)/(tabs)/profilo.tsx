import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { MenuButton } from '@/components/menu-button';
import {
  Appear,
  BlockLabel,
  Button,
  Card,
  DataRow,
  ErrorNote,
  Field,
  IconButton,
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
import { getFirebaseAuth } from '@/lib/firebase';
import { labelOf, labelsOf, type Dictionary } from '@/lib/i18n';
import { type ClientProfile } from '@/lib/profile';
import { unregisterPushToken } from '@/lib/push';
import { Brand, Family, Gutter, Ink, Spacing, Surface } from '@/theme';

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

  const note = drafted ?? profile?.noteCliente ?? '';

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Brand.accent} />
      </View>
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
      setDrafted(null);
      setEditingNote(false);
    } catch (cause) {
      setNoteError(cause instanceof Error ? cause.message : t.profilo.note.fallito);
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <Screen>
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

      <ScrollView contentContainerStyle={styles.scroll}>
        <Appear>
          <PageHeading
            title={profile?.struttura.nome || t.profilo.titolo}
            subtitle={profile ? identity(profile, t) : (user?.email ?? '')}
          />
        </Appear>

        {error !== '' && <ErrorNote>{error}</ErrorNote>}

        {!profile && error === '' && (
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
              onPress={() => setEditingNote((was) => !was)}
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
                value={note}
                onChangeText={setDrafted}
                placeholder={t.profilo.note.placeholder}
              />
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

        <Button label={t.profilo.esci} variant="secondary" onPress={() => void esci()} />
      </ScrollView>
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
        <Stat value={struttura.annoApertura ?? 0} label={statistiche.apertaDal} />
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Surface.base,
  },
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
