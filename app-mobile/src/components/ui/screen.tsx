import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Appear } from '@/components/ui/motion';
import { Card } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Brand, Danger, Gutter, Ink, MaxContentWidth, Spacing, Surface } from '@/theme';

/**
 * L'impaginazione di una schermata.
 *
 * Il fondo è il nero base e la colonna del contenuto ha una larghezza massima:
 * l'app è verticale, ma sul web e su tablet una riga di testo larga tutto lo
 * schermo non si legge.
 */
export function Screen({ style, children, ...rest }: ViewProps) {
  return (
    <View style={styles.root} {...rest}>
      <View style={[styles.column, style]}>{children}</View>
    </View>
  );
}

/**
 * La schermata di un modulo ancorato in basso, come quelle d'accesso.
 *
 * Su iOS la tastiera copre il fondo dello schermo, cioè proprio i campi e il
 * bottone: qui il contenuto si accorcia della tastiera e, se non ci sta più,
 * scorre. `handled` lascia arrivare il tocco al bottone anche a tastiera aperta,
 * invece di spenderlo per chiuderla.
 */
export function FormScreen({ style, children, ...rest }: ViewProps) {
  return (
    <Screen {...rest}>
      <KeyboardAvoidingView
        style={styles.grow}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.form, style]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/**
 * La barra in cima a ogni schermata: quello che sta a sinistra apre il pannello
 * laterale o torna indietro, quello che sta a destra è l'azione della schermata.
 *
 * Lo spazio della status bar si prende qui e non con una `SafeAreaView` attorno a
 * tutto: sotto, il contenuto deve poter scorrere fino al bordo.
 */
export function ScreenBar({
  left,
  right,
  children,
  style,
  ...rest
}: ViewProps & { left?: React.ReactNode; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + Spacing.md }, style]} {...rest}>
      {left}
      <View style={styles.barMiddle}>{children}</View>
      {right}
    </View>
  );
}

/**
 * Il titolo di una sezione, con il suo sottotitolo.
 *
 * Il sottotitolo in accento è il conteggio di ciò che aspetta l'utente — «2 da
 * leggere» — e prende il posto della descrizione: è il motivo per cui si è qui.
 */
export function PageHeading({
  title,
  subtitle,
  accent = false,
  style,
}: {
  title: string;
  subtitle?: string;
  accent?: boolean;
  style?: ViewProps['style'];
}) {
  return (
    <View style={[styles.heading, style]}>
      <Text variant="title">{title}</Text>
      {subtitle ? (
        <Text variant="service" color={accent ? Brand.accent : Ink.secondary}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Il riquadro di una sezione vuota: cosa manca, e cosa si può fare.
 *
 * Entra in scena da sé, e non è una decorazione: al posto di questo riquadro un
 * istante prima c'era una rotella, e «non c'è niente» sbattuto in faccia al posto
 * di «sto guardando» si legge come un errore. Entrando dice che la risposta è
 * arrivata, ed è questa.
 */
export function EmptyState({
  icon,
  text,
  children,
}: {
  icon?: React.ReactNode;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <Appear>
      <Card style={styles.empty}>
        {icon}
        <Text variant="service" color={Ink.secondary} style={styles.emptyText}>
          {text}
        </Text>
        {children}
      </Card>
    </Appear>
  );
}

/**
 * L'attesa dei dati, uguale in tutta l'app: dove arriverà il contenuto, o a tutta
 * pagina (`fill`) quando non c'è ancora niente da impaginare.
 */
export function Loading({ fill = false, style }: { fill?: boolean; style?: ViewProps['style'] }) {
  return (
    <View style={[fill ? styles.fill : styles.loading, style]}>
      <ActivityIndicator color={Brand.accent} />
    </View>
  );
}

/** Un errore, dove è successo. Un solo rosso funzionale, mai vicino all'accento. */
export function ErrorNote({ children }: { children: string }) {
  return (
    <Text variant="service" color={Danger.text}>
      {children}
    </Text>
  );
}

export const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', justifyContent: 'center', backgroundColor: Surface.base },
  column: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  grow: { flex: 1 },
  form: { flexGrow: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Gutter,
    paddingBottom: Spacing.md + 2,
  },
  barMiddle: { flex: 1 },
  heading: { gap: Spacing.sm },
  empty: { alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.xxl },
  emptyText: { textAlign: 'center', maxWidth: 280 },
  loading: { alignItems: 'center', paddingVertical: Spacing.lg },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Surface.base },
});
