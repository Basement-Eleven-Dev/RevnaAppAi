import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Markdown } from '@/components/markdown';
import { BackIcon } from '@/components/tab-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useT } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import type { Dictionary } from '@/lib/i18n';

/**
 * Un avviso, per esteso.
 *
 * L'avviso non si rilegge da Firestore: è già nell'elenco che il provider tiene in
 * ascolto, testo compreso. Una lettura in più non porterebbe niente — il testo è quello
 * — e costringerebbe a uno stato di caricamento su una schermata che si apre da un
 * elenco in cui il contenuto c'era già.
 *
 * Aprirla la segna come letta. Non c'è un bottone «segna come letto»: leggere è quello
 * che è appena successo, e lasciarlo a un tocco vorrebbe dire un pallino rosso che
 * resta acceso su una comunicazione che il cliente ha davanti agli occhi.
 */
export default function AnnouncementScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { announcements, loading, markRead } = useAnnouncements();

  const announcement = announcements.find((row) => row.id === id);

  useEffect(() => {
    if (announcement && announcement.lettoAt === null) markRead(announcement.id);
  }, [announcement, markRead]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.topbar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t.comune.indietro}
            style={[styles.back, { borderColor: theme.border }]}>
            <BackIcon color={theme.textSecondary} size={18} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Manca solo in due casi: l'elenco non è ancora arrivato — succede
              aprendo l'app da una notifica — o l'avviso è stato ritirato. */}
          {!announcement && loading && <ActivityIndicator color={theme.primary} />}

          {!announcement && !loading && (
            <ThemedView type="backgroundElement" style={styles.empty}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                {t.avvisi.ritirato}
              </ThemedText>
              <Pressable onPress={() => router.replace('/avvisi')} accessibilityRole="button">
                <ThemedText type="smallBold" themeColor="primary">
                  {t.avvisi.tuttiGliAvvisi}
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}

          {announcement && (
            <>
              <View style={styles.header}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
                  {longDate(announcement.inviatoAt, t)} · {t.avvisi.da}
                </ThemedText>
                <ThemedText type="subtitle">{announcement.titolo}</ThemedText>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <Markdown text={announcement.corpo} />
            </>
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
  back: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { padding: Spacing.four, paddingBottom: Spacing.six },
  header: { gap: Spacing.one },
  meta: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  divider: { height: 1, marginVertical: Spacing.four },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
    borderRadius: Spacing.four,
  },
  emptyText: { textAlign: 'center', lineHeight: 20 },
});
