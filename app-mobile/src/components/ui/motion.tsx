import { useEffect } from 'react';
import { Pressable, type PressableProps, type ViewProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Curve, Duration, PRESSED_OPACITY, PRESSED_SCALE, Rise, Stagger } from '@/theme';

/**
 * Il movimento del sistema (Componenti · 03): **l'unico** posto in cui è scritto.
 *
 * Due cose sole, perché sono le due che l'app fa continuamente: rispondere a un
 * tocco (`Tap`) e far entrare in scena qualcosa che prima non c'era (`Appear`).
 * Tutto il resto — il caret, i puntini d'attesa — sta in `waiting.tsx`, perché
 * quello non è movimento, è uno stato.
 *
 * Sono animazioni su valori condivisi e non `entering` di Reanimated: la stessa
 * riga di codice funziona su iOS, Android e web, e senza le layout animation non
 * c'è un elenco che si riordina sotto le dita mentre ci si scorre dentro.
 *
 * Rispettano «Riduci movimento» del sistema operativo senza che si debba dire:
 * `withTiming` di Reanimated legge quell'impostazione da sé e salta alla fine.
 */

/**
 * Tutto ciò che si tocca nell'app.
 *
 * Sotto il dito la superficie **si spegne e cede**: opacità al 62% e scala al
 * 97,7%, in 120 ms sulla curva del sistema, e ritorno in 180 ms. Il salto secco
 * d'opacità che c'era prima diceva la stessa cosa — «ho ricevuto il tocco» — ma
 * la diceva come una pagina web: la mano non sente niente, quindi tocca allo
 * schermo far sentire qualcosa, e un cambio istantaneo non è un movimento.
 *
 * Il movimento sta su una `Animated.View` **dentro** il `Pressable`, e non sul
 * `Pressable` reso animato: un componente composito non espone il nodo nativo su
 * cui Reanimated scrive ogni frame, quindi lo stile arriverebbe solo al primo
 * render e il tocco resterebbe fermo (misurato: sul web non si muove affatto).
 * La `View` in mezzo non tocca l'impaginazione — non ha stile proprio, quindi si
 * comporta come il figlio che avvolge.
 */
export function Tap({
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: ViewProps['style'];
  /**
   * I figli, e non la funzione `({ pressed }) => …` che accetta un `Pressable`:
   * lo stato di pressione non è più una cosa che il contenuto deve sapere.
   */
  children?: React.ReactNode;
}) {
  const held = useSharedValue(0);

  const skin = useAnimatedStyle(() => ({
    opacity: 1 - held.value * (1 - PRESSED_OPACITY),
    transform: [{ scale: 1 - held.value * (1 - PRESSED_SCALE) }],
  }));

  return (
    <Pressable
      onPressIn={(event) => {
        held.value = withTiming(1, { duration: Duration.tap, easing: Curve });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        held.value = withTiming(0, { duration: Duration.release, easing: Curve });
        onPressOut?.(event);
      }}
      style={style}
      {...rest}>
      <Animated.View style={skin}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * Qualcosa che entra in scena: sale di 8px e si accende, in 220 ms.
 *
 * Serve dove il contenuto **arriva**, non dove c'è già: un elenco che sostituisce
 * la rotella, una risposta che si aggiunge alla conversazione, un foglio che si
 * apre. In quel punto l'alternativa non è «nessuna animazione», è il contenuto
 * che compare di colpo a metà di un'altra cosa — che è esattamente ciò che fa
 * sembrare un'app un browser.
 *
 * Ha un secondo effetto, molto concreto in questo sistema: `Bevel` misura il
 * proprio riquadro dal layout, quindi il fondo smussato compare un frame dopo il
 * contenuto (vedi `bevel.tsx`). Dentro un'entrata quel frame è a opacità zero, e
 * quindi non si vede più.
 */
export function Appear({
  delay = 0,
  rise = Rise,
  duration = Duration.enter,
  style,
  children,
  ...rest
}: ViewProps & {
  /** Ritardo prima di partire: per le righe di un elenco, vedi `stagger`. */
  delay?: number;
  /** Di quanto sale. Un foglio arriva da più lontano di una riga d'elenco. */
  rise?: number;
  duration?: number;
}) {
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.value = withDelay(delay, withTiming(1, { duration, easing: Curve }));
  }, [delay, duration, shown]);

  const skin = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * rise }],
  }));

  return (
    <Animated.View style={[style, skin]} {...rest}>
      {children}
    </Animated.View>
  );
}

/**
 * Il ritardo della riga numero `index` di un elenco che entra in scena.
 *
 * Le prime si accendono a scaletta — è quello che fa leggere l'elenco come una
 * cosa sola che arriva, invece di sette cose che compaiono insieme — e dalla
 * settima in poi tutte con lo stesso ritardo: sotto la piega non si vedono, e
 * scaglionare fino in fondo vorrebbe dire un elenco di trenta righe che finisce
 * di entrare un secondo e mezzo dopo.
 */
export function stagger(index: number, first = 6): number {
  return Math.min(index, first) * Stagger;
}
