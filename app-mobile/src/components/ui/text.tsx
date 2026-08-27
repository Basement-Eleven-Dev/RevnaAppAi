import { Text as RNText, type TextProps } from 'react-native';

import { Type, type TypeRole } from '@/theme';

export type Props = TextProps & {
  /** Uno dei nove ruoli del sistema (vedi `theme/typography.ts`). */
  variant?: TypeRole;
  /** Il colore, quando serve diverso da quello che il ruolo porta con sé. */
  color?: string;
};

/**
 * Il testo dell'app. Il ruolo porta con sé misura, peso, tracking e colore: una
 * schermata sceglie un ruolo, non sei valori.
 */
export function Text({ variant = 'body', color, style, ...rest }: Props) {
  return <RNText style={[Type[variant], color ? { color } : null, style]} {...rest} />;
}

