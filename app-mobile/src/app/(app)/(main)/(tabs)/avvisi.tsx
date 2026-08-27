import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { MenuButton } from '@/components/menu-button';
import {
  AccentRow,
  AnnouncementsIcon,
  Appear,
  BlockLabel,
  EmptyState,
  ErrorNote,
  PageHeading,
  QuietRow,
  Screen,
  ScreenBar,
  stagger,
  Text,
} from '@/components/ui';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useT } from '@/hooks/use-language';
import { isUnread } from '@/lib/announcements';
import { Brand, Gutter, Ink, Spacing } from '@/theme';
import type { Dictionary } from '@/lib/i18n';

/**
 * Gli avvisi di Revna a questa struttura.
 *
 * È l'unica sezione in cui il contenuto arriva senza che il cliente l'abbia
 * chiesto: per questo l'elenco distingue **letto da non letto** prima di ogni
 * altra cosa, e lo fa con due componenti diversi — card in accento con la barra
 * laterale contro riga di testo su linea sottile. Non è lo stesso elemento con un
 * pallino in più: da lontano si deve vedere se c'è qualcosa da leggere.
 *
 * Il testo intero si apre in una schermata a sé e in elenco c'è l'estratto: una
 * comunicazione può essere lunga, e sette avvisi aperti tutti insieme sarebbero un
 * muro in cui non si trova quello di ieri.
 *
 * La stessa distinzione vale per il modo in cui l'elenco entra in scena: i non
 * letti si accendono **a scaletta**, uno dopo l'altro, perché sono quelli che
 * l'occhio deve contare; i già letti entrano tutti insieme come un blocco solo,
 * perché non devono chiamare nessuno.
 */
export default function AnnouncementsScreen() {
  const t = useT();
  const router = useRouter();
  const { announcements, unread, loading, error, notifiche } = useAnnouncements();

  const daLeggere = announcements.filter(isUnread);
  const letti = announcements.filter((announcement) => !isUnread(announcement));

  return (
    <Screen>
      <ScreenBar left={<MenuButton />} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <PageHeading
          title={t.avvisi.titolo}
          subtitle={unread > 0 ? t.avvisi.daLeggere(unread) : t.avvisi.sottotitolo}
          accent={unread > 0}
        />

        {loading && <ActivityIndicator color={Brand.accent} />}

        {error !== '' && <ErrorNote>{error}</ErrorNote>}

        {!loading && announcements.length === 0 && (
          <EmptyState
            icon={<AnnouncementsIcon color={Ink.faint} size={32} />}
            text={t.avvisi.vuoto}
          />
        )}

        {daLeggere.length > 0 && (
          <View style={styles.group}>
            {daLeggere.map((announcement, index) => (
              <Appear key={announcement.id} delay={stagger(index)}>
                <AccentRow
                  title={announcement.titolo}
                  body={announcement.estratto || undefined}
                  meta={longDate(announcement.inviatoAt, t)}
                  onPress={() => router.push(`/avvisi/${announcement.id}`)}
                />
              </Appear>
            ))}
          </View>
        )}

        {letti.length > 0 && (
          <Appear delay={stagger(daLeggere.length)} style={styles.readGroup}>
            {daLeggere.length > 0 && <BlockLabel color={Ink.ghost}>{t.avvisi.giaLetti}</BlockLabel>}
            {letti.map((announcement) => (
              <QuietRow
                key={announcement.id}
                title={announcement.titolo}
                meta={longDate(announcement.inviatoAt, t)}
                onPress={() => router.push(`/avvisi/${announcement.id}`)}
              />
            ))}
          </Appear>
        )}

        {/* Solo a permesso negato, e in fondo: è un'informazione utile una volta
            sola, e non deve stare sopra le comunicazioni che è venuto a leggere. */}
        {notifiche === 'negate' && announcements.length > 0 && (
          <Text variant="tab" color={Ink.ghost} style={styles.nota}>
            {t.avvisi.notificheNegate}
          </Text>
        )}
      </ScrollView>
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
  scroll: { paddingHorizontal: Gutter, paddingBottom: Spacing.xxl, gap: Spacing.xl },
  group: { gap: Spacing.sm + 2 },
  readGroup: { gap: Spacing.xs },
  nota: { lineHeight: 17 },
});
