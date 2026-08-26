import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/menu-button';
import { AnnouncementsIcon } from '@/components/tab-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useT } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { isUnread } from '@/lib/announcements';
import type { Dictionary } from '@/lib/i18n';

/**
 * Gli avvisi di Revna a questa struttura.
 *
 * È l'unica sezione in cui il contenuto arriva senza che il cliente l'abbia chiesto:
 * per questo l'elenco distingue **letto da non letto** prima di ogni altra cosa. Il
 * pallino non è una decorazione — è la risposta alla domanda con cui si entra qui, che
 * è «c'è qualcosa che devo ancora leggere».
 *
 * Il testo intero si apre in una schermata a sé e in elenco c'è l'estratto: una
 * comunicazione può essere lunga, avere titoli e immagini, e sette avvisi aperti tutti
 * insieme sarebbero un muro in cui non si trova quello di ieri.
 */
export default function AnnouncementsScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const { announcements, unread, loading, error, notifiche } = useAnnouncements();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.topbar}>
          <MenuButton />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <ThemedText type="subtitle">{t.avvisi.titolo}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {unread > 0 ? t.avvisi.daLeggere(unread) : t.avvisi.sottotitolo}
            </ThemedText>
          </View>

          {loading && <ActivityIndicator color={theme.primary} />}

          {!loading && announcements.length === 0 && (
            <ThemedView type="backgroundElement" style={styles.empty}>
              <AnnouncementsIcon color={theme.textSecondary} size={32} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                {t.avvisi.vuoto}
              </ThemedText>
            </ThemedView>
          )}

          {error !== '' && (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          )}

          {announcements.map((announcement) => (
            <Pressable
              key={announcement.id}
              onPress={() => router.push(`/avvisi/${announcement.id}`)}
              accessibilityRole="button"
              accessibilityLabel={announcement.titolo}>
              {({ pressed }) => (
                <ThemedView
                  type="backgroundElement"
                  style={[
                    styles.card,
                    {
                      // Il non letto ha il bordo del brand: nell'elenco si riconosce
                      // da lontano, anche prima di leggere il titolo.
                      borderColor: isUnread(announcement) ? theme.primary : theme.border,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}>
                  <View style={styles.cardHead}>
                    {isUnread(announcement) && (
                      <View style={[styles.dot, { backgroundColor: theme.primary }]} />
                    )}
                    <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
                      {longDate(announcement.inviatoAt, t)}
                    </ThemedText>
                  </View>

                  <ThemedText type={isUnread(announcement) ? 'smallBold' : 'small'}>
                    {announcement.titolo}
                  </ThemedText>

                  {announcement.estratto !== '' && (
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>
                      {announcement.estratto}
                    </ThemedText>
                  )}

                  <ThemedText type="small" themeColor="primary" style={styles.action}>
                    {t.avvisi.leggi}
                  </ThemedText>
                </ThemedView>
              )}
            </Pressable>
          ))}

          {/* Solo a permesso negato, e in fondo: è un'informazione utile una volta
              sola, e non deve stare sopra le comunicazioni che è venuto a leggere. */}
          {notifiche === 'negate' && announcements.length > 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.nota}>
              {t.avvisi.notificheNegate}
            </ThemedText>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function longDate(iso: string, t: Dictionary): string {
  return iso
    ? new Date(iso).toLocaleDateString(t.dateLocale, {
        day: 'numeric',
        month: 'long',
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
  error: { color: '#B3261E' },
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
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 8, height: 8, borderRadius: 4 },
  meta: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  action: { fontWeight: '600', marginTop: Spacing.one },
  nota: { lineHeight: 20, paddingTop: Spacing.two },
});
