import { httpsCallable } from 'firebase/functions';
import { useCallback, useState } from 'react';

import type { ConversationSummary, StoredTurn } from '@/hooks/use-conversations';
import { getFirebaseFunctions, supportsStreaming } from '@/lib/firebase';

export type Turn = StoredTurn;

type Request = { message: string; conversationId?: string };
type Response = { text: string; conversationId: string; title: string };
type Chunk = { text: string };

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
export function useAssistant() {
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
      const show = (answer: string) =>
        setTurns([...history, { role: 'user', text }, { role: 'model', text: answer }]);

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
              show(answer);
            }

            // `data` porta il testo completo e l'id: è la fonte autorevole se lo
            // stream si è interrotto o non ha prodotto nulla.
            const final = await data;
            show(final.text);
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
        show(data.text);
        setConversationId(data.conversationId);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Risposta non riuscita.');
        // La domanda resta a schermo: l'utente può ritentare senza riscriverla.
        setTurns([...history, { role: 'user', text }]);
      } finally {
        setBusy(false);
        setWaiting(false);
      }
    },
    [busy, conversationId, turns]
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
