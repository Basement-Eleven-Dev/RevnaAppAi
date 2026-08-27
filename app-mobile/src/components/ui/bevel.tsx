import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { bevelPath } from '@/theme';

type Props = ViewProps & {
  /** Una delle quattro misure di `Bevel`: superficie, card, controllo, badge. */
  radius: number;
  fill?: string;
  /** Bordo su tutto il contorno, diagonale compresa. */
  stroke?: string;
  strokeWidth?: number;
  /**
   * La linea di luce del vetro: solo il lato in alto e la diagonale che lo
   * chiude. Serve a dire che l'elemento galleggia, e va da sé che sotto il bordo
   * non ci sia.
   */
  highlight?: string;
  /**
   * Il colore di ciò che sta dietro, ridipinto **sopra** i due angoli tagliati.
   *
   * Serve dove il contenuto è opaco e arriva fino al bordo — una copertina, una
   * foto — perché in React Native non si può ritagliare una `View` con una forma:
   * `overflow: 'hidden'` conosce solo il rettangolo e gli angoli tondi. Due
   * triangoli del colore del fondo fanno la stessa cosa che farebbe una maschera,
   * e la fanno su tutte le piattaforme.
   */
  mask?: string;
};

/**
 * Il box smussato: **l'unico** posto dell'app in cui la smussatura è disegnata.
 *
 * In React Native `clip-path` non esiste, quindi la forma è un `Path` di
 * `react-native-svg` dietro il contenuto, che fa sia riempimento sia bordo: così
 * la diagonale ha il filo come gli altri lati, invece di essere un taglio senza
 * contorno.
 *
 * Il `Path` ha bisogno di misure in pixel, e le misure arrivano dal layout: il
 * fondo compare quindi un frame dopo il contenuto. È il prezzo di avere una sola
 * implementazione della forma, e a occhio non si vede — mentre un fondo colorato
 * con angoli quadrati, dove il sistema ne vuole due smussati, si vede sempre.
 */
export function Bevel({
  radius,
  fill,
  stroke,
  strokeWidth = 1,
  highlight,
  mask,
  style,
  children,
  onLayout,
  ...rest
}: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  function measure(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    // Solo a misura cambiata: `setState` a ogni layout rimonterebbe l'SVG a ogni
    // scroll che ricalcola la riga.
    if (width !== size.width || height !== size.height) setSize({ width, height });
    onLayout?.(event);
  }

  // Il bordo si disegna sul filo interno: metà tratto fuori dal box sarebbe
  // tagliato dal contenitore, e i due lati risulterebbero di spessore diverso.
  const inset = stroke ? strokeWidth / 2 : 0;
  const drawable = size.width > 0 && size.height > 0;

  return (
    <View style={style} onLayout={measure} {...rest}>
      {drawable && (
        <Svg
          width={size.width}
          height={size.height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none">
          <Path
            d={bevelPath(size.width - inset * 2, size.height - inset * 2, radius - inset)}
            translate={[inset, inset]}
            fill={fill ?? 'none'}
            stroke={stroke}
            strokeWidth={stroke ? strokeWidth : undefined}
          />
          {highlight && (
            <Path
              d={`M 0 ${radius} L ${radius} 0 L ${size.width} 0`}
              fill="none"
              stroke={highlight}
              strokeWidth={1}
            />
          )}
        </Svg>
      )}
      {children}
      {mask && drawable && (
        <Svg
          width={size.width}
          height={size.height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none">
          <Path
            d={`M 0 0 L ${radius} 0 L 0 ${radius} Z`}
            fill={mask}
          />
          <Path
            d={`M ${size.width} ${size.height} L ${size.width} ${size.height - radius} L ${size.width - radius} ${size.height} Z`}
            fill={mask}
          />
        </Svg>
      )}
    </View>
  );
}
