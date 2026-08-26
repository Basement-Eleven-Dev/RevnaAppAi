import { usePathname, useRouter } from 'expo-router';
import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand-logo';
import {
  AnnouncementsIcon,
  BlogIcon,
  ChatIcon,
  DocumentsIcon,
  NewChatIcon,
  ProfileIcon,
  RequestsIcon,
  SettingsIcon,
} from '@/components/tab-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useAssistant } from '@/hooks/use-assistant';
import { useAuth } from '@/hooks/use-auth';
import { useConversations, whenLabel, type ConversationSummary } from '@/hooks/use-conversations';
import { useT } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import type { Dictionary } from '@/lib/i18n';

/** Larghezza massima del pannello; su schermi stretti si adatta (vedi il layout). */
export const SIDEBAR_MAX_WIDTH = 320;

type Icon = typeof ChatIcon;

/**
 * Le sezioni dell'app, nell'ordine in cui compaiono nel menu.
 *
 * Sono percorsi e non nomi di rotta del Drawer perché Impostazioni sta dentro lo
 * Stack di Profilo: per il Drawer è «profilo» come la scheda del cliente, mentre
 * nel menu sono due voci distinte, e a distinguerle è il percorso.
 */
const SECTIONS: { href: SectionHref; icon: Icon; label: (t: Dictionary) => string }[] = [
  { href: '/chat', icon: ChatIcon, label: (t) => t.nav.assistente },
  { href: '/avvisi', icon: AnnouncementsIcon, label: (t) => t.nav.avvisi },
  { href: '/documenti', icon: DocumentsIcon, label: (t) => t.nav.documenti },
  { href: '/blog', icon: BlogIcon, label: (t) => t.nav.blog },
  { href: '/richieste', icon: RequestsIcon, label: (t) => t.nav.richieste },
  { href: '/profilo', icon: ProfileIcon, label: (t) => t.nav.profilo },
  { href: '/profilo/impostazioni', icon: SettingsIcon, label: (t) => t.impostazioni.titolo },
];

type SectionHref =
  | '/chat'
  | '/avvisi'
  | '/documenti'
  | '/blog'
  | '/richieste'
  | '/profilo'
  | '/profilo/impostazioni';

/**
 * Il menu laterale dell'app: prima le sezioni, poi lo storico delle conversazioni.
 *
 * Sta dentro un Drawer e non dentro la schermata di chat perché è la navigazione
 * dell'app: le tab in fondo davano lo stesso peso a chat, documenti e profilo e
 * lasciavano lo storico — la cosa che si apre più spesso — nascosto in un
 * pannello che esisteva solo nella chat. Qui le due cose stanno insieme, come
 * nelle app di assistente conversazionale a cui i clienti sono abituati.
 */
export function AppSidebar({ navigation }: DrawerContentComponentProps) {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { conversations, loading, remove } = useConversations();
  const { conversationId, open, startNew } = useAssistant();
  const { unread } = useAnnouncements();

  /**
   * Il Drawer si chiude da sé quando si naviga altrove, ma non quando la voce
   * toccata è quella già aperta: chiuderlo a mano copre entrambi i casi.
   */
  function go(href: SectionHref) {
    navigation.closeDrawer();
    router.navigate(href);
  }

  function openConversation(conversation: ConversationSummary) {
    open(conversation);
    go('/chat');
  }

  function newConversation() {
    startNew();
    go('/chat');
  }

  function confirmRemove(conversation: ConversationSummary) {
    Alert.alert(
      t.conversazioni.confermaTitolo,
      t.conversazioni.confermaTesto(titleOf(conversation, t)),
      [
        { text: t.comune.annulla, style: 'cancel' },
        {
          text: t.comune.elimina,
          style: 'destructive',
          onPress: () => {
            void remove(conversation.id);
            if (conversation.id === conversationId) startNew();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.flex}>
      <View style={styles.brand}>
        <BrandLogo width={104} />
      </View>

      <View style={styles.sections}>
        {SECTIONS.map(({ href, icon: Icon, label }) => {
          // Uguaglianza, come prima: Impostazioni sta sotto `/profilo` ma nel menu è
          // una voce a sé, e accendere anche Profilo direbbe che sono la stessa cosa.
          // L'eccezione è l'avviso aperto — `/avvisi/<id>` non ha una voce sua, quindi
          // resta accesa quella dell'elenco da cui ci si è arrivati.
          const active = pathname === href || (href === '/avvisi' && pathname.startsWith('/avvisi/'));
          // Il pallino sta sull'icona degli avvisi, e solo lì: è l'unica sezione in cui
          // può arrivare qualcosa che il cliente non ha chiesto.
          const daLeggere = href === '/avvisi' && unread > 0;

          return (
            <Pressable
              key={href}
              onPress={() => go(href)}
              accessibilityRole="link"
              accessibilityState={{ selected: active }}
              accessibilityLabel={
                daLeggere ? `${label(t)}, ${t.avvisi.daLeggere(unread)}` : undefined
              }
              style={[styles.section, active && { backgroundColor: theme.backgroundSelected }]}>
              <View>
                <Icon color={active ? theme.primary : theme.textSecondary} size={22} />
                {daLeggere && (
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: theme.primary, borderColor: theme.backgroundElement },
                    ]}
                  />
                )}
              </View>
              <ThemedText type={active || daLeggere ? 'smallBold' : 'small'}>
                {label(t)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <ThemedText type="small" themeColor="textSecondary" style={styles.listLabel}>
        {t.conversazioni.titolo}
      </ThemedText>

      <ScrollView contentContainerStyle={styles.list}>
        {loading && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            {t.comune.caricamento}
          </ThemedText>
        )}

        {!loading && conversations.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            {t.conversazioni.vuoto}
          </ThemedText>
        )}

        {conversations.map((conversation) => {
          // Evidenziata solo se è anche la schermata aperta: altrove la chat non
          // si vede, e una riga accesa indicherebbe qualcosa che non è a schermo.
          const active = pathname === '/chat' && conversation.id === conversationId;
          return (
            <Pressable
              key={conversation.id}
              onPress={() => openConversation(conversation)}
              onLongPress={() => confirmRemove(conversation)}
              accessibilityState={{ selected: active }}
              style={[styles.item, active && { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="small" numberOfLines={2} style={styles.flex}>
                {titleOf(conversation, t)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.when}>
                {whenLabel(conversation.updatedAt, t)}
              </ThemedText>
            </Pressable>
          );
        })}

        {conversations.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {t.conversazioni.suggerimentoElimina}
          </ThemedText>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <Pressable
          onPress={() => go('/profilo')}
          accessibilityRole="link"
          accessibilityLabel={t.nav.profilo}
          style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">{initialOf(user?.email)}</ThemedText>
        </Pressable>

        <Pressable
          onPress={newConversation}
          accessibilityRole="button"
          style={[styles.newChat, { backgroundColor: theme.primary }]}>
          <NewChatIcon color="#FFFFFF" size={18} />
          <ThemedText type="smallBold" style={styles.newChatLabel}>
            {t.conversazioni.nuova}
          </ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/**
 * Il titolo lo genera il modello alla prima risposta, quindi c'è quasi sempre.
 * Il ripiego serve alle conversazioni salvate mentre quella generazione fallisce:
 * nell'elenco una riga senza etichetta non si distingue da una riga rotta.
 */
function titleOf(conversation: ConversationSummary, t: Dictionary): string {
  return conversation.title || t.conversazioni.senzaTitolo;
}

/** Iniziale dell'email, che è l'unica cosa che sappiamo sempre di chi è entrato. */
function initialOf(email: string | null | undefined): string {
  return email?.trim().charAt(0).toUpperCase() || '·';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  brand: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  sections: { paddingHorizontal: Spacing.two, gap: Spacing.half },
  // Il pallino dei non letti: sull'angolo dell'icona, con il bordo del colore del
  // menu, che è quello che lo fa staccare dal disegno sotto.
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  divider: { height: 1, marginVertical: Spacing.three, marginHorizontal: Spacing.four },
  listLabel: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two, fontSize: 12 },
  list: { paddingHorizontal: Spacing.two, paddingBottom: Spacing.three, gap: Spacing.half },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  when: { fontSize: 11 },
  empty: { padding: Spacing.three, lineHeight: 20 },
  hint: { padding: Spacing.three, fontSize: 11, lineHeight: 16 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 40,
    borderRadius: 20,
  },
  newChatLabel: { color: '#FFFFFF' },
});
