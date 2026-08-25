import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DocumentsIcon } from '@/components/tab-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { documentUrl, useDocuments } from '@/hooks/use-documents';
import { useTheme } from '@/hooks/use-theme';
import { categoriaLabel, formatSize, type ClientDocument } from '@/lib/documents';

/**
 * Documenti che Revna ha condiviso con questa struttura.
 * Sono in sola lettura: il caricamento avviene dal pannello interno Revna.
 */
export default function DocumentsScreen() {
  const theme = useTheme();
  const { documents, loading, error } = useDocuments();
  const [opening, setOpening] = useState('');
  const [openError, setOpenError] = useState('');

  async function open(document: ClientDocument) {
    setOpening(document.id);
    setOpenError('');
    try {
      // L'URL si chiede solo ora e non in elenco: sarebbe una richiesta di rete
      // per ogni documento, per un link che nella maggior parte dei casi non serve.
      await WebBrowser.openBrowserAsync(await documentUrl(document.storagePath));
    } catch {
      setOpenError('Non è stato possibile aprire il documento. Riprova.');
    } finally {
      setOpening('');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Documenti</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Report, presentazioni e materiali che Revna ha condiviso con te.
            </ThemedText>
          </View>

          {loading && <ActivityIndicator color={theme.primary} />}

          {!loading && documents.length === 0 && (
            <ThemedView type="backgroundElement" style={styles.empty}>
              <DocumentsIcon color={theme.textSecondary} size={32} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                Non c'è ancora nulla. I documenti che il tuo referente Revna condivide
                compaiono qui.
              </ThemedText>
            </ThemedView>
          )}

          {(error !== '' || openError !== '') && (
            <ThemedText type="small" style={{ color: '#B3261E' }}>
              {openError || error}
            </ThemedText>
          )}

          {documents.map((document) => (
            <Pressable key={document.id} onPress={() => open(document)}>
              {({ pressed }) => (
                <ThemedView
                  type="backgroundElement"
                  style={[styles.card, { borderColor: theme.border, opacity: pressed ? 0.6 : 1 }]}>
                  <View style={styles.cardHead}>
                    <View style={[styles.badge, { borderColor: theme.border }]}>
                      <ThemedText type="small" themeColor="primary" style={styles.badgeLabel}>
                        {categoriaLabel(document.categoria)}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
                      {formatSize(document.size)} · {shortDate(document.uploadedAt)}
                    </ThemedText>
                  </View>

                  <ThemedText type="smallBold">{document.name}</ThemedText>

                  {document.description !== '' && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {document.description}
                    </ThemedText>
                  )}

                  <ThemedText type="small" themeColor="primary" style={styles.action}>
                    {opening === document.id ? 'Apertura…' : 'Apri documento'}
                  </ThemedText>
                </ThemedView>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function shortDate(iso: string): string {
  return iso
    ? new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  header: { gap: Spacing.one },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
    borderRadius: Spacing.four,
  },
  emptyText: { textAlign: 'center', lineHeight: 20 },
  card: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.four,
    borderWidth: 1,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  badgeLabel: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  meta: { fontSize: 11 },
  action: { fontWeight: '600', marginTop: Spacing.one },
});
