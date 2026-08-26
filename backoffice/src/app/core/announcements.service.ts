import { Injectable } from '@angular/core';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';

import { getFirebaseDb, getFirebaseFunctions, getFirebaseStorage } from './firebase';
import { toAnnouncement, type Announcement, type Destinatari } from './announcements.model';
import { safeFileName } from './documents.model';

/** Oltre questo non si scorre più: le comunicazioni utili sono le recenti. */
const MAX_LISTED = 300;

export type SaveRequest = {
  /** L'id lo decide l'editor anche per una comunicazione nuova: vedi `newId`. */
  id: string;
  titolo: string;
  corpo: string;
  destinatari: Destinatari;
};

export type SendResult = {
  destinatari: number;
  /** Quante notifiche il servizio push ha accettato: può essere 0 e va detto. */
  notificati: number;
  dispositivi: number;
};

@Injectable({ providedIn: 'root' })
export class AnnouncementsService {
  private readonly saveFn = httpsCallable<SaveRequest, { id: string }>(
    getFirebaseFunctions(),
    'saveAnnouncement'
  );

  private readonly sendFn = httpsCallable<{ id: string }, SendResult>(
    getFirebaseFunctions(),
    'sendAnnouncement'
  );

  private readonly deleteFn = httpsCallable<{ id: string }, { ok: true }>(
    getFirebaseFunctions(),
    'deleteAnnouncement'
  );

  private collectionRef() {
    return collection(getFirebaseDb(), 'announcements');
  }

  /**
   * Un id nuovo, generato in locale.
   *
   * Serve prima del primo salvataggio: le immagini che si incollano nel testo vanno su
   * Storage sotto `announcements/{id}/`, e quel percorso l'id lo pretende subito. Gli
   * id di Firestore si generano dal client senza toccare la rete, e il server accetta
   * l'id che gli si passa (vedi `saveAnnouncement`).
   */
  newId(): string {
    return doc(this.collectionRef()).id;
  }

  /**
   * Le comunicazioni, dalla più recente. Lettura diretta da Firestore, come il profilo
   * e le schede dei documenti: le regole aprono `announcements` in lettura ai referenti
   * Revna. Ordinate per creazione e non per invio, così le bozze non finiscono in fondo.
   */
  async list(): Promise<Announcement[]> {
    const snapshot = await getDocs(query(this.collectionRef(), orderBy('createdAt', 'desc')));
    return snapshot.docs
      .slice(0, MAX_LISTED)
      .map((document) => toAnnouncement(document.id, document.data()));
  }

  async get(id: string): Promise<Announcement | null> {
    const snapshot = await getDoc(doc(this.collectionRef(), id));
    return snapshot.exists() ? toAnnouncement(snapshot.id, snapshot.data()) : null;
  }

  async save(request: SaveRequest): Promise<string> {
    const { data } = await this.saveFn(request);
    return data.id;
  }

  /** Consegna e notifica. Torna i numeri della consegna, che la pagina mostra. */
  async send(id: string): Promise<SendResult> {
    const { data } = await this.sendFn({ id });
    return data;
  }

  /** Ritira: via l'originale, le copie consegnate e le immagini. */
  async remove(id: string): Promise<void> {
    await this.deleteFn({ id });
  }

  /**
   * Carica un'immagine da mettere nel testo e torna il suo indirizzo.
   *
   * È un download URL di Firebase e non un URL firmato come per i documenti: dentro un
   * testo l'indirizzo dev'essere stabile, perché lo caricherà il telefono di ogni
   * cliente che apre l'avviso, magari fra un mese. La conseguenza — chi ha il link vede
   * l'immagine anche senza essere cliente Revna — è scritta nelle regole di Storage:
   * qui ci vanno grafici e foto, non report riservati.
   */
  async uploadImage(
    announcementId: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<string> {
    const path = `announcements/${announcementId}/${Date.now()}-${safeFileName(file.name)}`;
    const task = uploadBytesResumable(ref(getFirebaseStorage(), path), file, {
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

    return getDownloadURL(task.snapshot.ref);
  }
}
