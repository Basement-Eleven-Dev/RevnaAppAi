/**
 * La tipografia del sistema Revna (Tipografia · 02).
 *
 * Funnel Display per i titoli — 600 e 700, tracking negativo — e Funnel Sans per
 * tutto il resto. Ogni peso del font è un file, e quindi una famiglia a sé: il
 * peso si scrive nel nome della famiglia e `fontWeight` resta fuori, altrimenti
 * il sistema mette un finto grassetto sopra un font che è già quello giusto.
 *
 * I ruoli sono nove e non c'è misura intermedia. Sei sono i livelli delle
 * fondamenta — display, titolo, sezione, corpo, servizio, micro — e tre sono gli
 * elementi ricorrenti che nel sistema hanno una misura propria: il titolo di una
 * riga d'elenco, il numero grande di una statistica, l'etichetta della tab bar.
 * Il monospace compare solo sui numeri delle fonti.
 */

import {
  FunnelDisplay_600SemiBold,
  FunnelDisplay_700Bold,
} from '@expo-google-fonts/funnel-display';
import {
  FunnelSans_400Regular,
  FunnelSans_400Regular_Italic,
  FunnelSans_500Medium,
  FunnelSans_600SemiBold,
  FunnelSans_700Bold,
  FunnelSans_700Bold_Italic,
} from '@expo-google-fonts/funnel-sans';
import { Platform, type TextStyle } from 'react-native';

import { Ink } from './palette';

/**
 * I file da caricare all'avvio (vedi `src/app/_layout.tsx`).
 *
 * Solo i pesi che il sistema usa davvero: due per Display, quattro per Sans più
 * i due corsivi che servono al markdown delle risposte.
 */
export const FontAssets = {
  FunnelDisplay_600SemiBold,
  FunnelDisplay_700Bold,
  FunnelSans_400Regular,
  FunnelSans_500Medium,
  FunnelSans_600SemiBold,
  FunnelSans_700Bold,
  FunnelSans_400Regular_Italic,
  FunnelSans_700Bold_Italic,
} as const;

/** Le famiglie, per nome: è così che si sceglie un peso. */
export const Family = {
  displaySemibold: 'FunnelDisplay_600SemiBold',
  displayBold: 'FunnelDisplay_700Bold',
  sans: 'FunnelSans_400Regular',
  sansMedium: 'FunnelSans_500Medium',
  sansSemibold: 'FunnelSans_600SemiBold',
  sansBold: 'FunnelSans_700Bold',
  sansItalic: 'FunnelSans_400Regular_Italic',
  sansBoldItalic: 'FunnelSans_700Bold_Italic',
  /** Il monospace di sistema: nessun font del brand è a spaziatura fissa. */
  mono:
    Platform.select({
      ios: 'ui-monospace',
      android: 'monospace',
      default: 'monospace',
      web: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    }) ?? 'monospace',
} as const;

/**
 * I nove ruoli del testo. Il colore fa parte del ruolo: «servizio» non è solo
 * 13/19, è 13/19 al 56% — separarli vorrebbe dire deciderlo di nuovo ogni volta.
 */
export const Type = {
  /** Il lettering di una schermata d'ingresso. Uno per schermata, mai due. */
  display: {
    fontFamily: Family.displayBold,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.2,
    color: Ink.primary,
  },
  /** Il titolo di una sezione dell'app: è il punto d'ingresso per l'occhio. */
  title: {
    fontFamily: Family.displaySemibold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.7,
    color: Ink.primary,
  },
  /** Un titolo dentro il contenuto: paragrafi di un avviso, blocchi di una scheda. */
  section: {
    fontFamily: Family.displaySemibold,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.29,
    color: Ink.primary,
  },
  /** Il titolo di una riga d'elenco: avviso, documento, conversazione. */
  rowTitle: {
    fontFamily: Family.displaySemibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
    color: Ink.primary,
  },
  /** Il numero grande di una statistica. */
  stat: {
    fontFamily: Family.displayBold,
    fontSize: 26,
    lineHeight: 28,
    letterSpacing: -0.78,
    color: Ink.primary,
  },
  /** Il corpo del testo: risposte, avvisi, descrizioni lunghe. */
  body: {
    fontFamily: Family.sans,
    fontSize: 15,
    lineHeight: 23,
    color: Ink.body,
  },
  /** Testo di servizio: sottotitoli, etichette di scheda, aiuti, date lunghe. */
  service: {
    fontFamily: Family.sansMedium,
    fontSize: 13,
    lineHeight: 19,
    color: Ink.secondary,
  },
  /** Occhiello: sopra un titolo, in cima a un blocco, come stato di una riga. */
  micro: {
    fontFamily: Family.sansSemibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
    color: Ink.faint,
  },
  /** L'etichetta di una tab: la misura più piccola che l'app usa. */
  tab: {
    fontFamily: Family.sansSemibold,
    fontSize: 10,
    lineHeight: 12,
    color: Ink.muted,
  },
  /** Il numero di una fonte, dentro il testo e nel suo chip. */
  mono: {
    fontFamily: Family.mono,
    fontSize: 10,
    lineHeight: 12,
    color: Ink.faint,
  },
} as const satisfies Record<string, TextStyle>;

export type TypeRole = keyof typeof Type;
