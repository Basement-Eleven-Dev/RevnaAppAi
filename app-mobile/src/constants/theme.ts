/**
 * Palette e token di base dell'app Revna AI.
 * I colori del brand vanno allineati al brand book Revna (docs/Visual Identity revna.pdf)
 * man mano che viene consegnato: qui sono impostati i valori ricavati dai loghi.
 */

import '@/global.css';

import { Platform } from 'react-native';

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

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

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
