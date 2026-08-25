import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AssistantBadge } from '@/components/assistant-badge';
import { ConversationsSidebar } from '@/components/conversations-sidebar';
import { Markdown } from '@/components/markdown';
import { MenuIcon, NewChatIcon, SendIcon } from '@/components/tab-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAssistant } from '@/hooks/use-assistant';
import { useClientProfile } from '@/hooks/use-client-profile';
import { useTheme } from '@/hooks/use-theme';

/**
 * Spunti di partenza, così alla nuova conversazione il cliente non trova
 * un foglio bianco. Andranno resi dipendenti dal profilo della struttura.
 */
const SPUNTI = [
  'Analizza la mia stagionalità',
  'Come miglioro il mio ADR',
  'Come riduco la dipendenza dalle OTA',
  'Che tariffe imposto per il prossimo ponte',
];

export default function ChatScreen() {
  const theme = useTheme();
  const { profile } = useClientProfile();
  const { conversationId, turns, busy, waiting, error, send, open, startNew } = useAssistant();
  const [draft, setDraft] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const struttura = profile?.struttura.nome;
  const canSend = draft.trim() !== '' && !busy;

  function submit(text: string) {
    if (busy || text.trim() === '') return;
    setDraft('');
    void send(text);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.topbar, { borderBottomColor: theme.border }]}>
          <Pressable
            onPress={() => setSidebarOpen(true)}
            hitSlop={8}
            accessibilityLabel="Conversazioni"
            style={[styles.iconButton, { borderColor: theme.border }]}>
            <MenuIcon color={theme.textSecondary} size={18} />
          </Pressable>

          <View style={styles.titles}>
            <ThemedText type="smallBold" numberOfLines={1}>
              Assistente Revna
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              numberOfLines={1}
              style={styles.subtitle}>
              {struttura ? struttura : 'La tua struttura'}
            </ThemedText>
          </View>

          {turns.length > 0 && (
            <Pressable
              onPress={startNew}
              hitSlop={8}
              accessibilityLabel="Nuova conversazione"
              style={[styles.iconButton, { borderColor: theme.border }]}>
              <NewChatIcon color={theme.textSecondary} size={18} />
            </Pressable>
          )}
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scroller}
            contentContainerStyle={styles.scroll}
            keyboardDismissMode="interactive"
            onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}>
            {turns.length === 0 && (
              <View style={styles.empty}>
                <ThemedText type="subtitle">Da dove partiamo?</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Le risposte tengono conto dei dati della tua struttura.
                </ThemedText>
                <View style={styles.spunti}>
                  {SPUNTI.map((spunto) => (
                    <Pressable key={spunto} onPress={() => submit(spunto)}>
                      {({ pressed }) => (
                        <ThemedView
                          type="backgroundElement"
                          style={[styles.spunto, { borderColor: theme.border, opacity: pressed ? 0.6 : 1 }]}>
                          <ThemedText type="small">{spunto}</ThemedText>
                        </ThemedView>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {turns.map((turn, index) =>
              turn.role === 'user' ? (
                <ThemedView
                  key={index}
                  type="backgroundSelected"
                  style={[styles.bubble, styles.mine]}>
                  <ThemedText type="small">{turn.text}</ThemedText>
                </ThemedView>
              ) : (
                <View key={index} style={styles.answer}>
                  <AssistantBadge />
                  <Markdown text={turn.text} />
                  {busy && index === turns.length - 1 && <Caret />}
                </View>
              )
            )}

            {waiting && (
              <View style={styles.answer}>
                <AssistantBadge />
                <TypingDots />
              </View>
            )}

            {error !== '' && (
              <ThemedText type="small" style={{ color: '#B3261E' }}>
                {error}
              </ThemedText>
            )}
          </ScrollView>

          <View style={styles.composerWrap}>
            <View
              style={[
                styles.composer,
                { borderColor: theme.border, backgroundColor: theme.backgroundElement },
              ]}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Scrivi la tua domanda…"
                placeholderTextColor={theme.textSecondary}
                multiline
                value={draft}
                onChangeText={setDraft}
                editable={!busy}
              />
              <Pressable
                style={[
                  styles.send,
                  { backgroundColor: canSend ? theme.primary : theme.backgroundSelected },
                ]}
                disabled={!canSend}
                accessibilityLabel="Invia"
                onPress={() => submit(draft)}>
                <SendIcon color={canSend ? '#FFFFFF' : theme.textSecondary} />
              </Pressable>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
              Revna AI può sbagliare. Verifica le informazioni importanti.
            </ThemedText>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <ConversationsSidebar
        open={sidebarOpen}
        currentId={conversationId}
        onClose={() => setSidebarOpen(false)}
        onSelect={open}
        onNew={startNew}
      />
    </ThemedView>
  );
}

/** Cursore che lampeggia in coda al testo mentre la risposta arriva. */
function Caret() {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.15, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.caret, { opacity, backgroundColor: theme.primary }]} />
  );
}

/** Tre puntini nell'attesa tra l'invio e il primo pezzo di risposta. */
function TypingDots() {
  const theme = useTheme();
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(dot, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - index) * 160),
        ])
      )
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [dots]);

  return (
    <View style={styles.dots}>
      {dots.map((dot, index) => (
        <Animated.View
          key={index}
          style={[styles.dot, { opacity: dot, backgroundColor: theme.textSecondary }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  flex: { flex: 1 },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },
  titles: { flex: 1 },
  subtitle: { marginTop: 1 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { padding: Spacing.four, gap: Spacing.four },
  empty: { gap: Spacing.two, paddingTop: Spacing.four },
  spunti: { gap: Spacing.two, marginTop: Spacing.three },
  spunto: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  bubble: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
    maxWidth: '88%',
  },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: Spacing.one },
  answer: { alignSelf: 'stretch' },
  caret: { width: 8, height: 16, borderRadius: 2, marginTop: Spacing.one },
  dots: { flexDirection: 'row', gap: 5, paddingVertical: Spacing.two },
  dot: { width: 7, height: 7, borderRadius: 4 },
  composerWrap: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
    paddingVertical: Spacing.one,
    borderWidth: 1,
    borderRadius: 24,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 140,
    paddingVertical: Spacing.two + 2,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  disclaimer: { textAlign: 'center', fontSize: 11, lineHeight: 14 },
});
