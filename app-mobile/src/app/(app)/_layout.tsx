import { Redirect } from 'expo-router';
import Drawer from 'expo-router/drawer';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';

import { AppSidebar, SIDEBAR_MAX_WIDTH } from '@/components/app-sidebar';
import { AnnouncementsProvider } from '@/hooks/use-announcements';
import { AssistantProvider } from '@/hooks/use-assistant';
import { useAuth } from '@/hooks/use-auth';
import { Brand, Surface } from '@/theme';

/**
 * Area riservata: senza sessione non si entra.
 *
 * La navigazione ha due piani, e non è una ridondanza. In fondo, la **tab bar**
 * con le cinque sezioni: si passa da una all'altra con il pollice, senza aprire
 * niente. Dietro, il **pannello laterale**, che tiene le cose che in una tab bar
 * non stanno — lo storico delle conversazioni, che è ciò che si apre più spesso, e
 * le due voci di servizio (richieste e impostazioni).
 *
 * Il Drawer sta quindi sopra tutto, e dentro ha un solo figlio: lo Stack di
 * `(main)`, che è dove le schermate di dettaglio si impilano sopra le tab.
 */
export default function AppLayout() {
  const { user, loading } = useAuth();
  const { width } = useWindowDimensions();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Surface.base }}>
        <ActivityIndicator color={Brand.accent} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    // Gli avvisi stanno sopra la navigazione e non dentro una schermata: il contatore
    // dei non letti si vede nella tab bar da qualsiasi sezione, e le notifiche vanno
    // registrate all'ingresso nell'area riservata — non quando si apre la sezione, che
    // chi non ha mai avuto un avviso non aprirebbe mai.
    <AnnouncementsProvider>
      <AssistantProvider>
        <Drawer
          drawerContent={(props) => <AppSidebar {...props} />}
          screenOptions={{
            headerShown: false,
            // `slide` su entrambe le piattaforme: vedere la schermata spinta via dice
            // cosa sta succedendo meglio di un pannello che ci si sovrappone.
            drawerType: 'slide',
            drawerStyle: {
              backgroundColor: Surface.raised,
              width: Math.min(SIDEBAR_MAX_WIDTH, width * 0.84),
            },
            overlayColor: 'rgba(6,5,5,0.6)',
            swipeEdgeWidth: 48,
          }}
        />
      </AssistantProvider>
    </AnnouncementsProvider>
  );
}
