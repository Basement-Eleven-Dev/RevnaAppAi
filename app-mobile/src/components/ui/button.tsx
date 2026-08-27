import { StyleSheet, View, type PressableProps } from 'react-native';

import { Bevel } from '@/components/ui/bevel';
import { Tap } from '@/components/ui/motion';
import { Text } from '@/components/ui/text';
import { Brand, Corner, Danger, Family, Ink, Line, Spacing, Surface } from '@/theme';

/**
 * Le azioni del sistema (Componenti · 03).
 *
 * Tre pesi e nient'altro: **piena** per l'azione che chiude una schermata,
 * **secondaria** per quella che si può anche non fare, **contorno** per l'azione
 * in accento che non deve pesare come un bottone pieno.
 *
 * Più un fuori scala, `danger`, che non è un quarto peso ma un altro colore: l'azione
 * che distrugge qualcosa. Non può prendere il peso «piena», perché qui l'arancio pieno
 * è l'azione che si vuole fare, e cancellare non lo è mai.
 *
 * L'azione disabilitata resta a schermo, spenta: sparire vorrebbe dire far
 * cercare all'utente cosa è cambiato. La risposta al tocco la porta `Tap`, uguale
 * in tutta l'app: qui resta solo lo spegnimento del disabilitato, che è uno stato
 * e non un movimento.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: ButtonVariant;
  /** Occupa tutta la larghezza disponibile. Vero per le azioni di una schermata. */
  block?: boolean;
  loading?: boolean;
  /** Etichetta mostrata al posto della solita mentre l'azione è in corso. */
  loadingLabel?: string;
};

export function Button({
  label,
  variant = 'primary',
  block = true,
  loading = false,
  loadingLabel,
  disabled,
  ...rest
}: Props) {
  const off = disabled === true || loading;
  const skin = SKINS[variant];

  return (
    <Tap accessibilityRole="button" disabled={off} {...rest}>
      <Bevel
        radius={Corner.control}
        fill={skin.fill}
        stroke={skin.stroke}
        style={[styles.button, block ? styles.block : styles.inline, off && styles.off]}>
        <Text variant="body" color={skin.label} style={styles.label}>
          {loading ? (loadingLabel ?? label) : label}
        </Text>
      </Bevel>
    </Tap>
  );
}

/**
 * Bottone icona: il quadrato smussato. Piena in accento quando è l'azione
 * principale (invia), spenta quando è di servizio (menu, indietro, nuova chat).
 */
export function IconButton({
  children,
  tone = 'ghost',
  size = 30,
  ...rest
}: Omit<PressableProps, 'style'> & {
  tone?: 'accent' | 'ghost';
  size?: number;
  children: React.ReactNode;
}) {
  return (
    <Tap accessibilityRole="button" hitSlop={8} {...rest}>
      <Bevel
        radius={size >= 40 ? Corner.control : Corner.badge + 3}
        fill={tone === 'accent' ? Brand.accent : Surface.control}
        style={[styles.icon, { width: size, height: size }]}>
        <View style={styles.iconInner}>{children}</View>
      </Bevel>
    </Tap>
  );
}

const SKINS: Record<ButtonVariant, { fill: string; stroke?: string; label: string }> = {
  primary: { fill: Brand.accent, label: Ink.onAccent },
  secondary: { fill: Surface.control, label: Ink.primary },
  outline: { fill: Surface.accentTint, stroke: Line.accentStrong, label: Brand.accent },
  danger: { fill: Danger.wash, stroke: Danger.line, label: Danger.text },
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: Spacing.lg - 2,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: { alignSelf: 'stretch' },
  inline: { alignSelf: 'flex-start' },
  off: { opacity: 0.45 },
  // 14 semibold, come tutte le etichette d'azione del sistema.
  label: { fontFamily: Family.sansSemibold, fontSize: 14, lineHeight: 16 },
  icon: { alignItems: 'center', justifyContent: 'center' },
  iconInner: { alignItems: 'center', justifyContent: 'center' },
});
