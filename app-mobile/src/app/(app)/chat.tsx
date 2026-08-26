import { useRouter } from 'expo-router';
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
import { ContactRequestModal } from '@/components/contact-request-modal';
import { Markdown } from '@/components/markdown';
import { MenuButton } from '@/components/menu-button';
import { Sources } from '@/components/sources';
import { NewChatIcon, SendIcon } from '@/components/tab-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAssistant } from '@/hooks/use-assistant';
import { useClientProfile } from '@/hooks/use-client-profile';
import { createContactRequest } from '@/hooks/use-contact-requests';
import { useT } from '@/hooks/use-language';
import { useStarters } from '@/hooks/use-starters';
import { useTheme } from '@/hooks/use-theme';

export default function ChatScreen() {
  const theme = useTheme();
  const t = useT();
  const { profile } = useClientProfile();
  const router = useRouter();
  const { conversationId, turns, busy, waiting, error, send, startNew } = useAssistant();
  // Gli spunti arrivano dal backoffice: sono parte della personalità dell'assistente,
  // non una costante dell'app.
  const spunti = useStarters();
  const [draft, setDraft] = useState('');
  /** Il turno di cui si sta confermando la richiesta di contatto, se ce n'è uno. */
  const [proposing, setProposing] = useState<{ key: string; text: string } | null>(null);
  /**
   * I turni da cui una richiesta è già partita, per non farla partire due volte.
   * Vive quanto la schermata: a richiesta inviata la traccia sta nella sezione
   * «Richieste», che è il posto dove ha senso cercarla.
   */
  const [sent, setSent] = useState<Record<string, boolean>>({});
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
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={[styles.topbar, { borderBottomColor: theme.border }]}>
          <MenuButton />

          <View style={styles.titles}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {t.chat.titolo}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              numberOfLines={1}
              style={styles.subtitle}>
              {struttura ? struttura : t.chat.strutturaSconosciuta}
            </ThemedText>
          </View>

          {turns.length > 0 && (
            <Pressable
              onPress={startNew}
              hitSlop={8}
              accessibilityLabel={t.chat.nuovaConversazione}
              style={[styles.iconButton, { borderColor: theme.border }]}>
              <NewChatIcon color={theme.textSecondary} size={18} />
            </Pressable>
          )}
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scroller}
            contentContainerStyle={styles.scroll}
            keyboardDismissMode="interactive"
            onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}>
            {turns.length === 0 && (
              <View style={styles.empty}>
                <ThemedText type="subtitle">{t.chat.incipit}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t.chat.incipitAiuto}
                </ThemedText>
                <View style={styles.spunti}>
                  {spunti.map((spunto) => (
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
                  {turn.sources !== undefined && <Sources sources={turn.sources} />}
                  {turn.proposal !== undefined && !(busy && index === turns.length - 1) && (
                    <ContactCta
                      sent={sent[proposalKey(conversationId, index)] === true}
                      onOpen={() =>
                        setProposing({
                          key: proposalKey(conversationId, index),
                          text: turn.proposal ?? '',
                        })
                      }
                      onGoToRequests={() => router.navigate('/richieste')}
                    />
                  )}
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
                placeholder={t.chat.scrivi}
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
                accessibilityLabel={t.chat.invia}
                onPress={() => submit(draft)}>
                <SendIcon color={canSend ? '#FFFFFF' : theme.textSecondary} />
              </Pressable>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
              {t.chat.disclaimer}
            </ThemedText>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <ContactRequestModal
        // La modale riparte dalla proposta di questo turno e non da quella di prima:
        // la `key` la rimonta quando il turno cambia (vedi `ContactRequestModal`).
        key={proposing?.key ?? 'nessuna'}
        visible={proposing !== null}
        draft={proposing?.text}
        onClose={() => setProposing(null)}
        onConfirm={async (messaggio) => {
          // La conversazione viaggia con la richiesta: chi la prende in mano dal
          // backoffice deve poter leggere come si è arrivati fin qui.
          await createContactRequest({
            messaggio,
            ...(conversationId ? { conversationId } : {}),
          });
          if (proposing) setSent((already) => ({ ...already, [proposing.key]: true }));
          setProposing(null);
        }}
      />
    </ThemedView>
  );
}

/**
 * L'offerta di essere ricontattati, sotto la risposta che l'ha motivata.
 *
 * Sta lì e non in fondo alla schermata perché è la coda di quella risposta: è quando
 * si legge «questo non me ne occupo io» che ha senso chiedere una persona, e un
 * bottone lontano da quella frase costringerebbe a ricordarsi perché era comparso.
 *
 * A richiesta inviata il bottone non torna: al suo posto resta la conferma e la
 * strada per andare a vedere che fine ha fatto.
 */
function ContactCta({
  sent,
  onOpen,
  onGoToRequests,
}: {
  sent: boolean;
  onOpen: () => void;
  onGoToRequests: () => void;
}) {
  const theme = useTheme();
  const t = useT();

  if (sent) {
    return (
      <Pressable onPress={onGoToRequests} style={[styles.cta, { borderColor: theme.border }]}>
        <ThemedText type="smallBold">{t.richieste.inviata}</ThemedText>
        <ThemedText type="small" themeColor="primary">
          {t.richieste.trovaInSezione}
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onOpen} accessibilityRole="button">
      {({ pressed }) => (
        <View
          style={[
            styles.cta,
            { borderColor: theme.primary, opacity: pressed ? 0.6 : 1 },
          ]}>
          <ThemedText type="smallBold" themeColor="primary">
            {t.richieste.apri}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t.richieste.modale.aiuto}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

/**
 * La chiave con cui ricordare che da questo turno una richiesta è già partita.
 * Porta dentro la conversazione: cambiando chat gli indici ripartono, e senza
 * l'id il turno 3 di una sarebbe il turno 3 dell'altra.
 */
function proposalKey(conversationId: string | undefined, index: number): string {
  return `${conversationId ?? 'nuova'}:${index}`;
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
  cta: {
    gap: Spacing.one,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.three,
  },
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
    // I campi non passano da ThemedText: il font del brand va detto qui.
    fontFamily: Fonts.sans,
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
