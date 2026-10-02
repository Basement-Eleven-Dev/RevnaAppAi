import { HttpsError } from 'firebase-functions/v2/https';

import { db } from './admin';

/**
 * Quanti messaggi un cliente può mandare all'assistente.
 *
 * Non è una tariffa, è un argine contro un client impazzito o usato per far spendere
 * il modello a raffica: chi scrive davvero aspetta ogni risposta, e non arriva a dieci
 * domande in un minuto né a duecento in una giornata.
 */
export const LIMITE_MINUTO = 10;
export const LIMITE_GIORNO = 200;

/**
 * Il contatore di un cliente, in `assistantUsage/{uid}`. Le finestre sono fisse: il
 * minuto dell'orologio e il giorno di calendario italiano, così «riprova domani»
 * vuol dire quello che dice.
 */
export type Usage = {
  minuto: string;
  nelMinuto: number;
  giorno: string;
  nelGiorno: number;
};

/** Il giorno di calendario italiano, come `2026-10-01`. */
export const giornoItaliano = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' });

/**
 * Il contatore dopo un messaggio in più, o quale limite lo impedisce.
 *
 * Un contatore assente o illeggibile riparte da zero: meglio un messaggio in più
 * che un cliente bloccato da un documento rovinato.
 */
export function consume(
  stored: Partial<Usage> | undefined,
  now: Date,
): { usage: Usage } | { superato: 'minuto' | 'giorno' } {
  const minuto = now.toISOString().slice(0, 16);
  const giorno = giornoItaliano.format(now);

  const nelMinuto = stored?.minuto === minuto ? (stored.nelMinuto ?? 0) : 0;
  const nelGiorno = stored?.giorno === giorno ? (stored.nelGiorno ?? 0) : 0;

  if (nelGiorno >= LIMITE_GIORNO) return { superato: 'giorno' };
  if (nelMinuto >= LIMITE_MINUTO) return { superato: 'minuto' };

  return { usage: { minuto, nelMinuto: nelMinuto + 1, giorno, nelGiorno: nelGiorno + 1 } };
}

/**
 * Conta un messaggio del cliente, o lo rifiuta se ha superato un limite.
 *
 * Si conta prima di chiamare il modello, ed è voluto: una domanda che poi fallisce
 * conta lo stesso, perché quello che l'argine protegge è il numero di chiamate. In
 * transazione perché due messaggi partiti insieme devono contare due.
 *
 * La collezione non ha regole sue: la chiude quella finale, e la scrive solo l'Admin SDK.
 */
export async function countMessage(uid: string): Promise<void> {
  const ref = db.collection('assistantUsage').doc(uid);

  const esito = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const result = consume(snapshot.data() as Partial<Usage> | undefined, new Date());
    if ('usage' in result) tx.set(ref, result.usage);
    return result;
  });

  if ('superato' in esito) {
    throw new HttpsError(
      'resource-exhausted',
      esito.superato === 'giorno'
        ? `Hai raggiunto i ${LIMITE_GIORNO} messaggi di oggi: potrai riprendere domani.`
        : 'Stai scrivendo molto velocemente: aspetta un minuto e riprova.',
    );
  }
}
