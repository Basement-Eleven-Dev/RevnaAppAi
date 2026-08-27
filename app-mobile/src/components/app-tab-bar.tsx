import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AnnouncementsIcon,
  Appear,
  Bevel,
  BlogIcon,
  ChatIcon,
  DocumentsIcon,
  GlassBar,
  ProfileIcon,
  Tap,
  Text,
} from '@/components/ui';
import { useAnnouncements } from '@/hooks/use-announcements';
import { Brand, Corner, Family, Ink, Spacing, Surface } from '@/theme';

/** L'icona di ogni tab, nell'ordine in cui la tab bar le mostra. */
const ICONS: Record<string, (props: { color: string }) => React.ReactNode> = {
  chat: ChatIcon,
  avvisi: AnnouncementsIcon,
  documenti: DocumentsIcon,
  blog: BlogIcon,
  profilo: ProfileIcon,
};

/**
 * La barra delle sezioni, in vetro sul fondo dello schermo.
 *
 * Scritta a mano e non quella di sistema perché nel sistema Revna la tab attiva
 * non è un'icona colorata: è una tessera smussata in velatura d'accento, e la
 * smussatura di sistema non esiste. Il vetro con la linea di luce in cima dice
 * che la barra galleggia sopra il contenuto che scorre.
 *
 * Il contatore sta solo su Avvisi: è l'unica sezione in cui può arrivare qualcosa
 * che il cliente non ha chiesto, e per la stessa ragione entra in scena invece di
 * comparire: è l'unica cosa della barra che cambia mentre la si guarda.
 *
 * La tessera d'accento invece **non** si anima: non è la risposta a un tocco, è
 * dove ci si trova. Quella la racconta il cambio di schermata, che è una
 * dissolvenza (vedi `(tabs)/_layout.tsx`).
 */
export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { unread } = useAnnouncements();

  return (
    <GlassBar style={[styles.bar, { paddingBottom: insets.bottom + Spacing.sm + 2 }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const Icon = ICONS[route.name];
        const active = state.index === index;
        const badge = route.name === 'avvisi' && unread > 0 ? unread : 0;

        return (
          <Tap
            key={route.key}
            onPress={() => {
              if (!active) navigation.navigate(route.name);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={badge > 0 ? `${label}, ${badge}` : label}
            style={styles.slot}>
            <Bevel
              radius={Corner.control}
              fill={active ? Surface.accentTint : undefined}
              style={styles.item}>
              <View>
                {Icon ? <Icon color={active ? Brand.accent : Ink.muted} /> : null}
                {badge > 0 && (
                  <Appear rise={0} style={styles.badge}>
                    <Bevel radius={Corner.badge} fill={Brand.accent} style={styles.badgeFill}>
                      <Text variant="tab" color={Ink.onAccent} style={styles.badgeLabel}>
                        {badge}
                      </Text>
                    </Bevel>
                  </Appear>
                )}
              </View>
              <Text variant="tab" color={active ? Brand.accent : Ink.muted} style={styles.label}>
                {label}
              </Text>
            </Bevel>
          </Tap>
        );
      })}
    </GlassBar>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', paddingTop: Spacing.sm + 2, paddingHorizontal: Spacing.md },
  slot: { flex: 1 },
  item: { alignItems: 'center', gap: Spacing.xs + 2, paddingVertical: Spacing.sm },
  label: { fontFamily: Family.sansSemibold },
  badge: { position: 'absolute', top: -5, left: 12 },
  badgeFill: {
    minWidth: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeLabel: { fontFamily: Family.sansBold, fontSize: 9 },
});
