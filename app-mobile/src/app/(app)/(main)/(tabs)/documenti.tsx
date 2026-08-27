import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { MenuButton } from '@/components/menu-button';
import {
  Appear,
  Bevel,
  DocumentsIcon,
  EmptyState,
  ErrorNote,
  FormatBlock,
  PageHeading,
  Screen,
  ScreenBar,
  stagger,
  Tag,
  Tap,
  Text,
} from '@/components/ui';
import { documentUrl, useDocuments } from '@/hooks/use-documents';
import { useT } from '@/hooks/use-language';
import { formatOf, formatSize, isRecent, type ClientDocument } from '@/lib/documents';
import { labelOf, type Dictionary } from '@/lib/i18n';
import { Brand, Corner, Gutter, Ink, Spacing, Surface } from '@/theme';

/**
 * I materiali che Revna ha condiviso con questa struttura.
 *
 * Sono in sola lettura: il caricamento avviene dal pannello interno Revna. Il tipo
 * di file è la prima informazione che serve, quindi diventa un blocco di formato a
 * sinistra; peso, categoria e data stanno in coda; «Nuovo» è l'unico uso
 * dell'arancio nell'elenco.
 *
 * L'elenco entra a scaletta: al suo posto un istante prima c'era una rotella, e
 * una lista che si materializza tutta insieme al posto di quella non si legge come
 * una risposta arrivata — si legge come un salto.
 */
export default function DocumentsScreen() {
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
    <Screen>
      <ScreenBar left={<MenuButton />} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <PageHeading title={t.documenti.titolo} subtitle={t.documenti.sottotitolo} />

        {loading && <ActivityIndicator color={Brand.accent} />}

        {(error !== '' || openError !== '') && <ErrorNote>{openError || error}</ErrorNote>}

        {!loading && documents.length === 0 && (
          <EmptyState icon={<DocumentsIcon color={Ink.faint} size={32} />} text={t.documenti.vuoto} />
        )}

        {documents.length > 0 && (
          <View style={styles.list}>
            {documents.map((document, index) => (
              <Appear key={document.id} delay={stagger(index)}>
                <Tap
                  onPress={() => open(document)}
                  accessibilityRole="button"
                  accessibilityLabel={document.name}>
                  <Bevel radius={Corner.card} fill={Surface.element} style={styles.row}>
                    <FormatBlock label={formatOf(document)} highlight={isRecent(document)} />

                    <View style={styles.grow}>
                      <Text variant="rowTitle" numberOfLines={2}>
                        {document.name}
                      </Text>
                      {document.description !== '' && (
                        <Text
                          variant="service"
                          color={Ink.secondary}
                          numberOfLines={2}
                          style={styles.description}>
                          {document.description}
                        </Text>
                      )}
                      <Text variant="tab" color={Ink.faint} style={styles.meta}>
                        {[
                          labelOf(t.documenti.categorie, document.categoria),
                          formatSize(document.size),
                          shortDate(document.uploadedAt, t),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>

                    {opening === document.id ? (
                      <ActivityIndicator color={Brand.accent} size="small" />
                    ) : isRecent(document) ? (
                      <Tag label={t.documenti.nuovo} />
                    ) : null}
                  </Bevel>
                </Tap>
              </Appear>
            ))}

            <Text variant="tab" color={Ink.ghost} style={styles.nota}>
              {t.documenti.nota}
            </Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function shortDate(iso: string, t: Dictionary): string {
  return iso
    ? new Date(iso).toLocaleDateString(t.dateLocale, { day: 'numeric', month: 'long' })
    : '';
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Gutter, paddingBottom: Spacing.xxl, gap: Spacing.xl },
  list: { gap: Spacing.sm + 2 },
  grow: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md + 1,
    padding: Spacing.lg - 1,
  },
  description: { marginTop: Spacing.xs },
  meta: { marginTop: Spacing.xs + 2 },
  nota: { lineHeight: 17, marginTop: Spacing.xs },
});
