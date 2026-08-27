import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { MenuButton } from '@/components/menu-button';
import {
  Appear,
  Bevel,
  BlogIcon,
  EmptyState,
  ErrorNote,
  PageHeading,
  Screen,
  ScreenBar,
  Tap,
  Text,
} from '@/components/ui';
import { useBlog } from '@/hooks/use-blog';
import { useT } from '@/hooks/use-language';
import { BLOG_WEB_URL, type BlogPost } from '@/lib/blog';
import { Brand, Corner, Duration, Family, Gutter, Ink, Spacing, Surface } from '@/theme';
import type { Dictionary } from '@/lib/i18n';

/**
 * Il blog di Revenue su Misura dentro l'app.
 *
 * Gli articoli si aprono nel browser e non in una schermata di dettaglio: sul sito
 * hanno grafici, tabelle e immagini che un renderer nostro impoverirebbe. Qui
 * restano l'elenco e il motivo per toccare una card.
 *
 * A differenza delle altre sezioni c'è una `FlatList`: qui gli articoli sono oltre
 * duecento, ognuno con una copertina, e uno `ScrollView` li terrebbe tutti montati.
 */
export default function BlogScreen() {
  const t = useT();
  const { posts, loading, refreshing, loadingMore, error, refresh, loadMore, retry } = useBlog();
  const [opening, setOpening] = useState(0);
  const [openError, setOpenError] = useState('');

  async function open(url: string, id: number) {
    setOpening(id);
    setOpenError('');
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (cause) {
      setOpenError(cause instanceof Error ? cause.message : t.blog.nonApribile);
    } finally {
      setOpening(0);
    }
  }

  const header = (
    <View style={styles.header}>
      <PageHeading title={t.blog.titolo} subtitle={t.blog.sottotitolo} />

      {openError !== '' && <ErrorNote>{openError}</ErrorNote>}

      {/* L'errore di rete si mostra qui solo se qualcosa c'è già a schermo: a
          lista vuota lo dice il riquadro al centro, con il tasto per riprovare. */}
      {error !== '' && posts.length > 0 && <ErrorNote>{t.blog.errore}</ErrorNote>}
    </View>
  );

  const empty = loading ? (
    <ActivityIndicator color={Brand.accent} />
  ) : (
    <EmptyState
      icon={<BlogIcon color={Ink.faint} size={32} />}
      text={error !== '' ? t.blog.errore : t.blog.vuoto}>
      <Tap
        onPress={() => (error !== '' ? retry() : void WebBrowser.openBrowserAsync(BLOG_WEB_URL))}
        accessibilityRole="button">
        <Text variant="service" color={Brand.accent} style={styles.strong}>
          {error !== '' ? t.blog.riprova : t.blog.archivio}
        </Text>
      </Tap>
    </EmptyState>
  );

  return (
    <Screen>
      <ScreenBar left={<MenuButton />} />

      <FlatList
        data={posts}
        keyExtractor={(post) => String(post.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={Brand.accent}
            colors={[Brand.accent]}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={Brand.accent} style={styles.footer} /> : null
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            t={t}
            opening={opening === item.id}
            onPress={() => open(item.url, item.id)}
          />
        )}
      />
    </Screen>
  );
}

function PostCard({
  post,
  t,
  opening,
  onPress,
}: {
  post: BlogPost;
  t: Dictionary;
  opening: boolean;
  onPress: () => void;
}) {
  return (
    // Una card per volta e non tutto l'elenco a scaletta: qui gli articoli sono
    // oltre duecento e si montano scorrendo, quindi ognuna entra quando arriva —
    // che è anche il momento in cui la copertina finisce di caricarsi.
    <Appear>
      <Tap onPress={onPress} accessibilityRole="link" accessibilityLabel={post.title}>
        <Bevel
          radius={Corner.card}
          fill={Surface.element}
          // La copertina arriva fino al bordo: i due angoli tagliati vanno
          // ridipinti col colore del fondo (vedi `mask` in `Bevel`).
          mask={post.cover !== '' ? Surface.base : undefined}>
          {post.cover !== '' && (
            // Le copertine del sito sono 3:2 e la card le mostra a piena
            // larghezza: lo stesso rapporto e nessun ritaglio da decidere.
            <Image
              source={post.cover}
              style={styles.cover}
              contentFit="cover"
              transition={Duration.enter}
              accessibilityLabel=""
            />
          )}

          <View style={styles.body}>
            <Text variant="micro">{longDate(post.date, t)}</Text>
            <Text variant="section" numberOfLines={3} style={styles.title}>
              {post.title}
            </Text>
            {post.excerpt !== '' && (
              <Text variant="service" color={Ink.secondary} numberOfLines={3}>
                {post.excerpt}
              </Text>
            )}
            <Text variant="service" color={Brand.accent} style={styles.strong}>
              {opening ? t.blog.apertura : t.blog.apri}
            </Text>
          </View>
        </Bevel>
      </Tap>
    </Appear>
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
  list: { paddingHorizontal: Gutter, paddingBottom: Spacing.xxl, gap: Spacing.sm + 2 },
  header: { paddingBottom: Spacing.lg, gap: Spacing.sm },
  footer: { paddingVertical: Spacing.lg },
  cover: { width: '100%', aspectRatio: 3 / 2, backgroundColor: Surface.card },
  body: { gap: Spacing.sm, padding: Spacing.lg + 1 },
  title: { marginTop: Spacing.xs - 2 },
  strong: { fontFamily: Family.sansSemibold, marginTop: Spacing.xs },
});
