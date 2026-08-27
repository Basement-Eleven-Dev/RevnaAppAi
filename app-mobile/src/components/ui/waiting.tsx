import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Brand, Duration, Ink, Spacing } from '@/theme';

/**
 * L'attesa (Componenti · 03): puntini prima del primo pezzo, caret mentre scrive.
 *
 * Sono due stati diversi e si vedono diversi: finché non è arrivato niente non
 * c'è testo a cui attaccare un cursore, e un cursore da solo in mezzo al vuoto
 * non dice che la domanda è partita.
 */

/** Tre puntini, fra l'invio e il primo pezzo di risposta. */
export function TypingDots() {
  // `useState` con inizializzatore e non `useRef().current`: i valori nascono una
  // volta sola e non si legge una ref durante il render.
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.25)));

  useEffect(() => {
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(dot, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.25, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - index) * 160),
        ])
      )
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [dots]);

  return (
    <View style={styles.dots}>
      {dots.map((dot, index) => (
        <Animated.View key={index} style={[styles.dot, { opacity: dot }]} />
      ))}
    </View>
  );
}

/**
 * Il caret dello streaming: **l'unica cosa arancione che pulsa nell'app**.
 * Significa «sta scrivendo adesso», e per questo nient'altro deve lampeggiare.
 */
export function StreamCaret() {
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.15, duration: Duration.pulse, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: Duration.pulse, useNativeDriver: true }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [opacity]);

  return <Animated.View style={[styles.caret, { opacity }]} />;
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 5, paddingVertical: Spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Ink.secondary },
  caret: { width: 8, height: 16, marginTop: Spacing.xs, backgroundColor: Brand.accent },
});
