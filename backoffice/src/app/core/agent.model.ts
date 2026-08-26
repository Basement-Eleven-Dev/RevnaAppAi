/**
 * Personalità dell'assistente e base di conoscenza Revna.
 *
 * La personalità sta in `agent/config`, le voci di conoscenza nella collezione
 * `knowledge`. Entrambe sono globali, non per cliente: definiscono l'agente che
 * parla con tutti. Quello che cambia da cliente a cliente è il profilo struttura.
 *
 * I default qui sotto ricalcano quelli del backend (`backend/functions/src/agent.ts`):
 * il form deve mostrare il comportamento reale dell'assistente, non caselle vuote.
 * Sono duplicati come le liste del profilo — poche righe, nessun pacchetto condiviso.
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
  /** Schede di partenza della nuova conversazione, nell'app. */
  spunti: string[];
};

/**
 * Come è entrata una voce nella base di conoscenza.
 *
 * `voce`: scritta a mano nel backoffice, riformulata per l'assistente.
 * `file`: un documento caricato così com'è, di cui il backend estrae il testo.
 *
 * Le due convivono e per l'assistente sono la stessa cosa: quello che finisce nel
 * contesto è `contenuto`, comunque ci sia arrivato. La distinzione serve al
 * backoffice — un file non si modifica a mano, si sostituisce o si rielabora.
 */
export type KnowledgeFormato = 'voce' | 'file';

/** Il documento caricato dietro una voce di formato `file`. */
export type KnowledgeFile = {
  /** Nome originale, come lo ha caricato chi lavora nel backoffice. */
  name: string;
  storagePath: string;
  contentType: string;
  size: number;
};

/** Esito dell'estrazione del testo da un file. Le voci scritte a mano sono sempre pronte. */
export type KnowledgeStato = 'pronto' | 'errore';

export type KnowledgeEntry = {
  id: string;
  formato: KnowledgeFormato;
  titolo: string;
  tipo: string;
  tags: string[];
  /** Il testo che entra nel contesto dell'assistente. Per i file lo scrive il backend. */
  contenuto: string;
  file: KnowledgeFile | null;
  stato: KnowledgeStato;
  /** Perché l'estrazione non è riuscita, quando `stato` è `errore`. */
  errore: string;
  attivo: boolean;
  updatedAt: string;
  updatedBy: string;
};

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
  spunti: [
    'Analizza la mia stagionalità',
    'Come miglioro il mio ADR',
    'Come riduco la dipendenza dalle OTA',
    'Che tariffe imposto per il prossimo ponte',
  ],
};

export const EMPTY_ENTRY: Omit<KnowledgeEntry, 'id'> = {
  formato: 'voce',
  titolo: '',
  tipo: 'metodo',
  tags: [],
  contenuto: '',
  file: null,
  stato: 'pronto',
  errore: '',
  attivo: true,
  updatedAt: '',
  updatedBy: '',
};

export const TIPI_CONOSCENZA = [
  { value: 'metodo', label: 'Metodo' },
  { value: 'playbook', label: 'Playbook — se X, allora Y' },
  { value: 'kpi', label: 'KPI o formula' },
  { value: 'checklist', label: 'Checklist di valutazione' },
  { value: 'caso', label: 'Caso o esempio con numeri' },
  { value: 'glossario', label: 'Glossario' },
  { value: 'posizione', label: 'Posizione Revna' },
  { value: 'documento', label: 'Documento' },
];

/**
 * Aree tematiche di partenza, ricavate dagli indici dei volumi Revna.
 *
 * Non sono un vincolo: si può scrivere un tag nuovo. Servono a non lasciar
 * inventare un vocabolario diverso a ogni voce, perché è su questi tag che
 * l'assistente ritrova il materiale quando la conoscenza cresce.
 */
export const AREE_TEMATICHE = [
  'pricing',
  'forecasting',
  'restrizioni',
  'nesting',
  'distribuzione',
  'ota',
  'disintermediazione',
  'kpi',
  'benchmarking',
  'costi',
  'budget',
  'posizionamento',
  'segmentazione',
  'guest-personas',
  'marketing',
  'sito-web',
  'seo',
  'social',
  'email',
  'staff',
  'upselling',
  'front-office',
  'qualita',
  'reclami',
  'reputazione',
  'food-beverage',
  'spa',
  'tecnologia',
  'pms',
  'crm',
];

export function tipoLabel(value: string): string {
  return TIPI_CONOSCENZA.find((option) => option.value === value)?.label ?? value;
}

/**
 * Quali file il backend sa trasformare in testo.
 *
 * PDF e immagini passano dal modello, che li trascrive (e legge anche le scansioni);
 * i formati testuali si decodificano e basta. Word ed Excel non ci sono: nessuno dei
 * due si legge senza una libreria dedicata, e l'esportazione in PDF costa un clic.
 */
export const FILE_ACCETTATI =
  '.pdf,.txt,.md,.markdown,.csv,.json,.png,.jpg,.jpeg,.webp,application/pdf,text/*,image/png,image/jpeg,image/webp';

/** Oltre questa dimensione il caricamento viene rifiutato prima di partire. */
export const MAX_FILE_BYTES = 30 * 1024 * 1024;

/**
 * Sopra questa soglia di caratteri il backend smette di mettere in contesto tutta
 * la conoscenza e comincia a selezionarla (`FULL_CONTEXT_BUDGET_CHARS` in agent.ts).
 * Serve qui solo per dirlo a chi scrive le voci: non è un limite, è una soglia.
 */
export const SOGLIA_SELEZIONE_CHARS = 120_000;

/** Stima grossa: in italiano un token sta intorno ai 4 caratteri. */
export function stimaToken(chars: number): string {
  const token = Math.round(chars / 4);
  return token < 1000 ? `${token} token` : `${(token / 1000).toFixed(1)}k token`;
}

/** Dimensione leggibile, senza decimali inutili sui file piccoli. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Il nome del file senza estensione: è il titolo di partenza di una voce-documento. */
export function titoloDaFile(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim() || name
  );
}
