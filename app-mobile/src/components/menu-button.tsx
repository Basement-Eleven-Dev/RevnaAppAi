import { useNavigation } from 'expo-router';
import { DrawerActions } from 'expo-router/react-navigation';
import { Pressable, StyleSheet } from 'react-native';

import { MenuIcon } from '@/components/tab-icon';
import { useT } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';

/**
 * Apre il menu laterale. Sta in cima a ogni schermata dell'area riservata: senza
 * la tab bar è l'unico modo per spostarsi, quindi deve trovarsi sempre allo stesso
 * posto.
 *
 * L'azione si spedisce con `dispatch` invece di chiamare `openDrawer` sulla
 * navigazione: dalle schermate dentro uno Stack (Profilo) la navigazione più
 * vicina è quello Stack, che un `openDrawer` non ce l'ha, mentre l'azione risale
 * fino al Drawer da sola.
 */
export function MenuButton() {
  const theme = useTheme();
  const t = useT();
  const navigation = useNavigation();

  return (
    <Pressable
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t.nav.apri}
      style={[styles.button, { borderColor: theme.border }]}>
      <MenuIcon color={theme.textSecondary} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
