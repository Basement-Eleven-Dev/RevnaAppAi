import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Conferma } from '../../components/conferma/conferma';
import { CATEGORIE_DOCUMENTO, categoriaLabel, formatSize, type ClientDocument } from '../../core/documents.model';
import { DocumentsService } from '../../core/documents.service';

@Component({
  selector: 'app-client-documents',
  imports: [ReactiveFormsModule, RouterLink, Conferma],
  templateUrl: './client-documents.html',
  styleUrl: './client-documents.css',
})
export class ClientDocuments {
  private readonly documents = inject(DocumentsService);

  protected readonly uid = inject(ActivatedRoute).snapshot.paramMap.get('uid') ?? '';
  protected readonly categorie = CATEGORIE_DOCUMENTO;
  protected readonly categoriaLabel = categoriaLabel;
  protected readonly formatSize = formatSize;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    categoria: ['report'],
    description: [''],
  });

  protected readonly list = signal<ClientDocument[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  /** Il documento di cui si sta chiedendo conferma dell'eliminazione. */
  protected readonly daEliminare = signal<string | null>(null);
  /** Nome del file in caricamento e percentuale, per la barra di avanzamento. */
  protected readonly uploading = signal('');
  protected readonly progress = signal(0);

  constructor() {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    try {
      this.list.set(await this.documents.list(this.uid));
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.loading.set(false);
    }
  }

  /** Un file alla volta, in sequenza: la barra resta leggibile e gli errori isolati. */
  protected async onFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;

    this.error.set('');
    const { categoria, description } = this.form.getRawValue();

    for (const file of files) {
      this.uploading.set(file.name);
      this.progress.set(0);
      try {
        await this.documents.upload({
          uid: this.uid,
          file,
          categoria,
          description,
          onProgress: (percent) => this.progress.set(percent),
        });
      } catch (cause) {
        this.error.set(`${file.name}: ${message(cause)}`);
        break;
      }
    }

    this.uploading.set('');
    input.value = '';
    this.form.controls.description.reset();
    await this.reload();
  }

  protected async open(document: ClientDocument): Promise<void> {
    try {
      window.open(await this.documents.downloadUrl(this.uid, document.id), '_blank');
    } catch (cause) {
      this.error.set(message(cause));
    }
  }

  protected async remove(document: ClientDocument): Promise<void> {
    this.daEliminare.set(null);

    try {
      await this.documents.remove(this.uid, document);
      await this.reload();
    } catch (cause) {
      this.error.set(message(cause));
    }
  }

  protected date(iso: string): string {
    return iso ? new Date(iso).toLocaleDateString('it-IT') : '—';
  }
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Operazione non riuscita.';
}
