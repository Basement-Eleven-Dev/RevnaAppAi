import { httpsCallable } from 'firebase/functions';
import { createContext, useCallback, useContext, useState } from 'react';

import type { ConversationSummary, Source, StoredTurn } from '@/hooks/use-conversations';
import { useT } from '@/hooks/use-language';
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
 * Sta sopra le schermate e non dentro la chat perché la sidebar è ormai la
 * navigazione dell'app: da qualsiasi schermata si può aprire una conversazione
 * dall'elenco, e chi la apre deve poter scrivere nello stesso stato che la chat
 * legge. Come effetto secondario la conversazione sopravvive al giro in
 * Documenti o Profilo, che con lo stato dentro la schermata non era garantito.
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
  const t = useT();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  /** true tra l'invio e il primo pezzo di risposta. */
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState('');

  const send = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (!text || busy) return;

      const history = turns;
      setTurns([...history, { role: 'user', text }]);
      setBusy(true);
      setWaiting(true);
      setError('');

      const ask = httpsCallable<Request, Response, Chunk>(
        getFirebaseFunctions(),
        'askAssistant'
      );
      const payload: Request = { message: text, conversationId };
      // Durante lo streaming le fonti non ci sono ancora: arrivano con la risposta
      // finale, insieme al testo con i marcatori rinumerati. La proposta di contatto
      // nemmeno: mentre il modello scrive il suo marcatore viene tagliato via
      // (`stripHandoff`), e la proposta compare come bottone solo alla fine.
      const show = (answer: string, sources?: Source[], proposal?: string) =>
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

      try {
        let streamed = 0;

        if (supportsStreaming()) {
          try {
            const { stream, data } = await ask.stream(payload);

            let answer = '';
            for await (const chunk of stream) {
              if (!chunk.text) continue;
              answer += chunk.text;
              streamed++;
              setWaiting(false);
              show(stripHandoff(answer));
            }

            // `data` porta il testo completo e l'id: è la fonte autorevole se lo
            // stream si è interrotto o non ha prodotto nulla.
            const final = await data;
            show(final.text, final.sources, final.proposal);
            setConversationId(final.conversationId);
            return;
          } catch (cause) {
            // Se qualcosa era già arrivato l'errore è reale e va mostrato.
            // Se invece è saltato subito, può essere il trasporto in streaming:
            // ritentiamo con la chiamata normale prima di dare buca all'utente.
            if (streamed > 0) throw cause;
          }
        }

        const { data } = await ask(payload);
        show(data.text, data.sources, data.proposal);
        setConversationId(data.conversationId);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t.chat.fallita);
        // La domanda resta a schermo: l'utente può ritentare senza riscriverla.
        setTurns([...history, { role: 'user', text }]);
      } finally {
        setBusy(false);
        setWaiting(false);
      }
    },
    [busy, conversationId, t, turns]
  );

  /** Apre una conversazione dall'elenco laterale. */
  const open = useCallback((conversation: ConversationSummary) => {
    setConversationId(conversation.id);
    setTurns(conversation.messages);
    setError('');
  }, []);

  /** Foglio bianco: la conversazione nasce sul server al primo messaggio. */
  const startNew = useCallback(() => {
    setConversationId(undefined);
    setTurns([]);
    setError('');
  }, []);

  return { conversationId, turns, busy, waiting, error, send, open, startNew };
}
