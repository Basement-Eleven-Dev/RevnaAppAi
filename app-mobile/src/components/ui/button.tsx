import { StyleSheet, View, type PressableProps } from 'react-native';

import { Bevel } from '@/components/ui/bevel';
import { Tap } from '@/components/ui/motion';
import { Text } from '@/components/ui/text';
import { Brand, Corner, Danger, Family, Ink, Line, Spacing, Surface, TouchTarget } from '@/theme';

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
 *
 * Sotto i 44pt l'area toccabile cresce attorno al quadrato con un margine negativo,
 * senza spostarlo: `hitSlop` farebbe lo stesso, ma sul web non vale.
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
  const grow = Math.max(0, (TouchTarget - size) / 2);

  return (
    <Tap accessibilityRole="button" {...rest} style={{ padding: grow, margin: -grow }}>
      <Bevel
        radius={size >= 40 ? Corner.control : Corner.badge + 3}
        fill={tone === 'accent' ? Brand.accent : Surface.control}
        style={[styles.icon, { width: size, height: size }]}>
        <View style={styles.iconInner}>{children}</View>
      </Bevel>
    </Tap>
  );
}

/**
 * L'azione scritta: un link di una riga come «Password dimenticata?» o «Modifica».
 *
 * Il testo resta dov'è e l'area toccabile gli cresce attorno fino ai 44pt, come per
 * `IconButton`. I figli sono il `Text` dell'azione, con lo stile del punto in cui sta.
 * Niente `style`: un margine del chiamante annullerebbe quello negativo, quindi la
 * posizione si dà a una `View` attorno.
 */
export function TextAction({
  children,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & { children: React.ReactNode }) {
  return (
    // Lo stile dopo le props: `Link asChild` ne passa uno suo che toglierebbe l'area.
    <Tap accessibilityRole="button" {...rest} style={styles.textAction}>
      {children}
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
  // 16pt di riga + 2 × 14 = 44; il margine negativo lascia l'impaginazione com'era.
  // Sotto i 16pt di riga l'altezza minima fa il resto.
  textAction: {
    paddingVertical: 14,
    marginVertical: -14,
    paddingHorizontal: Spacing.sm,
    marginHorizontal: -Spacing.sm,
    minWidth: TouchTarget,
    minHeight: TouchTarget,
    justifyContent: 'center',
  },
  iconInner: { alignItems: 'center', justifyContent: 'center' },
});
