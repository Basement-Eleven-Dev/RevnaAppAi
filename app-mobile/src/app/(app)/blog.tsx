import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/menu-button';
import { BlogIcon } from '@/components/tab-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useBlog } from '@/hooks/use-blog';
import { useT } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { BLOG_WEB_URL, type BlogPost } from '@/lib/blog';
import type { Dictionary } from '@/lib/i18n';

/**
 * Il blog di Revenue su Misura dentro l'app.
 *
 * Gli articoli si aprono nel browser e non in una schermata di dettaglio: sul
 * sito hanno grafici, tabelle e immagini che un renderer nostro impoverirebbe, e
 * la scheda del browser di sistema li mostra come sono, con la condivisione già
 * a portata di mano. Qui restano l'elenco e il motivo per toccare una card.
 *
 * A differenza delle altre sezioni non c'è FlatList da nessun'altra parte
 * nell'app: qui gli articoli sono oltre duecento, ognuno con una copertina, e
 * uno ScrollView li terrebbe tutti montati mentre si scorre.
 */
export default function BlogScreen() {
  const theme = useTheme();
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
      <ThemedText type="subtitle">{t.blog.titolo}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t.blog.sottotitolo}
      </ThemedText>

      {openError !== '' && (
        <ThemedText type="small" style={styles.error}>
          {openError}
        </ThemedText>
      )}

      {/* L'errore di rete si mostra qui solo se qualcosa c'è già a schermo: a
          lista vuota lo dice il riquadro al centro, con il tasto per riprovare. */}
      {error !== '' && posts.length > 0 && (
        <ThemedText type="small" style={styles.error}>
          {t.blog.errore}
        </ThemedText>
      )}
    </View>
  );

  const empty = loading ? (
    <ActivityIndicator color={theme.primary} />
  ) : (
    <ThemedView type="backgroundElement" style={styles.empty}>
      <BlogIcon color={theme.textSecondary} size={32} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
        {error !== '' ? t.blog.errore : t.blog.vuoto}
      </ThemedText>
      <Pressable
        onPress={() => (error !== '' ? retry() : void WebBrowser.openBrowserAsync(BLOG_WEB_URL))}
        accessibilityRole="button">
        <ThemedText type="smallBold" themeColor="primary">
          {error !== '' ? t.blog.riprova : t.blog.archivio}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.topbar}>
          <MenuButton />
        </View>

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
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={theme.primary} style={styles.footer} />
            ) : null
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
      </SafeAreaView>
    </ThemedView>
  );
}

type CardProps = {
  post: BlogPost;
  t: Dictionary;
  opening: boolean;
  onPress: () => void;
};

function PostCard({ post, t, opening, onPress }: CardProps) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={post.title}>
      {({ pressed }) => (
        <ThemedView
          type="backgroundElement"
          style={[styles.card, { borderColor: theme.border, opacity: pressed ? 0.6 : 1 }]}>
          {post.cover !== '' && (
            <Image
              source={post.cover}
              // Le copertine del sito sono 3:2 e la card le mostra a piena
              // larghezza: lo stesso rapporto e nessun ritaglio da decidere.
              style={[styles.cover, { backgroundColor: theme.backgroundSelected }]}
              contentFit="cover"
              transition={180}
              accessibilityLabel=""
            />
          )}

          <View style={styles.body}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
              {longDate(post.date, t)}
            </ThemedText>

            <ThemedText type="default" style={styles.title}>
              {post.title}
            </ThemedText>

            {post.excerpt !== '' && (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>
                {post.excerpt}
              </ThemedText>
            )}

            <ThemedText type="small" themeColor="primary" style={styles.action}>
              {opening ? t.blog.apertura : t.blog.apri}
            </ThemedText>
          </View>
        </ThemedView>
      )}
    </Pressable>
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
  list: { padding: Spacing.four, gap: Spacing.three },
  header: { gap: Spacing.one },
  error: { color: '#B3261E' },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
    borderRadius: Spacing.four,
  },
  emptyText: { textAlign: 'center', lineHeight: 20 },
  footer: { paddingVertical: Spacing.three },
  card: {
    borderRadius: Spacing.four,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cover: { width: '100%', aspectRatio: 3 / 2 },
  body: { gap: Spacing.two, padding: Spacing.four, backgroundColor: 'transparent' },
  meta: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  title: { fontWeight: 700, lineHeight: 22 },
  action: { fontWeight: '600', marginTop: Spacing.one },
});
