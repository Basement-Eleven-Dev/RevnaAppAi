import { usePathname, useRouter } from 'expo-router';
import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { useRef } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/brand/wordmark';
import { Appear, Bevel, Button, RequestsIcon, SettingsIcon, stagger, Tap, Text } from '@/components/ui';
import { useAssistant } from '@/hooks/use-assistant';
import { useAuth } from '@/hooks/use-auth';
import { useConversations, whenLabel, type ConversationSummary } from '@/hooks/use-conversations';
import { useT } from '@/hooks/use-language';
import { Brand, Corner, Gutter, Ink, Line, Spacing, Surface } from '@/theme';
import type { Dictionary } from '@/lib/i18n';

/** Larghezza massima del pannello; su schermi stretti si adatta (vedi il layout). */
export const SIDEBAR_MAX_WIDTH = 320;

/**
 * Il pannello laterale: le conversazioni, e le due voci che in una tab bar non
 * stanno.
 *
 * Le cinque sezioni sono già nella tab bar, quindi qui non si ripetono: un menu
 * che rifà la barra sotto costringe a scegliere due volte la stessa strada. Qui
 * c'è ciò che la barra non può tenere — lo **storico delle conversazioni**, che è
 * la cosa che si apre più spesso in un assistente e che in una tab non entra — e
 * in fondo le richieste di contatto e le impostazioni, che si aprono di rado.
 */
export function AppSidebar({ navigation }: DrawerContentComponentProps) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { conversations, loading, remove } = useConversations();
  const { conversationId, open, startNew } = useAssistant();
  const longPressedConversation = useRef<string | null>(null);

  /**
   * Il Drawer si chiude da sé quando si naviga altrove, ma non quando la voce
   * toccata è quella già aperta: chiuderlo a mano copre entrambi i casi.
   */
  function go(href: '/chat' | '/richieste' | '/impostazioni') {
    navigation.closeDrawer();
    router.navigate(href);
  }

  function openConversation(conversation: ConversationSummary) {
    open(conversation);
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
        <Wordmark width={96} />
      </View>

      <View style={styles.newChat}>
        <Button
          label={t.conversazioni.nuova}
          onPress={() => {
            startNew();
            go('/chat');
          }}
        />
      </View>

      <Text variant="micro" style={styles.listLabel}>
        {t.conversazioni.titolo}
      </Text>

      <ScrollView contentContainerStyle={styles.list}>
        {loading && (
          <Text variant="service" color={Ink.faint} style={styles.note}>
            {t.comune.caricamento}
          </Text>
        )}

        {!loading && conversations.length === 0 && (
          <Text variant="service" color={Ink.faint} style={styles.note}>
            {t.conversazioni.vuoto}
          </Text>
        )}

        {conversations.map((conversation, index) => {
          // Evidenziata solo se è anche la schermata aperta: altrove la chat non
          // si vede, e una riga accesa indicherebbe qualcosa che non è a schermo.
          const active = pathname === '/chat' && conversation.id === conversationId;

          return (
            // Lo storico arriva da Firestore mentre il pannello è già aperto: le
            // righe entrano a scaletta invece di riempire il vuoto di colpo.
            <Appear key={conversation.id} delay={stagger(index)}>
              <Tap
                onPressIn={() => {
                  longPressedConversation.current = null;
                }}
                onPress={() => {
                  // Dopo una pressione lunga, il rilascio non deve anche aprire
                  // la chat e chiudere il drawer sopra alla conferma.
                  if (longPressedConversation.current === conversation.id) return;
                  openConversation(conversation);
                }}
                onLongPress={() => {
                  longPressedConversation.current = conversation.id;
                  confirmRemove(conversation);
                }}
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityActions={[{ name: 'delete', label: t.comune.elimina }]}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === 'delete') confirmRemove(conversation);
                }}
                accessibilityState={{ selected: active }}>
                <Bevel
                  radius={Corner.control}
                  fill={active ? Surface.accentTint : undefined}
                  style={styles.item}>
                  <Text
                    variant="service"
                    color={active ? Brand.accent : Ink.body}
                    numberOfLines={2}
                    style={styles.flex}>
                    {titleOf(conversation, t)}
                  </Text>
                  <Text variant="tab" color={Ink.ghost}>
                    {whenLabel(conversation.updatedAt, t)}
                  </Text>
                </Bevel>
              </Tap>
            </Appear>
          );
        })}

        {conversations.length > 0 && (
          <Text variant="tab" color={Ink.ghost} style={styles.hint}>
            {t.conversazioni.suggerimentoElimina}
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <FooterLink
          label={t.nav.richieste}
          icon={<RequestsIcon color={Ink.muted} size={18} />}
          onPress={() => go('/richieste')}
        />
        <FooterLink
          label={t.impostazioni.titolo}
          icon={<SettingsIcon color={Ink.muted} size={18} />}
          onPress={() => go('/impostazioni')}
        />
        <Text variant="tab" color={Ink.ghost} style={styles.account} numberOfLines={1}>
          {user?.email ?? ''}
        </Text>
      </View>
    </SafeAreaView>
  );
}

function FooterLink({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Tap onPress={onPress} accessibilityRole="link" accessibilityLabel={label}>
      <View style={styles.footerLink}>
        {icon}
        <Text variant="service" color={Ink.secondary}>
          {label}
        </Text>
      </View>
    </Tap>
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  brand: { paddingHorizontal: Gutter, paddingTop: Spacing.lg, paddingBottom: Spacing.xl },
  newChat: { paddingHorizontal: Gutter, paddingBottom: Spacing.xl },
  listLabel: { paddingHorizontal: Gutter, paddingBottom: Spacing.md },
  list: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg, gap: Spacing.hair },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  note: { padding: Spacing.md },
  hint: { padding: Spacing.md, lineHeight: 16 },
  footer: {
    gap: Spacing.md,
    paddingHorizontal: Gutter,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Line.hairline,
  },
  footerLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  account: { paddingTop: Spacing.xs },
});
