import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from './admin';
import type { Source } from './agent';
import { idDoc, requireClient, stringa } from './guards';

/**
 * Un turno di conversazione. Le fonti stanno sul turno e non a parte perché sono
 * parte della risposta: riaprendo la conversazione dalla sidebar il cliente deve
 * ritrovare sotto ogni risposta il materiale Revna su cui poggiava.
 */
export type StoredTurn = {
  role: 'user' | 'model';
  text: string;
  sources?: Source[];
  /**
   * La richiesta di contatto proposta dall'assistente in questo turno, se l'ha
   * proposta. Sta sul turno per lo stesso motivo delle fonti: riaprendo la
   * conversazione il cliente deve ritrovare l'offerta di essere ricontattato dov'era,
   * non solo finché la risposta è a schermo.
   */
  proposal?: string;
  /**
   * Cosa ne ha fatto il cliente. Sta sul documento e non nell'app perché la card
   * deve restare chiusa riaprendo la conversazione, anche da un altro telefono, e
   * una proposta inviata non deve poter partire una seconda volta.
   */
  proposalStato?: ProposalStato;
  /**
   * Quando il turno è stato scritto, in ISO.
   *
   * Facoltativo perché i turni salvati prima che il campo esistesse non lo hanno:
   * chi lo mostra ripiega sulla data della conversazione.
   */
  at?: string;
};

export type ProposalStato = 'inviata' | 'scartata';

export type Conversation = {
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredTurn[];
};

/**
 * Le conversazioni stanno sotto l'utente: `users/{uid}/conversations/{id}`.
 * I messaggi sono un array dentro il documento e non una sottocollezione —
 * una conversazione si legge e si mostra sempre intera. Il limite di 1 MB per
 * documento lo tiene lontano `trimHistory`.
 */
export function conversationsOf(uid: string) {
  return db.collection('users').doc(uid).collection('conversations');
}

/**
 * Il messaggio più lungo che il cliente può mandare: una pagina e mezza, quanto
 * basta per una domanda con incollata una recensione o una mail. Lo stesso valore
 * sta nell'app, sul composer.
 */
export const MAX_MESSAGE_CHARS = 4000;

/** Oltre questa soglia i turni più vecchi cadono, per non far crescere il documento. */
export const MAX_STORED_TURNS = 200;

/**
 * Il peso massimo dei `messages`, in byte. Firestore rifiuta i documenti oltre 1 MB,
 * e una conversazione che non si salva più resta bloccata per sempre: il margine
 * copre titolo, date e la stima, che non è il conteggio esatto di Firestore.
 */
export const MAX_STORED_BYTES = 800_000;

/**
 * Lo storico da salvare: al massimo `MAX_STORED_TURNS` turni e `MAX_STORED_BYTES`,
 * scartando i più vecchi.
 *
 * Non comincia mai con una risposta: senza la sua domanda il modello la rileggerebbe
 * come un'uscita sua fuori contesto.
 */
export function trimHistory(turns: StoredTurn[]): StoredTurn[] {
  const kept = turns.slice(-MAX_STORED_TURNS);
  const sizes = kept.map((turn) => Buffer.byteLength(JSON.stringify(turn), 'utf8'));
  let total = sizes.reduce((sum, size) => sum + size, 0);

  let start = 0;
  while (start < kept.length && (total > MAX_STORED_BYTES || kept[start].role === 'model')) {
    total -= sizes[start];
    start++;
  }

  return kept.slice(start);
}

type DeleteRequest = { conversationId: string };

/**
 * Cancella una conversazione.
 *
 * Le regole Firestore permetterebbero al cliente di farlo da solo, ma passare
 * di qui tiene un unico punto in cui la cancellazione è tracciabile.
 *
 * Non tocca la memoria dell'assistente (vedi `memory.ts`), ed è voluto: un fatto
 * imparato in questa conversazione resta vero anche quando la chat non c'è più, e
 * dimenticare cinque mesi di dati perché si è cancellata una chat sarebbe una
 * sorpresa. Per lo stesso motivo i fatti si portano dietro una **copia** del titolo
 * della conversazione, non un rimando: il riferimento sopravvive alla cancellazione.
 * La memoria si cancella da dov'è, cioè dalle impostazioni dell'app.
 */
export const deleteConversation = onCall<DeleteRequest, Promise<{ ok: true }>>(
  { region: 'europe-west1' },
  async (request) => {
    const uid = await requireClient(request);
    const conversationId = idDoc(request.data, 'conversationId');

    await conversationsOf(uid).doc(conversationId).delete();
    return { ok: true };
  }
);

/**
 * I turni con l'esito della proposta segnato sul turno scritto in `at`.
 *
 * Il turno si riconosce dall'ora e non dalla posizione: l'app può avere a schermo una
 * lista diversa da quella salvata — un turno salvato mentre la connessione cadeva, i
 * più vecchi tolti da `trimHistory` — e un indice sbagliato segnerebbe la proposta di
 * un altro turno. Ogni turno con una proposta ha la sua ora.
 *
 * `assente` se il turno non c'è più o non proponeva niente, `inviata` se la richiesta
 * è già partita: quella non torna indietro. Una proposta scartata invece si può
 * ancora inviare — il cliente ci ha ripensato, magari da un altro telefono.
 */
export function settleProposal(
  messages: StoredTurn[],
  at: string,
  stato: ProposalStato,
): { messages: StoredTurn[] } | { error: 'assente' | 'inviata' } {
  const index = messages.findIndex(
    (turn) => turn.role === 'model' && turn.at === at && turn.proposal !== undefined,
  );
  if (index === -1) return { error: 'assente' };
  if (messages[index].proposalStato === 'inviata') return { error: 'inviata' };

  return {
    messages: messages.map((turn, i) => (i === index ? { ...turn, proposalStato: stato } : turn)),
  };
}

type DismissRequest = { conversationId: string; at: string };

/**
 * «No grazie» sulla proposta di contatto di un turno.
 *
 * Una function e non una scrittura del client: le regole non sanno dire «solo questo
 * campo di questo elemento dell'array», e aprire `messages` in scrittura vorrebbe dire
 * lasciar riscrivere al cliente anche le risposte dell'assistente.
 *
 * Una proposta già inviata resta inviata: lo scarto arrivato dopo non la cancella.
 */
export const dismissProposal = onCall<DismissRequest, Promise<{ ok: true }>>(
  { region: 'europe-west1' },
  async (request) => {
    const uid = await requireClient(request);
    const conversationId = idDoc(request.data, 'conversationId');
    const at = stringa(request.data, 'at');
    if (!at) {
      throw new HttpsError('invalid-argument', 'Indica il turno della proposta.');
    }

    const ref = conversationsOf(uid).doc(conversationId);
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const messages = (snapshot.data()?.['messages'] as StoredTurn[] | undefined) ?? [];
      const settled = settleProposal(messages, at, 'scartata');

      if ('error' in settled) {
        if (settled.error === 'assente') {
          throw new HttpsError('not-found', 'Proposta inesistente.');
        }
        return;
      }
      tx.update(ref, { messages: settled.messages });
    });

    return { ok: true };
  }
);
