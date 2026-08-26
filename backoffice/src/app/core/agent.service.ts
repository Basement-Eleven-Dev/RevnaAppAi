import { inject, Injectable } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { deleteObject, ref, uploadBytesResumable } from 'firebase/storage';

import {
  DEFAULT_AGENT_CONFIG,
  EMPTY_ENTRY,
  titoloDaFile,
  type AgentConfig,
  type KnowledgeEntry,
} from './agent.model';
import { AuthService } from './auth.service';
import { safeFileName } from './documents.model';
import { getFirebaseDb, getFirebaseFunctions, getFirebaseStorage } from './firebase';

/**
 * Lettura e scrittura della personalità dell'assistente e della sua conoscenza.
 *
 * Scrive direttamente su Firestore, senza passare da una Cloud Function: le regole
 * aprono queste collezioni ai soli referenti Revna, e la normalizzazione che conta
 * avviene lato backend in lettura, cioè nel punto in cui questi testi entrano nel
 * prompt del modello. È la stessa scelta fatta per i documenti dei clienti.
 *
 * L'eccezione sono i file: il binario va su Storage direttamente da qui, ma il testo
 * lo estrae `ingestKnowledgeFile`, perché leggere un PDF nel browser vorrebbe dire
 * portarsi dietro una libreria e comunque non saprebbe leggere le scansioni.
 */
@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly auth = inject(AuthService);

  private configRef() {
    return doc(getFirebaseDb(), 'agent', 'config');
  }

  /** Il documento che l'app mobile può leggere: solo quello che deve mostrare da sé. */
  private publicRef() {
    return doc(getFirebaseDb(), 'agent', 'public');
  }

  private knowledgeRef() {
    return collection(getFirebaseDb(), 'knowledge');
  }

  async config(): Promise<AgentConfig> {
    const [config, shared] = await Promise.all([
      getDoc(this.configRef()),
      getDoc(this.publicRef()),
    ]);
    const stored = config.data() as Partial<AgentConfig> | undefined;
    const spunti = shared.data()?.['spunti'] as string[] | undefined;

    return {
      ...DEFAULT_AGENT_CONFIG,
      ...stored,
      spunti: spunti?.length ? spunti : DEFAULT_AGENT_CONFIG.spunti,
    };
  }

  /**
   * Salva la personalità in due documenti: il prompt resta riservato al backoffice,
   * gli spunti finiscono dove l'app può leggerli. Prima il documento riservato:
   * se la seconda scrittura fallisce restano spunti vecchi con un prompt nuovo,
   * che è il guasto meno visibile dei due.
   */
  async saveConfig(config: AgentConfig): Promise<void> {
    const updatedAt = new Date().toISOString();
    const updatedBy = this.auth.user()?.email ?? '';

    await setDoc(
      this.configRef(),
      {
        identita: config.identita.trim(),
        ragionamento: config.ragionamento.trim(),
        tono: config.tono.trim(),
        perimetro: config.perimetro.trim(),
        temperature: config.temperature,
        updatedAt,
        updatedBy,
      },
      { merge: true },
    );

    await setDoc(
      this.publicRef(),
      {
        spunti: config.spunti.map((spunto) => spunto.trim()).filter(Boolean),
        updatedAt,
      },
      { merge: true },
    );
  }

  async knowledge(): Promise<KnowledgeEntry[]> {
    const snapshot = await getDocs(query(this.knowledgeRef(), orderBy('titolo')));
    return snapshot.docs.map((document) => hydrate(document.id, document.data()));
  }

  async entry(id: string): Promise<KnowledgeEntry | null> {
    const snapshot = await getDoc(doc(this.knowledgeRef(), id));
    if (!snapshot.exists()) return null;
    return hydrate(snapshot.id, snapshot.data());
  }

  /**
   * Crea o aggiorna una voce scritta a mano. `id` vuoto significa voce nuova.
   *
   * Non tocca `file`, `stato` e `contenuto` di una voce-documento oltre a quello che
   * riceve: il form dei file passa dalle stesse chiavi, ma il testo lo scrive
   * `ingestKnowledgeFile`.
   */
  async saveEntry(
    id: string,
    entry: Pick<KnowledgeEntry, 'titolo' | 'tipo' | 'tags' | 'contenuto' | 'attivo'>,
  ): Promise<string> {
    const target = id ? doc(this.knowledgeRef(), id) : doc(this.knowledgeRef());

    await setDoc(
      target,
      {
        formato: 'voce',
        titolo: entry.titolo.trim(),
        tipo: entry.tipo,
        tags: entry.tags,
        contenuto: entry.contenuto.trim(),
        attivo: entry.attivo,
        updatedAt: new Date().toISOString(),
        updatedBy: this.auth.user()?.email ?? '',
      },
      { merge: true },
    );

    return target.id;
  }

  /** Salva i soli campi editabili di una voce-documento: il testo non si scrive a mano. */
  async saveFileEntry(
    id: string,
    entry: Pick<KnowledgeEntry, 'titolo' | 'tipo' | 'tags' | 'attivo'>,
  ): Promise<void> {
    await setDoc(
      doc(this.knowledgeRef(), id),
      {
        titolo: entry.titolo.trim(),
        tipo: entry.tipo,
        tags: entry.tags,
        attivo: entry.attivo,
        updatedAt: new Date().toISOString(),
        updatedBy: this.auth.user()?.email ?? '',
      },
      { merge: true },
    );
  }

  /**
   * Carica un documento e lo trasforma in una voce di conoscenza.
   *
   * Tre passaggi, in quest'ordine: il file su Storage, la scheda su Firestore, e
   * l'estrazione del testo. Se salta il primo non resta niente; se salta il terzo
   * resta una voce **sospesa** con lo stato in errore — visibile, riprovabile, e
   * soprattutto fuori dal contesto dell'assistente finché non ha un testo dentro.
   *
   * La voce nasce sospesa apposta: una voce senza contenuto che risultasse attiva
   * verrebbe contata fra quelle disponibili e non direbbe niente al modello.
   */
  async uploadFile({
    file,
    tipo,
    tags,
    onProgress,
  }: {
    file: File;
    tipo: string;
    tags: string[];
    /** 0-100, per la barra di avanzamento. */
    onProgress?: (percent: number) => void;
  }): Promise<KnowledgeEntry> {
    const target = doc(this.knowledgeRef());
    const storagePath = `knowledge/${target.id}-${safeFileName(file.name)}`;
    const contentType = file.type || 'application/octet-stream';

    const task = uploadBytesResumable(ref(getFirebaseStorage(), storagePath), file, {
      contentType,
    });
    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        (snapshot) =>
          onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
        reject,
        () => resolve(),
      );
    });

    await setDoc(target, {
      formato: 'file',
      titolo: titoloDaFile(file.name),
      tipo,
      tags,
      contenuto: '',
      file: { name: file.name, storagePath, contentType, size: file.size },
      stato: 'errore',
      errore: 'Estrazione del testo non ancora eseguita.',
      attivo: false,
      updatedAt: new Date().toISOString(),
      updatedBy: this.auth.user()?.email ?? '',
    });

    await this.ingest(target.id);

    const entry = await this.entry(target.id);
    if (!entry) throw new Error('La voce è sparita subito dopo il caricamento.');
    return entry;
  }

  /**
   * Chiede al backend di (ri)leggere il file e riscriverne il testo.
   *
   * Serve anche da solo: se l'estrazione fallisce — modello non raggiungibile,
   * PDF illeggibile — si riprova senza ricaricare il file.
   */
  async ingest(entryId: string): Promise<{ chars: number; troncato: boolean }> {
    const call = httpsCallable<{ entryId: string }, { chars: number; troncato: boolean }>(
      getFirebaseFunctions(),
      'ingestKnowledgeFile',
    );
    const { data } = await call({ entryId });
    return data;
  }

  /** URL firmato per riaprire il file caricato. Vale pochi minuti, come per i documenti. */
  async fileUrl(entryId: string): Promise<string> {
    const call = httpsCallable<{ entryId: string }, { url: string }>(
      getFirebaseFunctions(),
      'getKnowledgeFileUrl',
    );
    const { data } = await call({ entryId });
    return data.url;
  }

  /** Sospende o riattiva una voce senza aprirla: l'assistente usa solo le attive. */
  async setAttivo(id: string, attivo: boolean): Promise<void> {
    await setDoc(
      doc(this.knowledgeRef(), id),
      { attivo, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  }

  /** Prima il file, poi la scheda: una scheda senza file non serve a nessuno. */
  async deleteEntry(entry: Pick<KnowledgeEntry, 'id' | 'file'>): Promise<void> {
    if (entry.file?.storagePath) {
      await deleteObject(ref(getFirebaseStorage(), entry.file.storagePath)).catch(() => {
        // Il file può essere già sparito: la scheda va rimossa comunque.
      });
    }
    await deleteDoc(doc(this.knowledgeRef(), entry.id));
  }

  /**
   * Prova l'assistente con il profilo di un cliente vero.
   *
   * Lo storico viaggia nella richiesta perché la prova non si salva da nessuna parte:
   * `previewAssistant` non scrive niente, né sotto il cliente né sotto chi prova. È
   * l'unico caso in cui il contesto lo tiene il client — qui il client è il backoffice
   * e la conversazione non è di nessuno.
   *
   * `onChunk` riceve i pezzi mentre il modello scrive. Sul web lo streaming delle
   * callable funziona senza accorgimenti, a differenza di React Native.
   */
  async preview(
    request: PreviewRequest,
    onChunk?: (text: string) => void,
  ): Promise<PreviewResponse> {
    const call = httpsCallable<PreviewRequest, PreviewResponse, { text: string }>(
      getFirebaseFunctions(),
      'previewAssistant',
    );

    if (!onChunk) {
      const { data } = await call(request);
      return data;
    }

    const { stream, data } = await call.stream(request);
    for await (const chunk of stream) {
      if (chunk.text) onChunk(chunk.text);
    }
    // `data` porta il testo definitivo — con i marcatori rinumerati — e la diagnostica.
    return data;
  }
}

/**
 * Da documento Firestore a voce completa.
 *
 * Le voci scritte prima che esistessero i file non hanno `formato`: sono voci, e il
 * default se ne occupa. Vale anche per `stato` e `file`.
 */
function hydrate(id: string, data: Record<string, unknown>): KnowledgeEntry {
  return { ...EMPTY_ENTRY, ...(data as Partial<KnowledgeEntry>), id };
}

export type PreviewSource = { n: number; titolo: string };

export type PreviewTurn = { role: 'user' | 'model'; text: string; sources?: PreviewSource[] };

export type PreviewRequest = { uid: string; message: string; history?: PreviewTurn[] };

/** Cosa è stato messo a disposizione del modello, e cosa ne ha fatto. */
export type PreviewDiagnostics = {
  conoscenza: { titolo: string; citata: boolean }[];
  disponibili: number;
  profilo: string;
  systemInstruction: string;
};

export type PreviewResponse = {
  text: string;
  sources: PreviewSource[];
  diagnostics: PreviewDiagnostics;
};
