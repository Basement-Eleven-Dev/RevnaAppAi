import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  BackIcon,
  BlockLabel,
  Button,
  Card,
  ConfirmSheet,
  ErrorNote,
  Field,
  IconButton,
  Screen,
  ScreenBar,
  Tap,
  Text,
} from '@/components/ui';
import { useLanguage } from '@/hooks/use-language';
import { useMemory } from '@/hooks/use-memory';
import { entryMeta, MAX_ENTRY_CHARS, type MemoryEntry } from '@/lib/memory';
import { Danger, Family, Gutter, Ink, Line, Spacing } from '@/theme';

/** Elenco completo dei ricordi dell'assistente, separato dalle impostazioni. */
export default function MemoryScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { entries, loading, error, save, remove, clear } = useMemory();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState('');
  const [asking, setAsking] = useState<MemoryEntry | 'tutto' | null>(null);

  function edit(entry: MemoryEntry) {
    setFailed('');
    setEditing(entry.id);
    setDraft(entry.testo);
  }

  async function commit(entry: MemoryEntry) {
    const testo = draft.trim();
    if (busy) return;
    if (testo === '' || testo === entry.testo) {
      setEditing(null);
      return;
    }

    setBusy(true);
    setFailed('');
    try {
      await save(entry.id, testo);
      setEditing(null);
    } catch (cause) {
      setFailed(cause instanceof Error ? cause.message : t.impostazioni.memoria.fallito);
    } finally {
      setBusy(false);
    }
  }

  function forget(entry: MemoryEntry) {
    setAsking(null);
    if (editing === entry.id) setEditing(null);
    setFailed('');
    remove(entry.id).catch(() => setFailed(t.impostazioni.memoria.fallito));
  }

  function forgetAll() {
    setAsking(null);
    setEditing(null);
    setBusy(true);
    setFailed('');
    clear()
      .catch(() => setFailed(t.impostazioni.memoria.fallito))
      .finally(() => setBusy(false));
  }

  return (
    <Screen>
      <ScreenBar
        left={
          <IconButton onPress={() => router.back()} accessibilityLabel={t.comune.indietro}>
            <BackIcon color={Ink.secondary} />
          </IconButton>
        }>
        <Text variant="service" color={Ink.muted}>
          {t.impostazioni.memoria.titolo}
        </Text>
      </ScreenBar>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card>
          <BlockLabel>{t.impostazioni.memoria.conteggio(entries.length)}</BlockLabel>
          <Text variant="service" color={Ink.secondary}>
            {t.impostazioni.memoria.aiuto}
          </Text>

          {loading && (
            <Text variant="service" color={Ink.faint} style={styles.note}>
              {t.comune.caricamento}
            </Text>
          )}
          {error !== '' && (
            <View style={styles.note}>
              <ErrorNote>{error}</ErrorNote>
            </View>
          )}
          {!loading && error === '' && entries.length === 0 && (
            <Text variant="service" color={Ink.ghost} style={styles.note}>
              {t.impostazioni.memoria.vuoto}
            </Text>
          )}

          {entries.map((entry, index) => (
            <View key={entry.id} style={[styles.entry, index > 0 && styles.entryRuled]}>
              {editing === entry.id ? (
                <View style={styles.form}>
                  <Field
                    multiline
                    value={draft}
                    onChangeText={setDraft}
                    maxLength={MAX_ENTRY_CHARS}
                    autoFocus
                  />
                  <Button
                    label={t.impostazioni.memoria.salva}
                    loading={busy}
                    loadingLabel={t.impostazioni.memoria.inCorso}
                    onPress={() => void commit(entry)}
                  />
                  <Button
                    label={t.comune.annulla}
                    variant="secondary"
                    disabled={busy}
                    onPress={() => setEditing(null)}
                  />
                </View>
              ) : (
                <>
                  <Text variant="service" color={Ink.body}>
                    {entry.testo}
                  </Text>
                  <Text variant="tab" color={Ink.faint} style={styles.entryMeta}>
                    {entryMeta(entry, t)}
                  </Text>
                  <View style={styles.entryActions}>
                    <EntryAction
                      label={t.impostazioni.memoria.modifica}
                      onPress={() => edit(entry)}
                    />
                    <EntryAction
                      label={t.impostazioni.memoria.dimentica}
                      tone={Danger.text}
                      onPress={() => setAsking(entry)}
                    />
                  </View>
                </>
              )}
            </View>
          ))}

          {entries.length > 0 && (
            <View style={styles.footer}>
              <Button
                label={t.impostazioni.memoria.cancellaTutto}
                variant="danger"
                loading={busy && editing === null}
                loadingLabel={t.impostazioni.memoria.cancellazione}
                onPress={() => setAsking('tutto')}
              />
            </View>
          )}

          {failed !== '' && (
            <Text variant="service" color={Danger.text} style={styles.note}>
              {failed}
            </Text>
          )}
        </Card>
      </ScrollView>

      <ConfirmSheet
        visible={asking !== null}
        titolo={
          asking === 'tutto'
            ? t.impostazioni.memoria.cancellaTuttoTitolo
            : t.impostazioni.memoria.confermaTitolo
        }
        testo={
          asking === 'tutto' || asking === null
            ? t.impostazioni.memoria.cancellaTuttoTesto
            : t.impostazioni.memoria.confermaTesto(asking.testo)
        }
        conferma={
          asking === 'tutto'
            ? t.impostazioni.memoria.cancellaTutto
            : t.impostazioni.memoria.dimentica
        }
        annulla={t.comune.annulla}
        onCancel={() => setAsking(null)}
        onConfirm={() => {
          if (asking === 'tutto') forgetAll();
          else if (asking) forget(asking);
        }}
      />
    </Screen>
  );
}

function EntryAction({
  label,
  tone,
  onPress,
}: {
  label: string;
  tone?: string;
  onPress: () => void;
}) {
  return (
    <Tap onPress={onPress} hitSlop={8} accessibilityRole="button">
      <Text variant="tab" color={tone ?? Ink.muted} style={styles.entryActionLabel}>
        {label}
      </Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Gutter, paddingBottom: Spacing.xxl },
  form: { gap: Spacing.md, marginTop: Spacing.md },
  note: { marginTop: Spacing.md },
  entry: { marginTop: Spacing.md + 2, paddingTop: Spacing.md },
  entryRuled: { borderTopWidth: 1, borderTopColor: Line.hairline },
  entryMeta: { marginTop: Spacing.xs },
  entryActions: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.sm + 2 },
  entryActionLabel: { fontFamily: Family.sansSemibold },
  footer: { marginTop: Spacing.lg },
});
