import { useRouter } from 'expo-router';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputKeyPressEventData,
  View,
} from 'react-native';

import { ContactRequestModal } from '@/components/contact-request-modal';
import { HandoffCard, HandoffSent } from '@/components/handoff-card';
import { Markdown } from '@/components/markdown';
import { MenuButton } from '@/components/menu-button';
import { Sources } from '@/components/sources';
import {
  Appear,
  AssistantSignature,
  Bevel,
  CharCount,
  ErrorNote,
  GlassPanel,
  IconButton,
  Mark,
  PlusIcon,
  Screen,
  ScreenBar,
  SendIcon,
  stagger,
  StreamCaret,
  Tap,
  Text,
  Tile,
  TypingDots,
} from '@/components/ui';
import { useAssistant } from '@/hooks/use-assistant';
import { useClientProfile } from '@/hooks/use-client-profile';
import { createContactRequest, dismissProposal } from '@/hooks/use-contact-requests';
import { MAX_MESSAGE_CHARS } from '@/hooks/use-conversations';
import { useT } from '@/hooks/use-language';
import { useStarters } from '@/hooks/use-starters';
import { errorMessage } from '@/lib/i18n';
import { Brand, Corner, Duration, Family, Gutter, Ink, Spacing, Surface } from '@/theme';

/** Entro questa distanza dal fondo la chat si considera «in fondo» e lo segue. */
const SOGLIA_FONDO = 64;

/**
 * La chat con l'assistente: la prima schermata dell'app.
 *
 * A conversazione vuota il monogramma fa da segno d'attesa e gli spunti sono
 * tessere a piena larghezza — si leggono con una mano, invece di essere tre
 * bottoni in fila da centrare. A conversazione avviata il monogramma torna
 * piccolo, come firma di ogni risposta.
 *
 * **Ogni turno entra in scena.** È la schermata in cui l'app scrive da sola, e un
 * paragrafo che compare di colpo non si distingue da un salto del layout: salendo
 * di 8px mentre si accende dice «questo è nuovo, ed è arrivato adesso» — che è
 * l'unica cosa che si deve capire di un messaggio in una conversazione. Vale anche
 * per il turno dell'utente: il proprio messaggio che sale dal composer è la
 * conferma che è partito.
 */
export default function ChatScreen() {
  const t = useT();
  const { profile } = useClientProfile();
  const router = useRouter();
  const {
    conversationId,
    title,
    turns,
    busy,
    waiting,
    error,
    pending,
    send,
    startNew,
    takePending,
    settleProposal,
  } = useAssistant();
  // Gli spunti arrivano dal backoffice: sono parte della personalità dell'assistente,
  // non una costante dell'app.
  const spunti = useStarters();
  const [typed, setTyped] = useState('');
  /**
   * Il turno di cui si sta confermando la richiesta di contatto, se ce n'è uno,
   * indicato dalla sua ora. Cosa ne è stato di ogni proposta invece sta sul turno
   * (`proposalStato`): la salva il server, e la card resta chiusa riaprendo la chat.
   */
  const [proposing, setProposing] = useState<{ at: string; text: string } | null>(null);
  const scroller = useRef<ScrollView>(null);
  const input = useRef<TextInput>(null);
  /**
   * Se la chat segue il fondo mentre arriva la risposta. Si spegne solo quando il
   * cliente risale: lo `scrollToEnd` animato scorre sempre verso il basso, e un
   * pezzo lungo che lo lascia per un attimo lontano dal fondo non lo spegne.
   */
  const inFondo = useRef(true);
  const ultimo = useRef({ y: 0, altezza: 0, contenuto: 0 });

  const struttura = profile?.struttura.nome ?? t.chat.strutturaSconosciuta;

  /**
   * Nel composer c'è quello che l'utente ha scritto, o — finché non ha scritto
   * niente — la domanda che gli arriva da un'altra schermata (in fondo a un
   * avviso c'è «Chiedi cosa cambia per me»).
   *
   * È stato derivato e non una copia sincronizzata con un effetto: la domanda
   * pronta non è una seconda verità da tenere allineata, è il valore di partenza
   * di questo campo.
   */
  const draft = pending !== '' ? pending : typed;
  const canSend = draft.trim() !== '' && !busy;

  // Un'altra conversazione si legge dall'ultima risposta, ovunque fosse la precedente.
  useLayoutEffect(() => {
    inFondo.current = true;
  }, [conversationId]);

  /**
   * Sul web il campo è un `textarea`, che non cresce da sé con il testo e non
   * riporta mai un'altezza minore di quella che ha: si azzera e si rimisura a ogni
   * cambio, e `maxHeight` fa da tetto. Sul telefono il campo multilinea cresce già.
   */
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = input.current as unknown as HTMLTextAreaElement | null;
    if (!node) return;
    const top = node.scrollTop;
    node.style.height = '0px';
    node.style.height = `${node.scrollHeight}px`;
    node.scrollTop = top;
  }, [draft]);

  function seguiFondo() {
    if (inFondo.current) scroller.current?.scrollToEnd({ animated: true });
  }

  function scrolled({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = nativeEvent.contentOffset.y;
    const altezza = nativeEvent.layoutMeasurement.height;
    const contenuto = nativeEvent.contentSize.height;
    const prima = ultimo.current;
    // Risalire anche di poco spegne il seguito: altrimenti il pezzo che arriva mentre
    // il dito è ancora vicino al fondo lo riporta giù. La posizione però scende anche
    // da sola, quando la lista si allunga (il composer che si svuota) o il contenuto
    // si accorcia: quella non è il cliente che risale.
    const risalito = y < prima.y && altezza <= prima.altezza && contenuto >= prima.contenuto;
    if (risalito) inFondo.current = false;
    else if (contenuto - altezza - y <= SOGLIA_FONDO) inFondo.current = true;
    ultimo.current = { y, altezza, contenuto };
  }

  /** Da tastiera fisica, sul web: Invio invia, Shift+Invio va a capo. */
  function keyPressed(event: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    const { key, shiftKey, isComposing } = event.nativeEvent as unknown as KeyboardEvent;
    if (key !== 'Enter' || shiftKey || isComposing) return;
    event.preventDefault();
    submit(draft);
  }

  /** Il primo tasto premuto rende il testo dell'utente: la proposta ha finito. */
  function edit(next: string) {
    if (pending !== '') takePending();
    setTyped(next);
  }

  /**
   * «No grazie» chiude subito la card: è una risposta che non si aspetta. Se il
   * server non l'ha salvata la card torna, invece di ricomparire a sorpresa
   * riaprendo la conversazione.
   */
  function dismiss(at: string) {
    if (!conversationId) return;
    settleProposal(at, 'scartata');
    dismissProposal({ conversationId, at }).catch(() => settleProposal(at, undefined));
  }

  function submit(text: string) {
    if (busy || text.trim() === '') return;
    if (pending !== '') takePending();
    setTyped('');
    inFondo.current = true;
    void send(text).then((ok) => {
      // Se nel frattempo il cliente ha già scritto altro, quello che ha scritto vince.
      if (!ok) setTyped((now) => (now === '' ? text : now));
    });
  }

  return (
    <Screen>
      <ScreenBar
        left={<MenuButton />}
        right={
          turns.length > 0 ? (
            // Non c'era e ora c'è: senza entrata è un bottone che si materializza
            // nella barra mentre si sta leggendo la risposta sotto.
            <Appear rise={0}>
              <IconButton onPress={startNew} accessibilityLabel={t.chat.nuovaConversazione}>
                <PlusIcon color={Ink.secondary} />
              </IconButton>
            </Appear>
          ) : undefined
        }>
        {/* Dentro una conversazione in cima si legge di cosa si sta parlando; su un
            foglio bianco, con chi si sta parlando e per quale struttura. */}
        <Text variant="rowTitle" numberOfLines={1} style={styles.barTitle}>
          {title || t.chat.titolo}
        </Text>
        <Text variant="tab" color={Ink.muted} numberOfLines={1} style={styles.barSubtitle}>
          {title ? t.chat.messaggi(turns.length) : struttura}
        </Text>
      </ScreenBar>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroller}
          contentContainerStyle={styles.scroll}
          keyboardDismissMode="interactive"
          scrollEventThrottle={16}
          onScroll={scrolled}
          // Anche la tastiera e il composer che cresce accorciano la lista.
          onLayout={seguiFondo}
          onContentSizeChange={seguiFondo}>
          {turns.length === 0 && (
            // Il foglio bianco è la prima cosa che si vede aprendo l'app: il segno
            // e l'incipit arrivano insieme, gli spunti dopo e a scaletta — così si
            // legge prima con chi si sta parlando e poi cosa gli si può chiedere.
            <View style={styles.empty}>
              <Appear>
                <Mark height={56} glow />
                <Text variant="title" style={styles.incipit}>
                  {t.chat.incipit}
                </Text>
                <Text variant="service" color={Ink.muted} style={styles.incipitHelp}>
                  {t.chat.incipitAiuto(struttura)}
                </Text>
              </Appear>

              <View style={styles.spunti}>
                {spunti.map((spunto, index) => (
                  <Appear key={spunto} delay={Duration.enter + stagger(index)}>
                    <Tile onPress={() => submit(spunto)} accessibilityLabel={spunto}>
                      <Text variant="service" color={Ink.body} style={styles.spuntoLabel}>
                        {spunto}
                      </Text>
                    </Tile>
                  </Appear>
                ))}
              </View>
            </View>
          )}

          {turns.map((turn, index) => {
            if (turn.role === 'user') {
              return (
                <Appear key={index}>
                  <Bevel radius={Corner.card - 2} fill={Surface.bubble} style={styles.bubble}>
                    <Text variant="body" color={Ink.primary}>
                      {turn.text}
                    </Text>
                  </Bevel>
                </Appear>
              );
            }

            const streaming = busy && index === turns.length - 1;
            const at = turn.at;

            return (
              <Appear key={index} style={styles.answer}>
                <AssistantSignature name={t.assistente.nome} disclaimer={t.assistente.generatoDaAi} />
                <Markdown text={turn.text} />
                {streaming && <StreamCaret />}
                {turn.sources !== undefined && <Sources sources={turn.sources} />}

                {turn.proposal !== undefined &&
                  at !== undefined &&
                  !streaming &&
                  (turn.proposalStato === 'inviata' ? (
                    <HandoffSent onGoToRequests={() => router.navigate('/richieste')} />
                  ) : turn.proposalStato === 'scartata' ? null : (
                    <HandoffCard
                      proposal={turn.proposal}
                      onReview={() => setProposing({ at, text: turn.proposal ?? '' })}
                      onDismiss={() => dismiss(at)}
                    />
                  ))}
              </Appear>
            );
          })}

          {waiting && (
            <Appear style={styles.answer}>
              <AssistantSignature name={t.assistente.nome} disclaimer={t.assistente.generatoDaAi} />
              <TypingDots />
            </Appear>
          )}

          {error !== null && (
            <View style={styles.failed}>
              <ErrorNote>
                {errorMessage(t, error, t.chat.fallita, {
                  'failed-precondition': t.chat.nonRisponde,
                })}
              </ErrorNote>
              {canSend && (
                <Tap onPress={() => submit(draft)} accessibilityRole="button">
                  <Text variant="service" color={Brand.accent} style={styles.retry}>
                    {t.chat.riprova}
                  </Text>
                </Tap>
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.composerWrap}>
          <GlassPanel style={styles.composer}>
            <TextInput
              ref={input}
              style={styles.input}
              placeholder={t.chat.scrivi}
              placeholderTextColor={Ink.ghost}
              multiline
              maxLength={MAX_MESSAGE_CHARS}
              value={draft}
              onChangeText={edit}
              onKeyPress={Platform.OS === 'web' ? keyPressed : undefined}
            />
            <IconButton
              tone={canSend ? 'accent' : 'ghost'}
              size={38}
              disabled={!canSend}
              accessibilityLabel={t.chat.invia}
              onPress={() => submit(draft)}>
              <SendIcon color={canSend ? Ink.onAccent : Ink.muted} />
            </IconButton>
          </GlassPanel>
          <CharCount length={draft.length} max={MAX_MESSAGE_CHARS} />

          {/* Solo a conversazione vuota: da lì in poi la trasparenza la porta la
              firma «Generata da AI», che sta su ogni singola risposta. */}
          {turns.length === 0 && (
            <Text variant="tab" color={Ink.ghost} style={styles.disclaimer}>
              {t.chat.disclaimer}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>

      <ContactRequestModal
        // La modale riparte dalla proposta di questo turno e non da quella di prima:
        // la `key` la rimonta quando il turno cambia (vedi `ContactRequestModal`).
        key={proposing?.at ?? 'nessuna'}
        visible={proposing !== null}
        draft={proposing?.text}
        onClose={() => setProposing(null)}
        onConfirm={async (messaggio) => {
          if (!proposing) return;
          // La conversazione viaggia con la richiesta: chi la prende in mano dal
          // backoffice deve poter leggere come si è arrivati fin qui.
          try {
            await createContactRequest({
              messaggio,
              ...(conversationId ? { conversationId, turnAt: proposing.at } : {}),
            });
          } catch (cause) {
            // Già partita, da qui o da un altro telefono: non è un errore da mostrare,
            // è la card che era rimasta indietro.
            if ((cause as { code?: string }).code !== 'functions/already-exists') throw cause;
          }
          settleProposal(proposing.at, 'inviata');
          setProposing(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  barTitle: { fontSize: 14, lineHeight: 17 },
  barSubtitle: { fontFamily: Family.sansMedium, fontSize: 11.5, marginTop: 1 },
  scroll: { paddingHorizontal: Gutter, paddingTop: Spacing.sm, paddingBottom: Spacing.lg, gap: Spacing.xl },
  empty: { paddingTop: Spacing.lg },
  incipit: { marginTop: Spacing.xl },
  incipitHelp: { marginTop: Spacing.sm + 2, maxWidth: 280, lineHeight: 21 },
  spunti: { gap: Spacing.sm + 1, marginTop: Spacing.xl + 4 },
  spuntoLabel: { fontSize: 13.5, lineHeight: 19.5 },
  bubble: { alignSelf: 'flex-end', maxWidth: '82%', paddingHorizontal: Spacing.md + 2, paddingVertical: Spacing.md },
  answer: { alignSelf: 'stretch' },
  failed: { gap: Spacing.sm },
  retry: { fontFamily: Family.sansSemibold },
  composerWrap: { paddingHorizontal: Gutter, paddingTop: Spacing.md, paddingBottom: Spacing.sm + 2 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm + 1,
    paddingLeft: Spacing.lg - 1,
    paddingRight: Spacing.sm - 1,
    paddingVertical: Spacing.sm - 1,
  },
  input: {
    flex: 1,
    maxHeight: 140,
    paddingVertical: Spacing.sm + 2,
    fontFamily: Family.sans,
    fontSize: 15,
    lineHeight: 20,
    color: Ink.primary,
  },
  disclaimer: { textAlign: 'center', fontSize: 10.5, lineHeight: 15, marginTop: Spacing.sm + 1 },
});
