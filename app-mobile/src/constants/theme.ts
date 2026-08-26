/**
 * Palette e token di base dell'app Revna AI.
 * I colori del brand vanno allineati al brand book Revna (docs/Visual Identity revna.pdf)
 * man mano che viene consegnato: qui sono impostati i valori ricavati dai loghi.
 */

import '@/global.css';

import {
  RethinkSans_400Regular,
  RethinkSans_400Regular_Italic,
  RethinkSans_500Medium,
  RethinkSans_600SemiBold,
  RethinkSans_700Bold,
  RethinkSans_700Bold_Italic,
  RethinkSans_800ExtraBold,
} from '@expo-google-fonts/rethink-sans';
import { Platform, type TextStyle } from 'react-native';

/** Arancio Revna, preso dai file logo in assets/images/brand. */
export const BrandColors = {
  primary: '#DD5237',
  primaryDark: '#B33F29',
  primaryLight: '#F0836D',
} as const;

export const Colors = {
  light: {
    text: '#111111',
    background: '#ffffff',
    backgroundElement: '#F4F1EF',
    backgroundSelected: '#E7E1DD',
    textSecondary: '#615A56',
    primary: BrandColors.primary,
    border: '#E2DDD9',
  },
  dark: {
    text: '#F5F2F0',
    background: '#111111',
    backgroundElement: '#1E1C1B',
    backgroundSelected: '#2B2827',
    textSecondary: '#A9A29E',
    primary: BrandColors.primaryLight,
    border: '#2E2A28',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Rethink Sans è il font del brand Revna: i file arrivano dal pacchetto
 * @expo-google-fonts/rethink-sans e vengono caricati all'avvio in src/app/_layout.tsx.
 *
 * Li carichiamo dai file invece di prenderli dalla CDN di Google anche sul web:
 * un solo modo di dire «Rethink Sans» su tutte le piattaforme, e nessuna
 * dipendenza da un dominio esterno per vedere l'app scritta come si deve.
 *
 * Dei corsivi teniamo solo due pesi: nell'app il corsivo compare nel markdown
 * delle risposte, dove serve tondo/corsivo e normale/grassetto, non cinque pesi.
 */
export const SansFontAssets = {
  RethinkSans_400Regular,
  RethinkSans_500Medium,
  RethinkSans_600SemiBold,
  RethinkSans_700Bold,
  RethinkSans_800ExtraBold,
  RethinkSans_400Regular_Italic,
  RethinkSans_700Bold_Italic,
} as const;

export type SansWeight = 400 | 500 | 600 | 700 | 800;

const SansFamily: Record<SansWeight, string> = {
  400: 'RethinkSans_400Regular',
  500: 'RethinkSans_500Medium',
  600: 'RethinkSans_600SemiBold',
  700: 'RethinkSans_700Bold',
  800: 'RethinkSans_800ExtraBold',
};

const SansItalicFamily: Record<SansWeight, string> = {
  400: 'RethinkSans_400Regular_Italic',
  500: 'RethinkSans_400Regular_Italic',
  600: 'RethinkSans_700Bold_Italic',
  700: 'RethinkSans_700Bold_Italic',
  800: 'RethinkSans_700Bold_Italic',
};

const SansWeights: SansWeight[] = [400, 500, 600, 700, 800];

/** Il peso chiesto dallo stile, tradotto nel peso più vicino fra quelli caricati. */
function nearestSansWeight(fontWeight: TextStyle['fontWeight']): SansWeight {
  if (fontWeight === 'bold') return 700;
  if (fontWeight === undefined || fontWeight === 'normal') return 400;

  const wanted = Number(fontWeight);
  if (Number.isNaN(wanted)) return 400;

  return SansWeights.reduce((closest, candidate) =>
    Math.abs(candidate - wanted) < Math.abs(closest - wanted) ? candidate : closest,
  );
}

/**
 * Rethink Sans nel peso richiesto, come stile di testo.
 *
 * Ogni peso del font è un file, e quindi una famiglia, a sé: il peso si scrive
 * nel nome della famiglia. `fontWeight` e `fontStyle` restano fuori di
 * proposito — su una famiglia che è già quella giusta il sistema ci metterebbe
 * sopra un finto grassetto (o un finto corsivo) e il testo verrebbe più pesante
 * di quanto il font prevede.
 */
export function sansStyle(weight: SansWeight = 400, italic = false): TextStyle {
  return { fontFamily: italic ? SansItalicFamily[weight] : SansFamily[weight] };
}

/**
 * Come `sansStyle`, ma il peso lo ricava da uno stile già composto: serve dove
 * il peso arriva da chi chiama il componente (vedi `ThemedText`).
 * Uno stile che dichiara già la sua famiglia — il monospace del codice — passa intatto.
 */
export function withSansFont(style: TextStyle): TextStyle {
  if (style.fontFamily !== undefined) return style;

  const { fontWeight, fontStyle, ...rest } = style;
  return { ...rest, ...sansStyle(nearestSansWeight(fontWeight), fontStyle === 'italic') };
}

export const Fonts = {
  ...Platform.select({
    ios: {
      /** iOS `UIFontDescriptorSystemDesignSerif` */
      serif: 'ui-serif',
      /** iOS `UIFontDescriptorSystemDesignRounded` */
      rounded: 'ui-rounded',
      /** iOS `UIFontDescriptorSystemDesignMonospaced` */
      mono: 'ui-monospace',
    },
    default: {
      serif: 'serif',
      rounded: 'normal',
      mono: 'monospace',
    },
    web: {
      serif: 'var(--font-serif)',
      rounded: 'var(--font-rounded)',
      mono: 'var(--font-mono)',
    },
  }),
  /** Rethink Sans regolare: il font del brand, identico su ogni piattaforma. */
  sans: SansFamily[400],
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;
