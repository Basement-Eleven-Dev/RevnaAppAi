import { logger } from 'firebase-functions';

import { db } from './admin';
import { describeMemory, MEMORY_RULES, type MemoryEntry } from './memory';

/**
 * Personalità dell'agente e base di conoscenza Revna.
 *
 * Sono i due ingredienti che il backoffice controlla e che `askAssistant` legge a
 * ogni domanda: `agent/config` dice CHI è l'assistente, la collezione `knowledge`
 * dice COSA sa. Entrambi stanno fuori dal codice perché li aggiorna Revna, non chi
 * sviluppa: cambiare il tono o aggiungere un capitolo non deve richiedere un deploy.
 *
 * La conoscenza non finisce nei pesi di un modello ma nel contesto della richiesta.
 * È l'unico modo per tenere la promessa fatta al cliente — ogni risposta rimanda al
 * materiale Revna da cui deriva — perché un peso non ha provenienza, una voce sì.
 */

export type AgentConfig = {
  /** Chi è l'assistente e per conto di chi parla. */
  identita: string;
  /** Come ragiona: da dove parte, cosa chiede, su quali leve lavora. */
  ragionamento: string;
  /** Come scrive: tono, lunghezza, lingua. */
  tono: string;
  /** Di cosa si occupa e cosa rimanda a un consulente in carne e ossa. */
  perimetro: string;
  /** 0 = risposte ripetibili, 1 = più variazione. */
  temperature: number;
};

/**
 * Una voce della base di conoscenza: un concetto, un metodo, una checklist.
 *
 * `contenuto` è l'unica cosa che il modello legge, e ci arriva in due modi: scritta
 * a mano nel backoffice, oppure estratta da un documento caricato (`formato: 'file'`,
 * vedi `knowledge.ts`). Da qui in poi le due sono indistinguibili, ed è voluto.
 */
export type KnowledgeEntry = {
  id: string;
  titolo: string;
  tipo: string;
  /** Aree tematiche: servono a ritrovare la voce quando la conoscenza cresce. */
  tags: string[];
  contenuto: string;
  attivo: boolean;
};

/** Fonte citata in una risposta, così come la vede il cliente nell'app. */
export type Source = {
  /** Il numero usato nel testo: `[1]`. */
  n: number;
  titolo: string;
};

/**
 * Personalità di partenza: è quella con cui l'assistente ha girato finché non
 * esisteva il backoffice. Resta qui come valore di default così una sezione
 * lasciata vuota non svuota il system prompt, ma lo riporta a un comportamento noto.
 */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  identita: `Sei l'assistente Revna: un consulente esperto di revenue management e di gestione
delle strutture ricettive, che parla per conto di Revna ai suoi clienti.`,
  ragionamento: `- Parti sempre dai dati della struttura di chi ti scrive, riportati più sotto.
  Le risposte generiche non servono: cita numeri, tipologie di camere, canali e
  stagionalità di QUESTA struttura quando sono pertinenti.
- Se per rispondere bene ti manca un dato operativo (occupazione media, ADR, RevPAR,
  mix di canali, tariffe, finestra di prenotazione), chiedilo — una domanda alla volta,
  non un questionario — e spiega in una riga perché ti serve.
- Ragiona per leve concrete: tariffe, restrizioni, mix di canale, durata del soggiorno,
  finestra di prenotazione, segmentazione, upselling. Evita la teoria fine a sé stessa.`,
  tono: `- Tono professionale e diretto, in italiano, come un consulente che conosce il cliente.
  Niente entusiasmo di maniera, niente elenchi puntati infiniti.
- Rispondi in modo asciutto: prima la risposta, poi il perché. Se proponi azioni,
  mettile in ordine di impatto.
- Se il cliente scrive in un'altra lingua, rispondi nella sua.`,
  perimetro: `- Ospitalità, revenue management, distribuzione, marketing alberghiero e gestione
  delle strutture ricettive.
- Su temi fuori perimetro, e su questioni legali, fiscali o giuslavoristiche vincolanti,
  non improvvisare: dillo chiaramente, indica il tema pertinente più vicino di cui puoi
  occuparti, e proponi di far ricontattare il cliente da un consulente Revna.
- Non inventare dati sulla struttura che non trovi nel profilo.`,
  temperature: 0.6,
};

/** Spunti di partenza della nuova conversazione, se il backoffice non li ha impostati. */
export const DEFAULT_SPUNTI = [
  'Analizza la mia stagionalità',
  'Come miglioro il mio ADR',
  'Come riduco la dipendenza dalle OTA',
  'Che tariffe imposto per il prossimo ponte',
];

/**
 * Quanta conoscenza sta nel contesto senza selezione.
 *
 * Sotto questa soglia si inietta tutto: con una base di conoscenza piccola, un
 * passaggio di selezione costerebbe una chiamata e mezzo secondo per scartare
 * niente. Sopra, si sceglie. 120.000 caratteri sono circa 30.000 token: sta larga
 * nella finestra di Gemini insieme al profilo e allo storico.
 */
const FULL_CONTEXT_BUDGET_CHARS = 120_000;

/** Quante voci passare al modello quando la selezione entra in gioco. */
const MAX_SELECTED = 10;

/**
 * Per quanto tempo la conoscenza resta in memoria nell'istanza.
 *
 * Le voci cambiano raramente e sono le stesse per tutti i clienti: rileggerle a ogni
 * messaggio sarebbe una lettura Firestore per niente. Un minuto è il compromesso —
 * chi lavora nel backoffice vede l'effetto di una modifica quasi subito.
 */
const CACHE_TTL_MS = 60_000;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function sanitizeAgentConfig(input: unknown): AgentConfig {
  const raw = (input ?? {}) as Record<string, unknown>;
  const temperature = Number(raw['temperature']);

  return {
    identita: text(raw['identita']) || DEFAULT_AGENT_CONFIG.identita,
    ragionamento: text(raw['ragionamento']) || DEFAULT_AGENT_CONFIG.ragionamento,
    tono: text(raw['tono']) || DEFAULT_AGENT_CONFIG.tono,
    perimetro: text(raw['perimetro']) || DEFAULT_AGENT_CONFIG.perimetro,
    temperature: Number.isFinite(temperature)
      ? Math.min(Math.max(temperature, 0), 1)
      : DEFAULT_AGENT_CONFIG.temperature,
  };
}

function sanitizeEntry(id: string, input: unknown): KnowledgeEntry {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    id,
    titolo: text(raw['titolo']),
    tipo: text(raw['tipo']),
    tags: Array.isArray(raw['tags'])
      ? (raw['tags'] as unknown[]).filter((tag): tag is string => typeof tag === 'string')
      : [],
    contenuto: text(raw['contenuto']),
    attivo: raw['attivo'] !== false,
  };
}

type Loaded = { config: AgentConfig; knowledge: KnowledgeEntry[] };

let cache: (Loaded & { at: number }) | undefined;

/**
 * Personalità e voci attive, con una cache breve.
 *
 * Le voci vengono ordinate per titolo qui e non nella query: filtrare per `attivo`
 * e ordinare per un altro campo richiederebbe un indice composito su Firestore, e
 * un ordinamento su qualche centinaio di voci in memoria non si misura.
 */
export async function loadAgent(): Promise<Loaded> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { config: cache.config, knowledge: cache.knowledge };
  }

  const [configSnapshot, knowledgeSnapshot] = await Promise.all([
    db.collection('agent').doc('config').get(),
    db.collection('knowledge').where('attivo', '==', true).get(),
  ]);

  const config = sanitizeAgentConfig(configSnapshot.data());
  const knowledge = knowledgeSnapshot.docs
    .map((document) => sanitizeEntry(document.id, document.data()))
    .filter((entry) => entry.contenuto !== '')
    .sort((a, b) => a.titolo.localeCompare(b.titolo, 'it'));

  cache = { at: Date.now(), config, knowledge };
  return { config, knowledge };
}

/**
 * Le voci da mettere in contesto per questa domanda.
 *
 * `ask` è una chiamata al modello passata da fuori: serve solo nel caso in cui la
 * conoscenza non ci stia tutta, e tenerla come parametro evita di importare il
 * client di Gemini anche qui.
 */
export async function selectKnowledge(
  question: string,
  entries: KnowledgeEntry[],
  ask: (prompt: string) => Promise<string>,
): Promise<KnowledgeEntry[]> {
  if (!entries.length) return [];

  const weight = entries.reduce((sum, entry) => sum + entry.contenuto.length, 0);
  if (weight <= FULL_CONTEXT_BUDGET_CHARS) return entries;

  // Indice compatto: al modello serve sapere di cosa parla ogni voce, non cosa dice.
  const index = entries
    .map(
      (entry, i) =>
        `${i + 1}. ${entry.titolo}${entry.tipo ? ` [${entry.tipo}]` : ''}` +
        `${entry.tags.length ? ` · ${entry.tags.join(', ')}` : ''}`,
    )
    .join('\n');

  const answer = await ask(
    `Ecco l'indice della base di conoscenza di un consulente di revenue management.\n\n` +
      `${index}\n\n` +
      `Domanda del cliente: "${question}"\n\n` +
      `Indica i numeri delle voci utili a rispondere, al massimo ${MAX_SELECTED}, ` +
      `dalla più pertinente. Rispondi solo con i numeri separati da virgola, niente altro. ` +
      `Se nessuna voce è pertinente rispondi "nessuna".`,
  ).catch((cause: unknown) => {
    logger.warn('Selezione della conoscenza fallita, si passa alle parole chiave', { cause });
    return '';
  });

  const picked = (answer.match(/\d+/g) ?? [])
    .map((n) => entries[Number(n) - 1])
    .filter((entry): entry is KnowledgeEntry => entry !== undefined)
    .slice(0, MAX_SELECTED);

  // Se il modello non ha scelto — errore, o davvero nessuna voce pertinente — non
  // si resta a mani vuote: un punteggio per parole chiave è grezzo ma non sbaglia
  // di molto, e una risposta senza fonti è peggio di una con fonti approssimative.
  const selected = picked.length ? picked : byKeyword(question, entries);

  logger.info('Conoscenza selezionata', {
    disponibili: entries.length,
    scelte: selected.map((entry) => entry.id),
  });
  return selected;
}

/** Ripiego senza modello: quante parole della domanda ricorrono nella voce. */
function byKeyword(question: string, entries: KnowledgeEntry[]): KnowledgeEntry[] {
  const words = normalize(question)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4);
  if (!words.length) return entries.slice(0, MAX_SELECTED);

  return entries
    .map((entry) => {
      const head = normalize(`${entry.titolo} ${entry.tags.join(' ')}`);
      const body = normalize(entry.contenuto);
      const score = words.reduce(
        (sum, word) => sum + (head.includes(word) ? 3 : 0) + (body.includes(word) ? 1 : 0),
        0,
      );
      return { entry, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SELECTED)
    .map((row) => row.entry);
}

const normalize = (value: string): string =>
  value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Le regole di citazione.
 *
 * Non sono modificabili dal backoffice, a differenza della personalità: sono un
 * contratto tecnico fra il prompt e `resolveCitations`, che si aspetta esattamente
 * i marcatori `[n]`. Chi scrive il tono dell'assistente non deve poterlo rompere.
 */
const CITATION_RULES = `
Come usi il materiale Revna
- Il materiale qui sotto è la base di conoscenza di Revna. È la tua fonte: quando
  una risposta poggia su una di quelle voci, cita il suo numero fra parentesi quadre
  subito dopo l'affermazione — così: [1]. Più fonti insieme: [1] [3].
- Cita solo i numeri che vedi elencati. Non inventare numeri e non citare materiale
  che non ti è stato dato.
- Non copiare i testi parola per parola: usali per ragionare e riformula.
- Se le voci non coprono la domanda, rispondi con la tua competenza di settore ma
  senza citare nulla, e dillo in una riga.
`.trim();

const NO_KNOWLEDGE_RULES = `
Come usi il materiale Revna
- Per questa domanda non hai materiale Revna a disposizione: rispondi con la tua
  competenza di settore e non citare nessuna fonte.
`.trim();

/**
 * Il marcatore con cui l'assistente propone una richiesta di contatto.
 *
 * `extractContactProposal` si aspetta esattamente questa forma, quindi le regole che
 * la spiegano al modello stanno nel codice come quelle di citazione e non fra le
 * sezioni modificabili dal backoffice: chi scrive il tono dell'assistente deve poter
 * dire *quando* passare la mano, non *come* dirlo alla macchina.
 */
const HANDOFF_OPEN = '<<<CONTATTO:';
const HANDOFF_CLOSE = '>>>';

const HANDOFF_RULES = `
Quando devi passare la mano
- Se la domanda esce dal tuo perimetro, o se per rispondere servirebbe una decisione
  che spetta a un consulente in carne e ossa, o se il materiale Revna e la tua
  competenza non bastano, non girare intorno alla cosa: dillo in una riga e proponi
  di far ricontattare il cliente da un consulente Revna.
- Solo in quel caso, dopo la risposta, chiudi il messaggio con una riga così:
  ${HANDOFF_OPEN} testo della richiesta ${HANDOFF_CLOSE}
- Dentro il marcatore scrivi la richiesta come la scriverebbe il cliente al suo
  consulente: prima persona, due o tre frasi, cosa gli serve e perché. Il cliente
  la vedrà e potrà correggerla prima di inviarla, quindi deve stare in piedi da sé,
  anche per chi non ha letto questa conversazione.
- Dopo il marcatore non scrivere altro, e non usarlo se hai risposto tu.
- Non usarlo nemmeno quando ti manca solo un dato che il cliente può darti: quello
  glielo chiedi, non è un lavoro per un consulente.
`.trim();

/**
 * Stacca dalla risposta la richiesta di contatto proposta dal modello.
 *
 * Il marcatore non deve arrivare al cliente in nessun caso: quello che il cliente
 * vede è la risposta, e la proposta diventa un bottone. Il caso del marcatore aperto
 * e non chiuso è previsto — succede quando la risposta viene troncata — e vale come
 * se fosse chiuso: buttare via la proposta perché mancano tre segni maggiore
 * costerebbe al cliente l'unica cosa utile di quella risposta.
 */
export function extractContactProposal(answer: string): { text: string; proposal?: string } {
  const start = answer.indexOf(HANDOFF_OPEN);
  if (start === -1) return { text: answer };

  const rest = answer.slice(start + HANDOFF_OPEN.length);
  const end = rest.indexOf(HANDOFF_CLOSE);

  const text = (answer.slice(0, start) + (end === -1 ? '' : rest.slice(end + HANDOFF_CLOSE.length)))
    .trim();

  // Le citazioni dentro la proposta vanno via: là fuori quei numeri non vogliono
  // dire niente, e il testo lo leggerà un consulente, non l'app.
  const proposal = (end === -1 ? rest : rest.slice(0, end))
    .replace(/\[\d{1,2}\]/g, '')
    .replace(/^["'«»]|["'«»]$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { text, ...(proposal ? { proposal } : {}) };
}

/**
 * Il system prompt completo: personalità dal backoffice, regole dal codice.
 *
 * L'ordine non è casuale: prima chi sei, poi come lavori, poi cosa hai davanti. Il
 * profilo e la memoria stanno in fondo e in quest'ordine — com'è fatta la struttura,
 * e poi come vuole essere trattato chi la gestisce — perché sono l'ultima cosa che il
 * modello legge prima della domanda, ed è quella che deve avere più fresca.
 */
export function buildSystemInstruction(
  config: AgentConfig,
  profileDescription: string,
  selected: KnowledgeEntry[],
  memory: MemoryEntry[],
): string {
  const parts = [
    config.identita,
    '',
    'Come ragioni',
    config.ragionamento,
    '',
    'Come rispondi',
    config.tono,
    '',
    'Il tuo perimetro',
    config.perimetro,
    '',
    selected.length ? CITATION_RULES : NO_KNOWLEDGE_RULES,
    '',
    HANDOFF_RULES,
    // Le regole della memoria solo se c'è memoria: alla prima conversazione
    // spiegherebbero come usare un blocco che non esiste.
    ...(memory.length ? ['', MEMORY_RULES] : []),
    '',
    '--- Profilo della struttura di chi ti scrive ---',
    profileDescription,
  ];

  // La memoria vuota non si dichiara: dire al modello che il cliente non ha ancora
  // espresso preferenze lo porta a chiederle, e non è una cosa che si chiede.
  if (memory.length) {
    parts.push(
      '',
      '--- Come vuole essere assistito chi ti scrive (la tua memoria) ---',
      describeMemory(memory),
    );
  }

  if (selected.length) {
    parts.push('', '--- Materiale Revna ---');
    for (const [index, entry] of selected.entries()) {
      parts.push('', `[${index + 1}] ${entry.titolo}`, entry.contenuto);
    }
  }

  return parts.join('\n');
}

/**
 * Trasforma i marcatori del modello in fonti da mostrare, e ripulisce il testo.
 *
 * Due cose che il modello sbaglia e che vanno corrette prima di far vedere la
 * risposta: cita numeri che non esistono (via, insieme al marcatore), e cita
 * [2] e [5] senza aver mai citato [1] — la numerazione viene compattata, perché
 * un elenco di fonti che parte da 2 sembra un pezzo mancante.
 */
export function resolveCitations(
  answer: string,
  selected: KnowledgeEntry[],
): { text: string; sources: Source[] } {
  const marker = /\[(\d{1,2})\]/g;

  // Ordine di prima apparizione: è quello in cui il cliente legge le fonti.
  const used: number[] = [];
  for (const match of answer.matchAll(marker)) {
    const n = Number(match[1]);
    if (n >= 1 && n <= selected.length && !used.includes(n)) used.push(n);
  }

  // Un solo passaggio di sostituzione: rinumerare a tappe farebbe collidere le
  // vecchie posizioni con le nuove ([3] → [1] e poi [1] → [2]).
  const renumbered = new Map(used.map((n, index) => [n, index + 1]));
  const text = answer
    .replace(marker, (whole, digits: string) => {
      const to = renumbered.get(Number(digits));
      return to ? `[${to}]` : '';
    })
    .replace(/ +([.,;:])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();

  const sources = used.map((n, index) => ({ n: index + 1, titolo: selected[n - 1].titolo }));

  return { text, sources };
}
