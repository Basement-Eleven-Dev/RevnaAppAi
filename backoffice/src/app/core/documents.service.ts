import { inject, Injectable } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { deleteObject, ref, uploadBytesResumable } from 'firebase/storage';

import { AuthService } from './auth.service';
import { getFirebaseDb, getFirebaseFunctions, getFirebaseStorage } from './firebase';
import { safeFileName, type ClientDocument } from './documents.model';

export type UploadRequest = {
  uid: string;
  file: File;
  categoria: string;
  description: string;
  /** 0-100, per la barra di avanzamento. */
  onProgress?: (percent: number) => void;
};

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private readonly auth = inject(AuthService);

  private collectionOf(uid: string) {
    return collection(getFirebaseDb(), 'users', uid, 'documents');
  }

  async list(uid: string): Promise<ClientDocument[]> {
    const snapshot = await getDocs(query(this.collectionOf(uid), orderBy('uploadedAt', 'desc')));
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })) as ClientDocument[];
  }

  /**
   * Carica il file e poi ne scrive la scheda.
   *
   * L'ordine conta: se il caricamento fallisce non resta una scheda che punta a
   * un file inesistente. Il caso opposto — file caricato e scheda mancante —
   * lascia un orfano su Storage, meno grave e visibile dalla console.
   */
  async upload({ uid, file, categoria, description, onProgress }: UploadRequest): Promise<void> {
    const id = doc(this.collectionOf(uid)).id;
    const storagePath = `clients/${uid}/documents/${id}-${safeFileName(file.name)}`;
    const task = uploadBytesResumable(ref(getFirebaseStorage(), storagePath), file, {
      contentType: file.type || 'application/octet-stream',
    });

    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        (snapshot) =>
          onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
        reject,
        () => resolve()
      );
    });

    await setDoc(doc(this.collectionOf(uid), id), {
      name: file.name,
      description: description.trim(),
      categoria,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      storagePath,
      uploadedAt: new Date().toISOString(),
      uploadedBy: this.auth.user()?.email ?? '',
    });
  }

  /**
   * URL di download, valido pochi minuti.
   *
   * Le regole di Storage negano la lettura diretta anche ai referenti Revna: il
   * link lo rilascia la function, che verifica chi sta chiedendo. Niente URL
   * permanenti in giro.
   */
  async downloadUrl(uid: string, documentId: string): Promise<string> {
    const call = httpsCallable<{ uid: string; documentId: string }, { url: string }>(
      getFirebaseFunctions(),
      'getDocumentUrl'
    );
    const { data } = await call({ uid, documentId });
    return data.url;
  }

  /** Prima il file, poi la scheda: se il file resta, la scheda punterebbe al vuoto. */
  async remove(uid: string, document: ClientDocument): Promise<void> {
    await deleteObject(ref(getFirebaseStorage(), document.storagePath)).catch(() => {
      // Il file può essere già sparito: la scheda va rimossa comunque.
    });
    await deleteDoc(doc(this.collectionOf(uid), document.id));
  }
}
