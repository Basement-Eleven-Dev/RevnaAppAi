/**
 * Avvisi: le comunicazioni che Revna manda ai suoi clienti.
 *
 * Quello che l'app legge è la **copia consegnata** a questo cliente, in
 * `users/{uid}/announcements/{id}`, non l'originale: l'originale sta in
 * `announcements` e porta con sé l'elenco dei destinatari, cioè chi altro è cliente
 * Revna. Sul telefono di ciascuno arriva solo il suo avviso (vedi
 * `backend/functions/src/announcements.ts`).
 *
 * I tipi ricalcano quelli del backend, come già fanno profilo, documenti e richieste:
 * poche righe duplicate invece di un pacchetto condiviso.
 */

export type Announcement = {
  id: string;
  titolo: string;
  /** Markdown, scritto dal backoffice e reso da `components/markdown.tsx`. */
  corpo: string;
  /** Prime righe in chiaro: è quello che si legge nell'elenco senza aprire l'avviso. */
  estratto: string;
  inviatoAt: string;
  /** `null` finché il cliente non l'ha aperto: è il pallino rosso. */
  lettoAt: string | null;
};

/** Quanti avvisi tenere nell'elenco: oltre, non è più uno storico che si scorre. */
export const MAX_LISTED = 100;

export function isUnread(announcement: Announcement): boolean {
  return announcement.lettoAt === null;
}
