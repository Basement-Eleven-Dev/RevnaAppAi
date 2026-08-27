import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { Bevel } from '@/components/ui/bevel';
import { Tap } from '@/components/ui/motion';
import { Text } from '@/components/ui/text';
import { Brand, Corner, Danger, Family, Ink, Line, smoke, Spacing } from '@/theme';

type Props = TextInputProps & {
  /** Il campo lungo di una nota: cresce in altezza e allinea il testo in alto. */
  multiline?: boolean;
};

/**
 * Il campo di testo del sistema (Componenti · 03).
 *
 * In quiete ha il bordo al 10%; a fuoco il bordo diventa l'accento — è il solo
 * modo in cui l'app dice «stai scrivendo qui», e non serve altro. Il font va
 * dichiarato sul campo: un `TextInput` non passa da `Text` e con il font di
 * sistema si vedrebbe subito.
 */
export function Field({ multiline, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <Bevel
      radius={Corner.control}
      fill={smoke(0.045)}
      stroke={focused ? Brand.accent : Line.field}
      style={styles.wrap}>
      <TextInput
        style={[styles.input, multiline && styles.multiline, style]}
        placeholderTextColor={Ink.ghost}
        multiline={multiline}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        {...rest}
      />
    </Bevel>
  );
}

/**
 * Il campo password, con «Mostra» accanto.
 *
 * Senza, chi sbaglia a digitare su una tastiera del telefono non ha modo di
 * accorgersene: il rimedio è cancellare tutto e riprovare al buio. L'etichetta è
 * testo e non un occhio: dice esattamente cosa fa.
 */
export function PasswordField({
  showLabel,
  hideLabel,
  style,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps & { showLabel: string; hideLabel: string }) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <Bevel
      radius={Corner.control}
      fill={smoke(0.045)}
      stroke={focused ? Brand.accent : Line.field}
      style={[styles.wrap, styles.row]}>
      <TextInput
        style={[styles.input, styles.grow, style]}
        placeholderTextColor={Ink.ghost}
        secureTextEntry={!visible}
        autoCapitalize="none"
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        {...rest}
      />
      <Tap onPress={() => setVisible((was) => !was)} hitSlop={10} accessibilityRole="button">
        <Text variant="tab" color={Ink.muted} style={styles.reveal}>
          {visible ? hideLabel : showLabel}
        </Text>
      </Tap>
    </Bevel>
  );
}

/** Una riga di aiuto o d'errore sotto un campo. */
export function FieldNote({ children, tone = 'quiet' }: { children: string; tone?: 'quiet' | 'error' }) {
  return (
    <Text variant="service" color={tone === 'error' ? Danger.text : Ink.faint}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: Spacing.lg },
  grow: { flex: 1 },
  input: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg - 1,
    fontFamily: Family.sans,
    fontSize: 15,
    lineHeight: 20,
    color: Ink.primary,
  },
  multiline: { minHeight: 104, textAlignVertical: 'top', paddingTop: Spacing.md },
  reveal: { fontFamily: Family.sansSemibold, fontSize: 11.5 },
});

