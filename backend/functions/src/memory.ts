import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from './admin';

/**
 * La memoria dell'assistente: come vuole essere assistito chi gli scrive.
 *
 * È la promessa per cui l'assistente non riparte da zero a ogni conversazione, e
 * tiene **le preferenze di una persona**, non i dati di una struttura: come vuole le
 * risposte, cosa non deve fare, come lavora, che paletti si è dato. Chi dice una volta
 * «quando mi rispondi non usare mai gli elenchi puntati» non deve ridirlo mai più.
 *
 * I numeri della struttura restano fuori di proposito — occupazione, ADR, tariffe,
 * eventi, andamento di una stagione. Non perché non contino, ma perché **cambiano**:
 * una memoria che li tiene finisce per contraddirsi da sé, e nessuno sa quale delle
 * due righe valga. Quelli stanno nel profilo, che Revna aggiorna, e nella
 * conversazione, dove hanno accanto la data in cui sono stati detti.
 *
 * Detto in un'altra forma: qui non si annota *cosa sa* l'assistente sul cliente, si
 * annota *come deve trattarlo*. Le preferenze non invecchiano come i numeri — valgono
 * finché il cliente non dice il contrario — ed è per questo che una memoria fatta di
 * preferenze si può tenere per anni.
 *
 * Tre cose la tengono onesta:
 *
 * - **Sta in chiaro.** Il cliente la vede tutta nelle impostazioni dell'app, la
 *   corregge riga per riga e la cancella quando vuole. Se dobbiamo dire «l'assistente
 *   ricorda», il cliente deve poter vedere cosa.
 * - **Ogni riga ha una data e una provenienza**: quando l'assistente l'ha imparata e
 *   in quale conversazione. Su una preferenza la data non è una scadenza, è un modo
 *   per riconoscerla: «questo l'ho chiesto io, a marzo».
 * - **È una riga per preferenza**, non un blocco di prosa: solo così una si può
 *   aggiornare quando il cliente cambia idea, o togliere quando non vale più, senza
 *   riscrivere il resto.
 *
 * Chi la scrive è il modello stesso, con gli strumenti dichiarati qui sotto e in una
 * chiamata a parte dalla risposta (vedi `updateMemory`): la risposta al cliente non
 * deve poter contenere gli attrezzi con cui l'assistente prende appunti.
 */

/** Chi ha scritto una riga per ultimo: l'assistente parlando, o il cliente correggendo. */
export type MemoryOrigin = 'assistente' | 'cliente';

export type MemoryEntry = {
  id: string;
  /** La preferenza, in una frase. È l'unica cosa che il modello legge e che il cliente modifica. */
  testo: string;
  /** Quando è stata annotata la prima volta, in ISO. Non cambia più. */
  at: string;
  /** Quando è stato riscritto l'ultima volta, dall'assistente o dal cliente. */
  updatedAt: string;
  /** La conversazione in cui è emerso. */
  conversationId?: string;
  /**
   * Il titolo di quella conversazione, copiato al momento dell'annotazione.
   *
   * Una copia e non un riferimento, come il recapito nelle richieste di contatto: la
   * conversazione il cliente può cancellarla, e la preferenza espressa resta valida. Meglio
   * un riferimento che invecchia di un riferimento che sparisce.
   */
  conversazione?: string;
  origine: MemoryOrigin;
};

/**
 * Le righe stanno in `users/{uid}/memory/{entryId}`, un documento per preferenza.
 *
 * Non un array in un solo documento, a differenza dei turni di una conversazione:
 * qui le scritture arrivano da due parti — l'assistente dopo un turno, il cliente
 * che corregge dall'app — e su un array l'ultimo a salvare cancellerebbe il lavoro
 * dell'altro. Un documento per riga è anche l'unico modo per dare al cliente il
 * diritto di cancellarne uno senza dargli quello di riscriverli tutti.
 */
export function memoryOf(uid: string) {
  return db.collection('users').doc(uid).collection('memory');
}

/**
 * Quante preferenze può tenere la memoria di un cliente.
 *
 * Non è un limite di spazio, è un limite di senso: le preferenze di una persona sono
 * una manciata, e se qui ne fossero venticinque vorrebbe dire che si sta annotando
 * qualcos'altro. Quando è piena, la riga nuova fa uscire quella aggiornata da più
 * tempo.
 */
const MAX_ENTRIES = 25;

/** Oltre questa lunghezza non è una preferenza, è un paragrafo. */
export const MAX_ENTRY_CHARS = 280;

/**
 * Quante operazioni si accettano da un solo turno.
 *
 * In un turno il cliente esprime una preferenza, raramente due. Un modello che ne
 * propone dieci ha capito male il compito — sta riassumendo la conversazione — e
 * senza un argine riempirebbe la memoria in una chat.
 */
const MAX_OPS_PER_TURN = 3;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Una riga come la legge il modello e come la mostra l'app: una frase sola, pulita. */
function sanitizeText(value: unknown): string {
  return text(value).replace(/\s+/g, ' ').slice(0, MAX_ENTRY_CHARS).trim();
}

function toEntry(id: string, input: unknown): MemoryEntry {
  const raw = (input ?? {}) as Record<string, unknown>;
  const at = text(raw['at']);

  return {
    id,
    testo: sanitizeText(raw['testo']),
    at,
    updatedAt: text(raw['updatedAt']) || at,
    ...(text(raw['conversationId']) ? { conversationId: text(raw['conversationId']) } : {}),
    ...(text(raw['conversazione']) ? { conversazione: text(raw['conversazione']) } : {}),
    origine: raw['origine'] === 'cliente' ? 'cliente' : 'assistente',
  };
}

/**
 * La memoria del cliente, dalla preferenza più vecchia alla più recente.
 *
 * In ordine cronologico perché è l'ordine in cui la legge il modello, e perché fra due
 * righe che si contraddicono vince la più recente: leggendole in fila, l'ultima parola
 * è quella giusta. L'app le mostra al contrario, dove conta vedere subito l'ultima
 * cosa che si è chiesta.
 */
export async function loadMemory(uid: string): Promise<MemoryEntry[]> {
  const snapshot = await memoryOf(uid).orderBy('at', 'asc').limit(MAX_ENTRIES).get();

  return snapshot.docs
    .map((document) => toEntry(document.id, document.data()))
    .filter((entry) => entry.testo !== '');
}

/** La data di una riga come la legge il modello: in italiano, senza ora. */
const when = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * La memoria in chiaro nel system prompt, numerata.
 *
 * I numeri `M1`, `M2` sono gli stessi che il modello usa negli strumenti per dire
 * quale riga aggiornare o dimenticare: gli id dei documenti non gli servono e non
 * gli si danno: sono venti caratteri casuali che occuperebbero contesto e che il
 * modello copierebbe sbagliato.
 */
export function describeMemory(entries: MemoryEntry[]): string {
  return entries
    .map((entry, index) => {
      const data = when(entry.at);
      const dove = entry.conversazione ? ` — da «${entry.conversazione}»` : '';
      return `[M${index + 1}] ${data}${dove}: ${entry.testo}`;
    })
    .join('\n');
}

/**
 * Come l'assistente usa la memoria mentre risponde.
 *
 * Il punto delicato è una riga sola: le preferenze del cliente **battono le abitudini
 * di scrittura del modello, non il perimetro di Revna**. Chi scrive «non usare elenchi
 * puntati» sta cambiando come gli si risponde, e deve ottenerlo; chi scrivesse «non
 * citare le fonti» o «dimmi cosa devo fare col commercialista» starebbe cambiando cosa
 * l'assistente è, e non deve ottenerlo. Senza questa gerarchia scritta, la memoria
 * diventerebbe un modo per riscrivere il system prompt un turno alla volta.
 *
 * Sta nel codice come le regole di citazione e non fra le sezioni che il backoffice
 * modifica: sono il contratto fra il prompt e questo file — la numerazione `M1`, il
 * fatto che le righe le aggiorna un altro passaggio — e chi scrive il tono
 * dell'assistente non deve poterlo rompere.
 */
export const MEMORY_RULES = `
Come vuole essere assistito chi ti scrive
- Sotto il profilo trovi la tua memoria: le preferenze e le istruzioni che questo
  cliente ti ha dato nelle conversazioni precedenti, ognuna con la data.
- Sono istruzioni, non appunti. Valgono per ogni risposta anche quando il cliente non
  le ripete, e vengono prima delle tue abitudini: se una dice di non usare elenchi
  puntati, non usi elenchi puntati nemmeno quando ti sembrerebbero più chiari.
- Non vengono prima del tuo perimetro, delle regole sulle citazioni e di quelle sulle
  richieste di contatto: quelle sono di Revna e non si negoziano con una preferenza.
- Se due righe si contraddicono vale la più recente. Se in questo turno il cliente
  chiede il contrario di una sua preferenza, in questo turno vale quello che chiede ora.
- Non elencarle, non riepilogarle e non dire che le stai seguendo: si vede dalla
  risposta. La memoria la aggiorni dopo, con i tuoi strumenti, e al cliente non lo dici.
`.trim();

/** Uno strumento offerto al modello, nella forma minima che serve qui. */
export type ToolDeclaration = {
  name: string;
  description: string;
  /** JSON Schema dei parametri. */
  parameters: Record<string, unknown>;
};

/** Una chiamata a strumento decisa dal modello. */
export type ToolCall = { name: string; args: Record<string, unknown> };

/**
 * Gli strumenti con cui l'assistente tiene la memoria.
 *
 * Tre e non uno: `ricorda` da sola trasformerebbe la memoria in un elenco che cresce
 * per accumulo, dove «vuole risposte brevi» sta accanto a «vuole più dettaglio» e non
 * si capisce quale valga. `aggiorna` e `dimentica` sono ciò che rende la memoria
 * *aggiornabile nel tempo*, che è la parte difficile della promessa: una persona cambia
 * idea su come vuole essere aiutata, e deve poterlo fare dicendolo una volta.
 */
const MEMORY_TOOLS: ToolDeclaration[] = [
  {
    name: 'ricorda',
    description:
      'Annota una preferenza o un\'istruzione durevole di questo cliente su come vuole essere ' +
      'assistito, in una frase autosufficiente. Solo cose che valgono da qui in avanti.',
    parameters: {
      type: 'object',
      properties: {
        testo: {
          type: 'string',
          description: `La preferenza, in una frase sola, massimo ${MAX_ENTRY_CHARS} caratteri.`,
        },
      },
      required: ['testo'],
    },
  },
  {
    name: 'aggiorna',
    description:
      'Riscrive una preferenza già in memoria, quando il cliente ha cambiato idea o l\'ha ' +
      'precisata. Da usare al posto di `ricorda` ogni volta che quello che il cliente ha detto ' +
      'ora riguarda la stessa cosa di una riga che è già lì.',
    parameters: {
      type: 'object',
      properties: {
        numero: {
          type: 'integer',
          description: 'Il numero della riga in memoria, senza la M: per [M3] è 3.',
        },
        testo: { type: 'string', description: 'La preferenza riscritta, in una frase sola.' },
      },
      required: ['numero', 'testo'],
    },
  },
  {
    name: 'dimentica',
    description:
      'Cancella una preferenza che il cliente ha revocato, o che non vale più, o che era stata ' +
      'annotata per errore.',
    parameters: {
      type: 'object',
      properties: {
        numero: {
          type: 'integer',
          description: 'Il numero della riga in memoria, senza la M: per [M3] è 3.',
        },
      },
      required: ['numero'],
    },
  },
];

/**
 * Cosa merita la memoria, spiegato al modello.
 *
 * La metà che conta è la seconda: senza i divieti, un modello a cui si chiede di
 * prendere appunti annota i dati della struttura — l'occupazione di luglio, la tariffa
 * di un ponte, l'evento di dicembre. Sono le cose che *cambiano*, e in tre mesi la
 * memoria si contraddice da sé: due righe che dicono numeri diversi sulla stessa cosa,
 * e nessuno che sappia quale valga. Quei dati hanno già due posti giusti, il profilo e
 * la conversazione, dove hanno accanto una data che si legge.
 *
 * Qui resta una cosa sola: come questa persona vuole essere assistita.
 */
const CRITERIA = `
Cosa va in memoria — le preferenze di chi ti scrive
- Come vuole le risposte: lingua, lunghezza, tono, formato (elenchi puntati sì o no,
  tabelle, esempi, schemi), quanto entrare nel tecnico.
- Cosa non deve fare: modi di rispondere che non gli piacciono, argomenti su cui non
  vuole tornare, cose che trova inutili, proposte che non vuole ricevere.
- Come lavora e come va trattato: di cosa si occupa davvero nella struttura, quanto
  tempo ha, quanto è esperto di revenue management, come vuole essere chiamato, se
  preferisce che gli si faccia una domanda alla volta o nessuna.
- Una richiesta esplicita — "ricordati che…", "d'ora in poi…", "non farlo mai più",
  "quando mi rispondi non…" — va annotata sempre: è il caso per cui la memoria esiste.

Cosa non ci va — ed è la metà che conta
- I dati della struttura: occupazione, ADR, RevPAR, tariffe, eventi, andamento di una
  stagione, peso dei canali, numeri di qualunque tipo. Cambiano nel tempo, e una
  memoria che li tiene finisce per contraddirsi da sé. Stanno nel profilo e nella
  conversazione: non è un'informazione che stai perdendo, è un'informazione che ha già
  il suo posto.
- Obiettivi, decisioni e piani commerciali: valgono per una stagione, non per sempre.
- Il racconto della conversazione: cosa ha chiesto, cosa sta valutando, cosa gli hai
  risposto.
- Le istruzioni che valgono per una risposta sola ("questa volta fammi un elenco",
  "riassumimelo in due righe"): una preferenza vale da qui in avanti, un'indicazione
  per il turno in corso no.
- Quello che è già nel profilo della struttura.
- Dati sensibili, nomi di dipendenti o di ospiti.

Come si scrive una riga
- Una frase sola, in italiano, in terza persona, che si capisca da sé fra sei mesi:
  "Non vuole elenchi puntati nelle risposte", non "Ha chiesto di non usare gli elenchi".
- Massimo ${MAX_ENTRY_CHARS} caratteri.
- Niente doppioni: se quello che il cliente ha detto ora riguarda la stessa cosa di una
  riga che è già in memoria, aggiorna quella invece di aggiungerne un'altra.
`.trim();

/**
 * Aggiorna la memoria dopo un turno di conversazione.
 *
 * Una chiamata al modello a parte, e non gli strumenti agganciati alla risposta: la
 * risposta al cliente arriva in streaming ed è la cosa che deve andare per prima e
 * senza intoppi. Se gli attrezzi per prendere appunti stessero in quella chiamata,
 * un turno in cui il modello decide di annotare qualcosa diventerebbe un turno in cui
 * il cliente aspetta di più — e un errore sugli strumenti diventerebbe un errore sulla
 * risposta. Qui, nel peggiore dei casi, non si impara niente e nessuno se ne accorge.
 *
 * `decide` arriva da fuori (vedi `model.ts`), come `ask` per la selezione della
 * conoscenza: tiene il client di Gemini fuori da questo file.
 *
 * Restituisce quante operazioni sono andate a segno: serve solo ai log.
 */
export async function updateMemory({
  uid,
  entries,
  message,
  answer,
  conversationId,
  conversazione,
  decide,
}: {
  uid: string;
  /** La memoria com'era prima del turno: i numeri `M1…` si riferiscono a questa. */
  entries: MemoryEntry[];
  message: string;
  answer: string;
  conversationId: string;
  /** Il titolo della conversazione, da copiare sulle righe nuove. */
  conversazione: string;
  decide: (prompt: string, tools: ToolDeclaration[]) => Promise<ToolCall[]>;
}): Promise<number> {
  const prompt = [
    'Tieni la memoria di un assistente di revenue management: come ognuno dei clienti con',
    'cui parla vuole essere assistito.',
    "Leggi l'ultimo scambio e decidi se il cliente ha espresso una preferenza da annotare,",
    'da correggere o da dimenticare.',
    '',
    CRITERIA,
    '',
    '--- Memoria attuale ---',
    entries.length ? describeMemory(entries) : '(vuota)',
    '',
    '--- Ultimo scambio ---',
    `Cliente: ${message}`,
    `Assistente: ${answer}`,
    '',
    `Chiama gli strumenti che servono, al massimo ${MAX_OPS_PER_TURN}. Nella grande ` +
      'maggioranza dei turni non serve nessuno strumento, perché in un turno normale il ' +
      'cliente fa una domanda e non dice come vuole essere trattato: se qui non ha ' +
      'espresso nessuna preferenza durevole, non chiamare nulla e non rispondere niente. ' +
      'Nel dubbio non annotare: una memoria breve e giusta vale più di una lunga.',
  ].join('\n');

  const calls = await decide(prompt, MEMORY_TOOLS).catch((cause: unknown) => {
    // La memoria che non si aggiorna è un peccato, la risposta che fallisce è un danno:
    // qui si perde il turno e si va avanti.
    logger.warn('Aggiornamento della memoria non riuscito', { uid, cause });
    return [] as ToolCall[];
  });

  if (!calls.length) return 0;

  return applyCalls({ uid, entries, calls, conversationId, conversazione });
}

/**
 * Esegue le chiamate del modello sulla memoria.
 *
 * Una riga si tocca una volta per turno: se il modello chiede due volte del numero 3
 * — capita, `aggiorna` e poi `dimentica` — vale la prima e le altre cadono. Con un
 * batch le scritture successive sullo stesso documento avrebbero un esito che dipende
 * dall'ordine, e l'ordine qui lo decide un modello.
 */
async function applyCalls({
  uid,
  entries,
  calls,
  conversationId,
  conversazione,
}: {
  uid: string;
  entries: MemoryEntry[];
  calls: ToolCall[];
  conversationId: string;
  conversazione: string;
}): Promise<number> {
  const now = new Date().toISOString();
  const batch = db.batch();
  const collection = memoryOf(uid);

  /** Le righe già toccate in questo turno, e quelle cancellate. */
  const touched = new Set<string>();
  const removed = new Set<string>();
  /** I testi già in memoria o appena aggiunti: l'argine ai doppioni. */
  const seen = new Set(entries.map((entry) => entry.testo.toLowerCase()));

  let added = 0;
  let done = 0;

  const pick = (args: Record<string, unknown>): MemoryEntry | undefined => {
    const numero = Number(args['numero']);
    return Number.isInteger(numero) ? entries[numero - 1] : undefined;
  };

  for (const call of calls.slice(0, MAX_OPS_PER_TURN)) {
    if (call.name === 'ricorda') {
      const testo = sanitizeText(call.args['testo']);
      if (!testo || seen.has(testo.toLowerCase())) continue;

      seen.add(testo.toLowerCase());
      added++;
      batch.set(collection.doc(), {
        testo,
        at: now,
        updatedAt: now,
        conversationId,
        ...(conversazione ? { conversazione } : {}),
        origine: 'assistente' satisfies MemoryOrigin,
      });
      done++;
      continue;
    }

    const entry = pick(call.args);
    if (!entry || touched.has(entry.id)) continue;

    if (call.name === 'aggiorna') {
      const testo = sanitizeText(call.args['testo']);
      if (!testo || testo.toLowerCase() === entry.testo.toLowerCase()) continue;

      touched.add(entry.id);
      // `at` non si tocca: la data in cui la cosa è entrata in memoria è parte del
      // preferenza, e sovrascriverla farebbe sembrare appena chiesto ciò che è di sei mesi fa.
      batch.update(collection.doc(entry.id), {
        testo,
        updatedAt: now,
        conversationId,
        ...(conversazione ? { conversazione } : {}),
        origine: 'assistente' satisfies MemoryOrigin,
      });
      done++;
      continue;
    }

    if (call.name === 'dimentica') {
      touched.add(entry.id);
      removed.add(entry.id);
      batch.delete(collection.doc(entry.id));
      done++;
    }
  }

  if (!done) return 0;

  // La memoria piena: escono le righe aggiornate da più tempo, non le più vecchie. Una
  // preferenza espressa un anno fa ma riconfermata il mese scorso è ancora viva; una di
  // due mesi fa che nessuno ha più toccato no.
  const surplus = entries.length - removed.size + added - MAX_ENTRIES;

  if (surplus > 0) {
    const droppable = entries
      .filter((entry) => !touched.has(entry.id))
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .slice(0, surplus);

    for (const entry of droppable) batch.delete(collection.doc(entry.id));
    logger.info('Memoria al limite, righe uscite', { uid, quanti: droppable.length });
  }

  await batch.commit();
  return done;
}

/**
 * Cancella tutta la memoria di un cliente.
 *
 * La singola riga il cliente la corregge e la cancella da sé, dall'app: sono
 * scritture piccole sui suoi documenti, e le regole Firestore le ammettono. La
 * cancellazione in blocco no — è una scrittura su un numero di documenti che il
 * client non conosce, e il diritto di dimenticare tutto merita un punto solo,
 * tracciabile, in cui succede.
 */
export const clearMemory = onCall<unknown, Promise<{ cancellati: number }>>(
  { region: 'europe-west1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Accesso riservato ai clienti Revna.');
    }

    const snapshot = await memoryOf(uid).get();
    if (snapshot.empty) return { cancellati: 0 };

    const batch = db.batch();
    for (const document of snapshot.docs) batch.delete(document.ref);
    await batch.commit();

    logger.info('Memoria cancellata dal cliente', { uid, cancellati: snapshot.size });
    return { cancellati: snapshot.size };
  },
);
