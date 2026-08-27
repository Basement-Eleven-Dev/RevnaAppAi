import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
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
  Text,
  Tile,
  TypingDots,
} from '@/components/ui';
import { useAssistant } from '@/hooks/use-assistant';
import { useClientProfile } from '@/hooks/use-client-profile';
import { createContactRequest } from '@/hooks/use-contact-requests';
import { useT } from '@/hooks/use-language';
import { useStarters } from '@/hooks/use-starters';
import { Corner, Duration, Family, Gutter, Ink, Spacing, Surface } from '@/theme';

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
  const { conversationId, title, turns, busy, waiting, error, pending, send, startNew, takePending } =
    useAssistant();
  // Gli spunti arrivano dal backoffice: sono parte della personalità dell'assistente,
  // non una costante dell'app.
  const spunti = useStarters();
  const [typed, setTyped] = useState('');
  /** Il turno di cui si sta confermando la richiesta di contatto, se ce n'è uno. */
  const [proposing, setProposing] = useState<{ key: string; text: string } | null>(null);
  /**
   * I turni da cui una richiesta è già partita, o che sono stati messi da parte con
   * «No grazie». Vive quanto la schermata: a richiesta inviata la traccia sta nella
   * sezione «Richieste», che è il posto dove ha senso cercarla.
   */
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const scroller = useRef<ScrollView>(null);

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

  /** Il primo tasto premuto rende il testo dell'utente: la proposta ha finito. */
  function edit(next: string) {
    if (pending !== '') takePending();
    setTyped(next);
  }

  function submit(text: string) {
    if (busy || text.trim() === '') return;
    if (pending !== '') takePending();
    setTyped('');
    void send(text);
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
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}>
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
            const key = proposalKey(conversationId, index);

            return (
              <Appear key={index} style={styles.answer}>
                <AssistantSignature name={t.assistente.nome} disclaimer={t.assistente.generatoDaAi} />
                <Markdown text={turn.text} />
                {streaming && <StreamCaret />}
                {turn.sources !== undefined && <Sources sources={turn.sources} />}

                {turn.proposal !== undefined &&
                  !streaming &&
                  (sent[key] === true ? (
                    <HandoffSent onGoToRequests={() => router.navigate('/richieste')} />
                  ) : dismissed[key] === true ? null : (
                    <HandoffCard
                      proposal={turn.proposal}
                      onReview={() => setProposing({ key, text: turn.proposal ?? '' })}
                      onDismiss={() => setDismissed((already) => ({ ...already, [key]: true }))}
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

          {error !== '' && <ErrorNote>{error}</ErrorNote>}
        </ScrollView>

        <View style={styles.composerWrap}>
          <GlassPanel style={styles.composer}>
            <TextInput
              style={styles.input}
              placeholder={t.chat.scrivi}
              placeholderTextColor={Ink.ghost}
              multiline
              value={draft}
              onChangeText={edit}
              editable={!busy}
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
    </Screen>
  );
}

/**
 * La chiave con cui ricordare cosa è già stato fatto con la proposta di un turno.
 * Porta dentro la conversazione: cambiando chat gli indici ripartono, e senza
 * l'id il turno 3 di una sarebbe il turno 3 dell'altra.
 */
function proposalKey(conversationId: string | undefined, index: number): string {
  return `${conversationId ?? 'nuova'}:${index}`;
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
