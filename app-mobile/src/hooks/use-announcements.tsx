import { useRouter } from 'expo-router';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useT } from '@/hooks/use-language';
import { useLiveData, type Subscribe } from '@/hooks/use-live-data';
import { isUnread, MAX_LISTED, type Announcement } from '@/lib/announcements';
import { getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
import {
  onAnnouncementOpened,
  registerPushToken,
  setBadgeCount,
  type PushState,
} from '@/lib/push';

type AnnouncementsState = ReturnType<typeof useAnnouncementsState>;

const AnnouncementsContext = createContext<AnnouncementsState | null>(null);

const NONE: Announcement[] = [];

/**
 * In ascolto live, come i documenti: un avviso che arriva mentre l'app è aperta deve
 * comparire da sé. Vale anche per una correzione — il consulente riscrive il testo di
 * una comunicazione già mandata e chi la sta leggendo vede la versione giusta.
 */
const subscribe: Subscribe<Announcement[]> = (uid, onData, onError) =>
  onSnapshot(
    query(
      collection(getFirebaseDb(), 'users', uid, 'announcements'),
      orderBy('inviatoAt', 'desc'),
      limit(MAX_LISTED)
    ),
    (snapshot) =>
      onData(
        snapshot.docs.map((document) => {
          const data = document.data();
          return {
            id: document.id,
            titolo: (data['titolo'] as string) ?? '',
            corpo: (data['corpo'] as string) ?? '',
            estratto: (data['estratto'] as string) ?? '',
            inviatoAt: (data['inviatoAt'] as string) ?? '',
            lettoAt: (data['lettoAt'] as string | null) ?? null,
          } satisfies Announcement;
        })
      ),
    onError
  );

/**
 * Gli avvisi ricevuti da questo cliente, condivisi da tutta l'area riservata.
 *
 * Sta sopra le schermate e non dentro la sezione Avvisi per il pallino rosso: il
 * conteggio dei non letti si vede nel menu laterale, cioè da qualsiasi schermata, e
 * senza un posto comune ogni componente che lo mostra aprirebbe una propria
 * connessione a Firestore per contare le stesse righe.
 *
 * Qui stanno anche le notifiche, che sono la stessa cosa vista da fuori: gli avvisi non
 * letti sono il numero sull'icona dell'app, e toccare una notifica deve aprire quel
 * preciso avviso.
 */
export function AnnouncementsProvider({ children }: { children: React.ReactNode }) {
  const state = useAnnouncementsState();

  return (
    <AnnouncementsContext.Provider value={state}>{children}</AnnouncementsContext.Provider>
  );
}

export function useAnnouncements(): AnnouncementsState {
  const state = useContext(AnnouncementsContext);

  if (!state) {
    throw new Error(
      "useAnnouncements richiede <AnnouncementsProvider> (vedi src/app/(app)/_layout.tsx)."
    );
  }

  return state;
}

function useAnnouncementsState() {
  const { user } = useAuth();
  const router = useRouter();
  const channelName = useT().avvisi.canaleNotifiche;
  const { data: received, loading, error } = useLiveData(subscribe, NONE);
  /** Gli avvisi aperti da poco, con l'ora: letti per l'app finché il server non lo conferma. */
  const [opened, setOpened] = useState<Record<string, string>>({});
  const [notifiche, setNotifiche] = useState<PushState>('sconosciuto');

  const announcements = useMemo(
    () =>
      received.map((announcement) =>
        announcement.lettoAt === null && opened[announcement.id]
          ? { ...announcement, lettoAt: opened[announcement.id] }
          : announcement
      ),
    [received, opened]
  );

  const unread = announcements.filter(isUnread).length;

  /** Il numero sull'icona dell'app segue i non letti, in salita e in discesa. */
  useEffect(() => {
    void setBadgeCount(unread);
  }, [unread]);

  useEffect(() => {
    if (!user) return;

    let alive = true;
    void registerPushToken(user.uid, channelName).then((stato) => {
      if (alive) setNotifiche(stato);
    });

    return () => {
      alive = false;
    };
  }, [user, channelName]);

  /** Toccando la notifica si apre quell'avviso, non l'elenco. */
  useEffect(() => {
    return onAnnouncementOpened((id) => router.push(`/avvisi/${id}`));
  }, [router]);

  /**
   * Segna un avviso come letto.
   *
   * Passa da una function perché la lettura va contata anche sull'originale, che il
   * cliente non può vedere: è quello che dice al consulente se una comunicazione è
   * stata aperta (vedi `markAnnouncementRead`).
   *
   * Il pallino sparisce subito, senza attendere la risposta: chi ha appena aperto
   * l'avviso non deve vedere il proprio tocco arrivare con mezzo secondo di ritardo. Se
   * la chiamata fallisce il pallino torna, e alla prossima apertura si riprova.
   */
  const markRead = useCallback((id: string) => {
    setOpened((current) => ({ ...current, [id]: new Date().toISOString() }));

    const call = httpsCallable<{ id: string }, { ok: true }>(
      getFirebaseFunctions(),
      'markAnnouncementRead'
    );

    void call({ id }).catch(() =>
      setOpened((current) => {
        const rest = { ...current };
        delete rest[id];
        return rest;
      })
    );
  }, []);

  return { announcements, unread, loading, error, notifiche, markRead };
}
