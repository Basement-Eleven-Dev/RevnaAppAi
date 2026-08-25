import { logger } from 'firebase-functions';
import { defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from './admin';
import { conversationsOf, MAX_STORED_TURNS, type StoredTurn } from './conversations';
import { describeProfile, sanitizeProfile } from './profile';

/**
 * Gemini via Vertex AI, non via chiave dell'API pubblica.
 *
 * La function gira già dentro il progetto Google con un suo service account:
 * l'autenticazione avviene da sola (Application Default Credentials), senza
 * nessuna chiave da custodire, ruotare o esporre. La chiave dell'AI Studio non
 * era comunque utilizzabile qui: per le API Gemini deve essere legata a un
 * service account, e una policy dell'organizzazione lo impedisce.
 */
const geminiModel = defineString('GEMINI_MODEL', { default: 'gemini-3.1-flash-lite' });
const geminiLocation = defineString('GEMINI_LOCATION', { default: 'global' });

/** Quanti turni precedenti rimandare al modello a ogni richiesta. */
const MAX_HISTORY_TURNS = 20;

const PERSONA = `
Sei l'assistente Revna: un consulente esperto di revenue management e di gestione
delle strutture ricettive, che parla per conto di Revna ai suoi clienti.

Come ragioni
- Parti sempre dai dati della struttura di chi ti scrive, riportati qui sotto.
  Le risposte generiche non servono: cita numeri, tipologie di camere, canali e
  stagionalità di QUESTA struttura quando sono pertinenti.
- Se per rispondere bene ti manca un dato operativo (occupazione media, ADR, RevPAR,
  mix di canali, tariffe, finestra di prenotazione), chiedilo — una domanda alla volta,
  non un questionario — e spiega in una riga perché ti serve.
- Ragiona per leve concrete: tariffe, restrizioni, mix di canale, durata del soggiorno,
  finestra di prenotazione, segmentazione, upselling. Evita la teoria fine a sé stessa.

Come rispondi
- Tono professionale e diretto, in italiano, come un consulente che conosce il cliente.
  Niente entusiasmo di maniera, niente elenchi puntati infiniti.
- Rispondi in modo asciutto: prima la risposta, poi il perché. Se proponi azioni,
  mettile in ordine di impatto.
- Se il cliente scrive in un'altra lingua, rispondi nella sua.

Il tuo perimetro
- Ospitalità, revenue management, distribuzione, marketing alberghiero e gestione
  delle strutture ricettive.
- Su temi fuori perimetro, e su questioni legali, fiscali o giuslavoristiche vincolanti,
  non improvvisare: dillo chiaramente, indica il tema pertinente più vicino di cui puoi
  occuparti, e proponi di far ricontattare il cliente da un consulente Revna.
- Non inventare dati sulla struttura che non trovi nel profilo, e non citare fonti che
  non ti sono state fornite.
`.trim();

/** Il client di @google/genai, tipizzato senza importarlo a runtime (è ESM). */
type GenAI = InstanceType<
  typeof import('@google/genai', { with: { 'resolution-mode': 'import' } }).GoogleGenAI
>;

type Request = { message: string; conversationId?: string };
type Response = { text: string; conversationId: string; title: string };
/** Pezzo di risposta inviato man mano che il modello la produce. */
type Chunk = { text: string };

/**
 * Proxy verso il modello: l'app non parla mai direttamente con Gemini, così la
 * chiave resta lato server e ogni richiesta passa dal controllo di accesso.
 *
 * Il profilo della struttura e lo storico della conversazione vengono letti qui e
 * non arrivano dal client: è il cliente a fare la domanda, ma è il server a decidere
 * di chi sta parlando e cosa è già stato detto.
 *
 * La risposta viene inviata a pezzi mentre il modello la scrive. `sendChunk` non fa
 * nulla se il client non ha chiesto lo streaming, quindi il testo completo viene
 * comunque restituito alla fine: un solo percorso di codice per entrambi i casi.
 */
export const askAssistant = onCall<Request, Promise<Response>, Chunk>(
  { region: 'europe-west1', timeoutSeconds: 120 },
  async (request, streamed) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Accesso riservato ai clienti Revna.');
    }

    const message = request.data.message?.trim();
    if (!message) {
      throw new HttpsError('invalid-argument', 'Messaggio vuoto.');
    }

    const snapshot = await db.collection('users').doc(uid).get();
    const profile = sanitizeProfile(snapshot.data()?.['profile']);

    // Conversazione esistente o nuova. Lo storico viene dal documento, non dal
    // client: così non è manipolabile e sopravvive al riavvio dell'app.
    const conversationRef = request.data.conversationId
      ? conversationsOf(uid).doc(request.data.conversationId)
      : conversationsOf(uid).doc();
    const conversation = await conversationRef.get();
    const stored: StoredTurn[] = (conversation.data()?.['messages'] as StoredTurn[]) ?? [];

    const systemInstruction = [
      PERSONA,
      '',
      '--- Profilo della struttura di chi ti scrive ---',
      describeProfile(profile),
    ].join('\n');

    const history = stored
      .slice(-MAX_HISTORY_TURNS)
      .filter((turn) => turn.text?.trim())
      .map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] }));

    // @google/genai è solo ESM e queste function girano in CommonJS:
    // l'import dinamico è il modo più semplice per usarlo senza convertire il codebase.
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      vertexai: true,
      project: process.env['GCLOUD_PROJECT'] ?? process.env['GOOGLE_CLOUD_PROJECT'],
      location: geminiLocation.value(),
    });

    const stream = await ai.models
      .generateContentStream({
        model: geminiModel.value(),
        contents: [...history, { role: 'user', parts: [{ text: message }] }],
        config: { systemInstruction, temperature: 0.6 },
      })
      .catch((cause: unknown) => {
        // L'errore grezzo di Vertex non va mostrato al cliente, ma serve nei log:
        // è lì che si vede se manca l'API, il ruolo o il modello.
        logger.error('Chiamata al modello fallita', { uid, cause });
        throw new HttpsError('internal', "L'assistente non è al momento raggiungibile.");
      });

    let full = '';
    for await (const piece of stream) {
      const chunk = piece.text;
      if (!chunk) continue;
      full += chunk;
      await streamed?.sendChunk({ text: chunk });
    }

    const text = full.trim();
    if (!text) {
      logger.error('Risposta vuota dal modello', { uid });
      throw new HttpsError('internal', 'Il modello non ha prodotto una risposta.');
    }

    // Il titolo si genera solo alla prima risposta: serve a distinguere la
    // conversazione nell'elenco, non a riassumerla via via che cresce.
    const existingTitle = conversation.data()?.['title'] as string | undefined;
    const title = existingTitle ?? (await summarize(ai, message));

    const now = new Date().toISOString();
    const messages = [...stored, { role: 'user', text: message }, { role: 'model', text }].slice(
      -MAX_STORED_TURNS
    );

    await conversationRef.set(
      {
        title,
        messages,
        updatedAt: now,
        ...(conversation.exists ? {} : { createdAt: now }),
      },
      { merge: true }
    );

    // TODO: la base di conoscenza Revna non è ancora collegata. Finché non c'è,
    // il modello risponde sul profilo e sulla propria conoscenza di settore:
    // manca la tracciabilità delle fonti prevista dal perimetro.
    logger.info('Risposta assistente', { uid, chars: text.length });

    return { text, conversationId: conversationRef.id, title };
  }
);

/**
 * Titolo breve per l'elenco delle conversazioni, ricavato dalla prima domanda.
 * Se la chiamata fallisce non deve far fallire la risposta: si ripiega sulla
 * domanda troncata, che come etichetta funziona quasi altrettanto bene.
 */
async function summarize(ai: GenAI, message: string): Promise<string> {
  const fallback = message.length > 48 ? `${message.slice(0, 45).trimEnd()}…` : message;

  try {
    const response = await ai.models.generateContent({
      model: geminiModel.value(),
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                'Riassumi questa domanda in un titolo di massimo 5 parole, in italiano, ' +
                'senza virgolette e senza punto finale. Rispondi solo con il titolo.\n\n' +
                message,
            },
          ],
        },
      ],
      config: { temperature: 0.2, maxOutputTokens: 32 },
    });

    const title = response.text?.trim().replace(/^["'«»]|["'«».]$/g, '');
    return title && title.length <= 60 ? title : fallback;
  } catch (cause) {
    logger.warn('Titolo non generato', { cause });
    return fallback;
  }
}
