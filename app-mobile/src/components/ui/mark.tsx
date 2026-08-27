import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { MONOGRAM_BOX, MONOGRAM_PATH } from '@/components/brand/monogram';
import { AccentGlow } from '@/components/ui/glow';
import { Text } from '@/components/ui/text';
import { bevelPath, Brand, Corner, Family, Ink, Spacing } from '@/theme';

/** Il quadrato del segno è leggermente più alto che largo, come il monogramma. */
const ASPECT = 0.8;

/** Quanto del quadrato occupa il monogramma. */
const FILL_RATIO = 0.58;

/**
 * Il monogramma dentro il suo quadrato smussato arancione.
 *
 * È il segno dell'assistente: in piccolo firma ogni risposta, in grande fa da
 * segno d'attesa sulla chat vuota.
 *
 * Quadrato e monogramma stanno **in un solo `Svg`** e non in due livelli
 * sovrapposti: è un grafico unico, e disegnarlo in un colpo evita sia la
 * questione di quale livello vada sopra sia l'attesa di un layout — qui la misura
 * la sappiamo già, non c'è niente da misurare.
 *
 * `glow` è l'alone, e vale solo per il segno grande: in mezzo a una conversazione
 * una luce accanto a ogni risposta sarebbe rumore.
 */
export function Mark({ height = 22, glow = false }: { height?: number; glow?: boolean }) {
  const width = Math.round(height * ASPECT);
  const radius = height >= 40 ? Corner.card - 3 : Corner.badge + 2;

  // Il monogramma, scalato e centrato dentro il quadrato.
  const scale = (height * FILL_RATIO) / MONOGRAM_BOX.height;
  const glyph = { width: MONOGRAM_BOX.width * scale, height: MONOGRAM_BOX.height * scale };

  return (
    <View style={styles.markWrap}>
      {glow && <AccentGlow size={height * 3} opacity={0.3} top={-height} left={-height} />}
      <Svg width={width} height={height}>
        <Path d={bevelPath(width, height, radius)} fill={Brand.accent} />
        <Path
          d={MONOGRAM_PATH}
          fill={Ink.onAccent}
          translate={[(width - glyph.width) / 2, (height - glyph.height) / 2]}
          scale={scale}
        />
      </Svg>
    </View>
  );
}

/**
 * La firma di una risposta dell'assistente.
 *
 * «Generata da AI» sta qui e non in fondo alla schermata: è un requisito di
 * trasparenza e va accanto a ogni risposta, non una volta per conversazione.
 */
export function AssistantSignature({ name, disclaimer }: { name: string; disclaimer: string }) {
  return (
    <View style={styles.signature}>
      <Mark height={22} />
      <Text variant="service" color={Ink.primary} style={styles.name}>
        {name}
      </Text>
      <Text variant="micro" color={Ink.faint} style={styles.disclaimer}>
        {disclaimer}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  markWrap: { alignSelf: 'flex-start' },
  signature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm + 2,
  },
  name: { fontFamily: Family.sansSemibold, fontSize: 12 },
  disclaimer: { fontSize: 9.5, letterSpacing: 1.24 },
});
