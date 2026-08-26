import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchBlogPage, type BlogPost } from '@/lib/blog';

/**
 * Gli articoli del blog Revna, una pagina alla volta.
 *
 * A differenza degli altri elenchi dell'app questo non è in ascolto live: la
 * fonte è il sito pubblico, non Firestore, e un articolo che compare mentre si
 * scorre non è un'informazione che vale una connessione aperta. Si ricarica
 * all'apertura della schermata e quando l'utente tira giù la lista.
 */
export function useBlog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');

  const page = useRef(0);
  /** Una richiesta per volta: onEndReached scatta più di una volta per scroll. */
  const busy = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async (nextPage: number) => {
    if (busy.current) return;
    busy.current = true;

    const first = nextPage === 1;
    if (!first) setLoadingMore(true);

    try {
      const result = await fetchBlogPage(nextPage);
      if (!alive.current) return;

      page.current = nextPage;
      setHasMore(result.hasMore);
      setError('');
      // Sostituire alla prima pagina e non accodare: è anche il caso del
      // pull-to-refresh, dove accodare duplicherebbe tutto l'elenco.
      setPosts((current) => (first ? result.posts : dedupe([...current, ...result.posts])));
    } catch (cause) {
      if (!alive.current) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      busy.current = false;
      if (alive.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load(1);
  }, [load]);

  const loadMore = useCallback(() => {
    if (hasMore && !busy.current) void load(page.current + 1);
  }, [hasMore, load]);

  /** `retry` e non `refresh` sotto l'errore: la lista è vuota, non c'è da tirare. */
  const retry = useCallback(() => {
    setLoading(true);
    void load(1);
  }, [load]);

  return { posts, loading, refreshing, loadingMore, hasMore, error, refresh, loadMore, retry };
}

/**
 * Un articolo pubblicato mentre si scorre sposta di uno tutte le pagine
 * successive, e l'ultimo post di una pagina ricompare in cima a quella dopo.
 * Nella lista sarebbe una card doppia — e per React una chiave duplicata.
 */
function dedupe(posts: BlogPost[]): BlogPost[] {
  const seen = new Set<number>();
  return posts.filter((post) => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}
