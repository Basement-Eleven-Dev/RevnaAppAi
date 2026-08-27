import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/menu-button';
import { DocumentsIcon } from '@/components/tab-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { documentUrl, useDocuments } from '@/hooks/use-documents';
import { useT } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { formatSize, type ClientDocument } from '@/lib/documents';
import { labelOf, type Dictionary } from '@/lib/i18n';

/**
 * Documenti che Revna ha condiviso con questa struttura.
 * Sono in sola lettura: il caricamento avviene dal pannello interno Revna.
 */
export default function DocumentsScreen() {
  const theme = useTheme();
  const t = useT();
  const { documents, loading, error } = useDocuments();
  const [opening, setOpening] = useState('');
  const [openError, setOpenError] = useState('');

  async function open(document: ClientDocument) {
    setOpening(document.id);
    setOpenError('');
    try {
      // L'URL si chiede solo ora e non in elenco: dura pochi minuti, e uno per
      // documento sarebbe una richiesta di rete per un link quasi sempre inutile.
      await WebBrowser.openBrowserAsync(await documentUrl(document.id));
    } catch (cause) {
      setOpenError(cause instanceof Error ? cause.message : t.documenti.nonApribile);
    } finally {
      setOpening('');
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
            <ThemedText type="subtitle">{t.documenti.titolo}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t.documenti.sottotitolo}
            </ThemedText>
          </View>

          {loading && <ActivityIndicator color={theme.primary} />}

          {!loading && documents.length === 0 && (
            <ThemedView type="backgroundElement" style={styles.empty}>
              <DocumentsIcon color={theme.textSecondary} size={32} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                {t.documenti.vuoto}
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
                        {labelOf(t.documenti.categorie, document.categoria)}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
                      {formatSize(document.size)} · {shortDate(document.uploadedAt, t)}
                    </ThemedText>
                  </View>

                  <ThemedText type="smallBold">{document.name}</ThemedText>

                  {document.description !== '' && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {document.description}
                    </ThemedText>
                  )}

                  <ThemedText type="small" themeColor="primary" style={styles.action}>
                    {opening === document.id ? t.documenti.apertura : t.documenti.apri}
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

function shortDate(iso: string, t: Dictionary): string {
  return iso
    ? new Date(iso).toLocaleDateString(t.dateLocale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  topbar: { flexDirection: 'row', paddingHorizontal: Spacing.four },
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
