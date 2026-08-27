import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Markdown } from '@/components/markdown';
import {
  Appear,
  BackIcon,
  Bevel,
  EmptyState,
  IconButton,
  Mark,
  Screen,
  ScreenBar,
  Tap,
  Text,
} from '@/components/ui';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useAssistant } from '@/hooks/use-assistant';
import { useT } from '@/hooks/use-language';
import { Brand, Corner, Duration, Family, Gutter, Ink, Spacing, Surface } from '@/theme';
import type { Dictionary } from '@/lib/i18n';

/**
 * Un avviso, per esteso.
 *
 * L'avviso non si rilegge da Firestore: è già nell'elenco che il provider tiene
 * in ascolto, testo compreso. Aprirla lo segna come letto — leggere è quello che è
 * appena successo, e lasciarlo a un tocco vorrebbe dire un pallino che resta
 * accesso su una comunicazione che il cliente ha davanti agli occhi.
 *
 * In fondo c'è **una** azione: portare l'avviso in chat, dove l'assistente ha i
 * numeri della struttura. Non c'è una tab bar: da qui la strada è tornare
 * all'elenco, e cinque sezioni in fondo direbbero il contrario.
 *
 * Data, titolo e corpo entrano insieme, e non è decorazione: aprendo l'app da una
 * notifica l'elenco non è ancora arrivato, quindi al posto del testo c'è una
 * rotella, e il testo che la sostituisce di colpo si legge come uno scatto.
 */
export default function AnnouncementScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { announcements, loading, markRead } = useAnnouncements();
  const { prefill } = useAssistant();

  const announcement = announcements.find((row) => row.id === id);

  useEffect(() => {
    if (announcement && announcement.lettoAt === null) markRead(announcement.id);
  }, [announcement, markRead]);

  function askAssistant() {
    if (!announcement) return;
    prefill(t.avvisi.domandaSuAvviso(announcement.titolo));
    router.navigate('/chat');
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
          {t.avvisi.titolo}
        </Text>
      </ScreenBar>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Manca solo in due casi: l'elenco non è ancora arrivato — succede
            aprendo l'app da una notifica — o l'avviso è stato ritirato. */}
        {!announcement && loading && <ActivityIndicator color={Brand.accent} />}

        {!announcement && !loading && (
          <EmptyState text={t.avvisi.ritirato}>
            <Tap onPress={() => router.replace('/avvisi')} accessibilityRole="button">
              <Text variant="service" color={Brand.accent} style={styles.link}>
                {t.avvisi.tuttiGliAvvisi}
              </Text>
            </Tap>
          </EmptyState>
        )}

        {announcement && (
          <Appear>
            <Text variant="micro" color={Brand.accent}>
              {longDate(announcement.inviatoAt, t)}
            </Text>
            <Text variant="display" style={styles.title}>
              {announcement.titolo}
            </Text>
            <View style={styles.body}>
              <Markdown text={announcement.corpo} />
            </View>
          </Appear>
        )}
      </ScrollView>

      {announcement && (
        <Appear delay={Duration.enter} style={styles.footer}>
          <Tap onPress={askAssistant} accessibilityRole="button">
            <Bevel radius={Corner.control} fill={Surface.control} style={styles.action}>
              <Mark height={19} />
              <Text variant="service" color={Ink.primary} style={styles.actionLabel}>
                {t.avvisi.chiediAllAssistente}
              </Text>
            </Bevel>
          </Tap>
        </Appear>
      )}
    </Screen>
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
  scroll: { paddingHorizontal: Gutter + 2, paddingTop: Spacing.sm, paddingBottom: Spacing.xxl },
  // Il titolo di un avviso è il display della schermata, ma più corto: 27/1.13
  // nel sistema, cioè il display stretto di una misura.
  title: { fontSize: 27, lineHeight: 31, letterSpacing: -0.81, marginTop: Spacing.md },
  body: { marginTop: Spacing.lg + 2 },
  link: { fontFamily: Family.sansSemibold },
  footer: { paddingHorizontal: Gutter, paddingTop: Spacing.md + 2, paddingBottom: Spacing.huge - 4 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm + 1,
    paddingVertical: Spacing.md + 2,
  },
  actionLabel: { fontFamily: Family.sansSemibold, fontSize: 13.5 },
});
