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
} from './agent';
import type { StoredTurn } from './conversations';
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

/** Una domanda secca al modello, senza streaming: la selezione e il titolo. */
export async function complete(
  prompt: string,
  { temperature = 0, maxOutputTokens = 64 }: CompleteOptions = {},
): Promise<string> {
  const ai = await client();
  const response = await ai.models.generateContent({
    model: geminiModel.value(),
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { temperature, maxOutputTokens },
  });
  return response.text?.trim() ?? '';
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
  profile,
  history,
  message,
  onChunk,
}: {
  profile: ClientProfile;
  history: StoredTurn[];
  message: string;
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

  let full = '';
  for await (const piece of stream) {
    const chunk = piece.text;
    if (!chunk) continue;
    full += chunk;
    await onChunk?.(chunk);
  }

  if (!full.trim()) {
    logger.error('Risposta vuota dal modello');
    throw new HttpsError('internal', 'Il modello non ha prodotto una risposta.');
  }

  // Prima la proposta di contatto, poi le citazioni: il marcatore va tolto dal testo
  // prima di rinumerare, altrimenti le citazioni che stanno dentro la proposta
  // finirebbero nell'elenco delle fonti di una risposta in cui non compaiono.
  const { text: spoken, proposal } = extractContactProposal(full);
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
