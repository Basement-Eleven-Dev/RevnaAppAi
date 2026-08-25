import { useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CloseIcon, NewChatIcon } from '@/components/tab-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useConversations, whenLabel, type ConversationSummary } from '@/hooks/use-conversations';
import { useTheme } from '@/hooks/use-theme';

const WIDTH = Math.min(320, Dimensions.get('window').width * 0.84);

type Props = {
  open: boolean;
  currentId?: string;
  onClose: () => void;
  onSelect: (conversation: ConversationSummary) => void;
  onNew: () => void;
};

/**
 * Elenco delle conversazioni precedenti, che entra da sinistra.
 *
 * È un pannello dentro la schermata e non un Drawer di navigazione: le tab sono
 * già la navigazione dell'app, annidarci dentro un secondo navigatore
 * complicherebbe il routing per un pannello che vive solo qui.
 */
export function ConversationsSidebar({ open, currentId, onClose, onSelect, onNew }: Props) {
  const theme = useTheme();
  const { conversations, loading, remove } = useConversations();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: open ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [open, slide]);

  // Smontato quando è chiuso: niente pannello invisibile che intercetta i tocchi.
  if (!open) return null;

  function confirmRemove(conversation: ConversationSummary) {
    Alert.alert(
      'Eliminare la conversazione?',
      `«${conversation.title}» verrà eliminata definitivamente.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: () => {
            void remove(conversation.id);
            if (conversation.id === currentId) onNew();
          },
        },
      ]
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: slide }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Chiudi" />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: theme.backgroundElement,
            borderRightColor: theme.border,
            transform: [
              { translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-WIDTH, 0] }) },
            ],
          },
        ]}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.flex}>
          <View style={styles.header}>
            <ThemedText type="smallBold">Conversazioni</ThemedText>
            <Pressable onPress={onClose} hitSlop={10}>
              <CloseIcon color={theme.textSecondary} size={18} />
            </Pressable>
          </View>

          <Pressable
            onPress={() => {
              onNew();
              onClose();
            }}
            style={[styles.newChat, { borderColor: theme.border }]}>
            <NewChatIcon color={theme.primary} size={18} />
            <ThemedText type="smallBold">Nuova conversazione</ThemedText>
          </Pressable>

          <ScrollView contentContainerStyle={styles.list}>
            {loading && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                Caricamento…
              </ThemedText>
            )}

            {!loading && conversations.length === 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                Nessuna conversazione. Le trovi qui appena ne inizi una.
              </ThemedText>
            )}

            {conversations.map((conversation) => {
              const active = conversation.id === currentId;
              return (
                <Pressable
                  key={conversation.id}
                  onPress={() => {
                    onSelect(conversation);
                    onClose();
                  }}
                  onLongPress={() => confirmRemove(conversation)}
                  style={[
                    styles.item,
                    active && { backgroundColor: theme.backgroundSelected },
                  ]}>
                  <ThemedText type="small" numberOfLines={2} style={styles.title}>
                    {conversation.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.when}>
                    {whenLabel(conversation.updatedAt)}
                  </ThemedText>
                </Pressable>
              );
            })}

            {conversations.length > 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                Tieni premuto su una conversazione per eliminarla.
              </ThemedText>
            )}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: WIDTH,
    borderRightWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  newChat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.three,
  },
  list: { padding: Spacing.three, gap: Spacing.one },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  title: { flex: 1 },
  when: { fontSize: 11 },
  empty: { padding: Spacing.three, lineHeight: 20 },
  hint: { padding: Spacing.three, fontSize: 11, lineHeight: 16 },
});
