import { httpsCallable } from 'firebase/functions';
import { createContext, useCallback, useContext, useRef, useState } from 'react';

import type { ConversationSummary, Source, StoredTurn } from '@/hooks/use-conversations';
import { stripHandoff } from '@/lib/contact-requests';
import { getFirebaseFunctions, supportsStreaming } from '@/lib/firebase';

export type Turn = StoredTurn;

type Request = { message: string; conversationId?: string };
type Response = {
  text: string;
  conversationId: string;
  title: string;
  sources: Source[];
  /** Il testo della richiesta di contatto proposta, quando l'assistente passa la mano. */
  proposal?: string;
};
type Chunk = { text: string };

type AssistantState = ReturnType<typeof useAssistantState>;

const AssistantContext = createContext<AssistantState | null>(null);

/**
 * La conversazione in corso, condivisa da tutta l'area riservata.
 *
 * Sta sopra le schermate e non dentro la chat perché una conversazione si apre
 * dal pannello laterale, cioè da qualsiasi schermata: chi la apre deve poter
 * scrivere nello stesso stato che la chat legge. Come effetto secondario la
 * conversazione sopravvive al giro in Documenti o Profilo, che con lo stato
 * dentro la schermata non era garantito.
 */
export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const state = useAssistantState();

  return <AssistantContext.Provider value={state}>{children}</AssistantContext.Provider>;
}

export function useAssistant(): AssistantState {
  const state = useContext(AssistantContext);

  if (!state) {
    throw new Error("useAssistant richiede <AssistantProvider> (vedi src/app/(app)/_layout.tsx).");
  }

  return state;
}

/**
 * Conversazione con l'assistente.
 *
 * Lo storico lo tiene il server: qui viaggia solo il messaggio nuovo e l'id della
 * conversazione. I turni nello stato servono a disegnare la schermata, non a
 * ricostruire il contesto — così ricaricando l'app non si perde nulla e il client
 * non può riscrivere quello che è già stato detto.
 *
 * La risposta arriva a pezzi mentre il modello la scrive: l'ultimo turno viene
 * riscritto a ogni chunk.
 */
function useAssistantState() {
  const [conversationId, setConversationId] = useState<string | undefined>();
  /**
   * Il titolo che il modello ha dato alla conversazione. Serve alla barra della
   * chat: aperta una conversazione dallo storico, in cima si legge di cosa si sta
   * parlando — «Assistente Revna» lo direbbe di qualunque schermata.
   */
  const [title, setTitle] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  /** true tra l'invio e il primo pezzo di risposta. */
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  /** Una domanda pronta da scrivere nel composer, in arrivo da un'altra schermata. */
  const [pending, setPending] = useState('');

  /**
   * Il numero dell'invio di cui la schermata aspetta la risposta.
   *
   * Aprire un'altra conversazione, iniziarne una nuova o cancellare quella in corso
   * non ferma la richiesta: il server finisce di rispondere e salva il turno nella
   * conversazione giusta. Qui lo si scarta soltanto, perché la schermata nel
   * frattempo mostra un'altra chat. Bloccare la navigazione finché il modello
   * scrive avrebbe tenuto il cliente fermo ad aspettare una risposta che non legge.
   */
  const generation = useRef(0);

  /**
   * Manda un messaggio e risolve `false` solo se la risposta non è arrivata ed è
   * ancora quella che la schermata aspetta: è il segnale per rimettere il testo nel
   * composer.
   */
  const send = useCallback(
    async (message: string): Promise<boolean> => {
      const text = message.trim();
      if (!text || busy) return true;

      const mine = ++generation.current;
      const current = () => generation.current === mine;

      const history = turns;
      setTurns([...history, { role: 'user', text }]);
      setBusy(true);
      setWaiting(true);
      setError(null);

      const ask = httpsCallable<Request, Response, Chunk>(
        getFirebaseFunctions(),
        'askAssistant'
      );
      const payload: Request = { message: text, conversationId };
      // Durante lo streaming le fonti non ci sono ancora: arrivano con la risposta
      // finale, insieme al testo con i marcatori rinumerati. La proposta di contatto
      // nemmeno: mentre il modello scrive il suo marcatore viene tagliato via
      // (`stripHandoff`), e la proposta compare come bottone solo alla fine.
      const show = (answer: string, sources?: Source[], proposal?: string) => {
        if (!current()) return;
        setTurns([
          ...history,
          { role: 'user', text },
          {
            role: 'model',
            text: answer,
            ...(sources?.length ? { sources } : {}),
            ...(proposal ? { proposal } : {}),
          },
        ]);
      };

      try {
        // Il ripiego sulla chiamata unica vale solo quando lo streaming manca in
        // partenza. Uno streaming fallito non si ritenta: l'SDK dà lo stesso
        // `internal` a un errore del server e a una connessione caduta, e in quel
        // caso la domanda può essere già arrivata — rifarla salverebbe due volte
        // lo stesso turno.
        let final: Response;
        if (supportsStreaming()) {
          const { stream, data } = await ask.stream(payload);
          // Se lo stream salta, lo stesso errore arriva anche qui: senza un
          // gestore resterebbe una promessa respinta che nessuno ascolta.
          data.catch(() => undefined);

          let answer = '';
          for await (const chunk of stream) {
            if (!chunk.text || !current()) continue;
            answer += chunk.text;
            setWaiting(false);
            show(stripHandoff(answer));
          }

          // `data` porta il testo completo e l'id: è la fonte autorevole se lo
          // stream si è interrotto o non ha prodotto nulla.
          final = await data;
        } else {
          final = (await ask(payload)).data;
        }

        if (!current()) return true;
        show(final.text, final.sources, final.proposal);
        setConversationId(final.conversationId);
        if (final.title) setTitle(final.title);
        return true;
      } catch (cause) {
        if (!current()) return true;
        setError(cause);
        // Il turno non è stato salvato: la domanda torna nel composer (vedi la
        // chat), da dove si può correggere o rimandare.
        setTurns(history);
        return false;
      } finally {
        if (current()) {
          setBusy(false);
          setWaiting(false);
        }
      }
    },
    [busy, conversationId, turns]
  );

  /** Lascia andare la risposta in arrivo, se ce n'è una: la schermata cambia chat. */
  const leave = useCallback(() => {
    generation.current++;
    setBusy(false);
    setWaiting(false);
    setError(null);
  }, []);

  /** Apre una conversazione dall'elenco laterale. */
  const open = useCallback(
    (conversation: ConversationSummary) => {
      leave();
      setConversationId(conversation.id);
      setTitle(conversation.title);
      setTurns(conversation.messages);
    },
    [leave]
  );

  /** Foglio bianco: la conversazione nasce sul server al primo messaggio. */
  const startNew = useCallback(() => {
    leave();
    setConversationId(undefined);
    setTitle('');
    setTurns([]);
  }, [leave]);

  /**
   * Apre una conversazione nuova con una domanda già scritta nel composer, senza
   * inviarla.
   *
   * Serve a chi arriva da fuori la chat — in fondo a un avviso c'è «Chiedi cosa
   * cambia per me», e da lì la domanda deve poter essere corretta prima di
   * partire: è il cliente a chiedere, non l'app a chiedere per lui.
   */
  const prefill = useCallback(
    (text: string) => {
      startNew();
      setPending(text);
    },
    [startNew]
  );

  /** Il composer si prende la domanda pronta una volta sola (vedi la chat). */
  const takePending = useCallback(() => {
    setPending('');
  }, []);

  return {
    conversationId,
    title,
    turns,
    busy,
    waiting,
    error,
    pending,
    send,
    open,
    startNew,
    prefill,
    takePending,
  };
}
