import { useNavigation } from 'expo-router';
import { DrawerActions } from 'expo-router/react-navigation';

import { IconButton, MenuIcon } from '@/components/ui';
import { useT } from '@/hooks/use-language';
import { Ink } from '@/theme';

/**
 * Apre il pannello laterale. Sta in cima a ogni schermata delle sezioni, sempre
 * nello stesso angolo: è la strada per lo storico delle conversazioni.
 *
 * L'azione si spedisce con `dispatch` invece di chiamare `openDrawer` sulla
 * navigazione: da una schermata dentro le tab la navigazione più vicina è quella
 * delle tab, che un `openDrawer` non ce l'ha, mentre l'azione risale fino al
 * Drawer da sola.
 */
export function MenuButton() {
  const t = useT();
  const navigation = useNavigation();

  return (
    <IconButton
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      accessibilityLabel={t.nav.apri}>
      <MenuIcon color={Ink.secondary} />
    </IconButton>
  );
}
