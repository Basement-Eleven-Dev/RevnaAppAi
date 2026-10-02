import { logger } from 'firebase-functions';
import { defineString } from 'firebase-functions/params';
import { HttpsError } from 'firebase-functions/v2/https';

import {
  buildSystemInstruction,
  extractContactProposal,
  loadAgent,
  resolveCitations,
  selectKnowledge,
  type KnowledgeEntry,
  type Source,
  visibleSoFar,
} from './agent';
import type { StoredTurn } from './conversations';
import type { MemoryEntry, ToolCall, ToolDeclaration } from './memory';
import { describeProfile, type ClientProfile } from './profile';

/**
 * Il motore dell'assistente: da profilo + storico + domanda a risposta con fonti.
 *
 * Sta in un modulo a parte perché lo usano in due: `askAssistant`, che risponde al
 * cliente e salva la conversazione, e `previewAssistant`, con cui un referente Revna
 * prova l'assistente dal backoffice fingendosi un albergatore.
 *
 * Il codice è **lo stesso** di proposito. Se la prova avesse un suo percorso — un
 * prompt costruito diversamente, un'altra selezione della conoscenza — proverebbe un
 * assistente che non esiste, e sarebbe peggio di non averla.
 *
 * Gemini via Vertex AI, non via chiave dell'API pubblica: la function gira già dentro
 * il progetto Google con un suo service account, quindi l'autenticazione avviene da
 * sola (Application Default Credentials), senza nessuna chiave da custodire, ruotare o
 * esporre. La chiave dell'AI Studio non era comunque utilizzabile qui: per le API
 * Gemini deve essere legata a un service account, e una policy dell'organizzazione lo
 * impedisce.
 */
const geminiModel = defineString('GEMINI_MODEL', { default: 'gemini-3.1-flash-lite' });
const geminiLocation = defineString('GEMINI_LOCATION', { default: 'global' });

/** Quanti turni precedenti rimandare al modello a ogni richiesta. */
const MAX_HISTORY_TURNS = 20;

/** Il client di @google/genai, tipizzato senza importarlo a runtime (è ESM). */
type GenAI = InstanceType<
  typeof import('@google/genai', { with: { 'resolution-mode': 'import' } }).GoogleGenAI
>;

type ThinkingLevel = import('@google/genai', {
  with: { 'resolution-mode': 'import' },
}).ThinkingLevel;

let cached: Promise<GenAI> | undefined;

/**
 * Il client, creato una volta per istanza.
 *
 * @google/genai è solo ESM e queste function girano in CommonJS: l'import dinamico è
 * il modo più semplice per usarlo senza convertire il codebase.
 */
function client(): Promise<GenAI> {
  cached ??= import('@google/genai').then(
    ({ GoogleGenAI }) =>
      new GoogleGenAI({
        vertexai: true,
        project: process.env['GCLOUD_PROJECT'] ?? process.env['GOOGLE_CLOUD_PROJECT'],
        location: geminiLocation.value(),
      }),
  );
  return cached;
}

type CompleteOptions = { temperature?: number; maxOutputTokens?: number };

/**
 * Una domanda secca al modello, senza streaming: la selezione e il titolo.
 *
 * Il ragionamento al minimo e un tetto largo per lo stesso motivo: i token del
 * ragionamento contano nel tetto della risposta, e con un tetto stretto il modello
 * può spenderli tutti a pensare e restituire un testo vuoto.
 */
export async function complete(
  prompt: string,
  { temperature = 0, maxOutputTokens = 256 }: CompleteOptions = {},
): Promise<string> {
  const ai = await client();
  const response = await ai.models.generateContent({
    model: geminiModel.value(),
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      temperature,
      maxOutputTokens,
      thinkingConfig: { thinkingLevel: 'MINIMAL' as ThinkingLevel },
    },
  });

  const text = response.text?.trim() ?? '';
  if (!text) {
    logger.warn('Risposta breve vuota dal modello', {
      finishReason: response.candidates?.[0]?.finishReason,
    });
  }
  return text;
}

/**
 * Una decisione del modello espressa come chiamate a strumenti, senza testo.
 *
 * È il meccanismo con cui l'assistente tiene la sua memoria (vedi `memory.ts`):
 * invece di far scrivere al modello un JSON dentro una risposta e poi sperare di
 * saperlo leggere, gli si dichiarano gli strumenti e si eseguono le chiamate che
 * decide di fare. La differenza pratica è che gli argomenti arrivano già tipizzati
 * e che «non fare niente» è una risposta valida — nessuna chiamata — invece di una
 * frase da interpretare.
 *
 * Nessuna risposta allo strumento torna al modello: qui gli strumenti sono azioni
 * che non hanno un esito da riferire, e un secondo giro raddoppierebbe il tempo per
 * far dire al modello "ok".
 */
export async function decide(
  prompt: string,
  tools: ToolDeclaration[],
  { temperature = 0 }: { temperature?: number } = {},
): Promise<ToolCall[]> {
  const ai = await client();

  const response = await ai.models.generateContent({
    model: geminiModel.value(),
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      temperature,
      tools: [
        {
          functionDeclarations: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parametersJsonSchema: tool.parameters,
          })),
        },
      ],
    },
  });

  return (response.functionCalls ?? [])
    .filter((call) => typeof call.name === 'string')
    .map((call) => ({ name: call.name as string, args: call.args ?? {} }));
}

export type Answer = {
  text: string;
  sources: Source[];
  /**
   * La richiesta di contatto che l'assistente propone, quando ha capito di non
   * potercela fare da solo. Il testo è già pronto da mostrare al cliente, che lo
   * modifica e conferma prima che diventi una richiesta vera (vedi `requests.ts`).
   */
  proposal?: string;
  /** Le voci messe in contesto: non tutte finiscono citate. */
  selected: KnowledgeEntry[];
  /** Quante voci attive c'erano in tutto, prima della selezione. */
  disponibili: number;
  /** Il prompt di sistema effettivamente inviato. Serve alla prova dal backoffice. */
  systemInstruction: string;
};

/**
 * Genera una risposta.
 *
 * `onChunk` riceve i pezzi mentre il modello scrive; se non c'è, la risposta arriva
 * comunque intera alla fine — un solo percorso di codice per entrambi i casi.
 */
export async function respond({
  uid,
  profile,
  history,
  message,
  memory = [],
  onChunk,
}: {
  /** Il cliente che parla, o quello impersonato dalla prova: serve solo ai log. */
  uid: string;
  profile: ClientProfile;
  history: StoredTurn[];
  message: string;
  /**
   * I fatti che l'assistente ha imparato su questo cliente. Anche la prova dal
   * backoffice la passa, in sola lettura: senza, un referente vedrebbe un tono che il
   * cliente non riceve, e correggerebbe un problema che non esiste.
   */
  memory?: MemoryEntry[];
  /** `Promise<unknown>` e non `void`: `sendChunk` restituisce un booleano che non ci serve. */
  onChunk?: (text: string) => Promise<unknown>;
}): Promise<Answer> {
  const agent = await loadAgent();
  const ai = await client();

  // Quali voci della base di conoscenza mettere in contesto. Finché la conoscenza
  // ci sta tutta questo non costa nulla; quando crescerà, sceglierà.
  const selected = await selectKnowledge(message, agent.knowledge, (prompt) => complete(prompt));

  const systemInstruction = buildSystemInstruction(
    agent.config,
    describeProfile(profile),
    selected,
    memory,
  );

  const contents = [
    ...history
      .slice(-MAX_HISTORY_TURNS)
      .filter((turn) => turn.text?.trim())
      .map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const stream = await ai.models
    .generateContentStream({
      model: geminiModel.value(),
      contents,
      config: { systemInstruction, temperature: agent.config.temperature },
    })
    .catch((cause: unknown) => {
      // L'errore grezzo di Vertex non va mostrato a chi ha scritto, ma serve nei log:
      // è lì che si vede se manca l'API, il ruolo o il modello.
      logger.error('Chiamata al modello fallita', { cause });
      throw new HttpsError('internal', "L'assistente non è al momento raggiungibile.");
    });

  // Ai pezzi arriva solo il testo prima del marcatore di contatto: la proposta
  // diventa un bottone a risposta finita, e il marcatore non si vede mai.
  let full = '';
  let shown = 0;
  // Perché il modello ha smesso di scrivere, e se ha rifiutato la domanda prima di
  // cominciare: arrivano sull'ultimo pezzo, quando arrivano.
  let finishReason: string | undefined;
  let blockReason: string | undefined;
  try {
    for await (const piece of stream) {
      finishReason = piece.candidates?.[0]?.finishReason ?? finishReason;
      blockReason = piece.promptFeedback?.blockReason ?? blockReason;
      const chunk = piece.text;
      if (!chunk) continue;
      full += chunk;
      const visible = visibleSoFar(full);
      if (visible.length > shown) {
        await onChunk?.(visible.slice(shown));
        shown = visible.length;
      }
    }
  } catch (cause) {
    logger.error('Risposta del modello interrotta', {
      uid,
      model: geminiModel.value(),
      ricevuti: full.length,
      cause,
    });
    throw new HttpsError('internal', "La risposta dell'assistente si è interrotta.");
  }

  if (blockReason || (finishReason && finishReason !== 'STOP')) {
    logger.warn('Risposta del modello incompleta', {
      uid,
      model: geminiModel.value(),
      finishReason,
      blockReason,
      ricevuti: full.length,
    });
  }

  // Prima la proposta di contatto, poi le citazioni: il marcatore va tolto dal testo
  // prima di rinumerare, altrimenti le citazioni che stanno dentro la proposta
  // finirebbero nell'elenco delle fonti di una risposta in cui non compaiono.
  const { text: spoken, proposal } = extractContactProposal(full);

  if (!spoken && !proposal) {
    // Fermato dai filtri (sicurezza, contenuti vietati, lingua…) e non da un guasto:
    // il cliente deve sapere che riformulare serve, e riprovare uguale no. Con
    // MAX_TOKENS il tetto se l'è mangiato il ragionamento, e la domanda non c'entra.
    if (blockReason || (finishReason && !['STOP', 'MAX_TOKENS'].includes(finishReason))) {
      throw new HttpsError(
        'failed-precondition',
        "L'assistente non può rispondere a questa domanda.",
      );
    }
    logger.error('Risposta vuota dal modello', { uid, finishReason });
    throw new HttpsError('internal', 'Il modello non ha prodotto una risposta.');
  }
  const { text, sources } = resolveCitations(spoken, selected);

  return {
    text,
    sources,
    ...(proposal ? { proposal } : {}),
    selected,
    disponibili: agent.knowledge.length,
    systemInstruction,
  };
}
