import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { ActivityIndicator, useWindowDimensions } from 'react-native';

import { AppSidebar, SIDEBAR_MAX_WIDTH } from '@/components/app-sidebar';
import { ThemedView } from '@/components/themed-view';
import { AnnouncementsProvider } from '@/hooks/use-announcements';
import { AssistantProvider } from '@/hooks/use-assistant';
import { useAuth } from '@/hooks/use-auth';
import { useT } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';

/**
 * Area riservata: senza sessione non si entra.
 *
 * La navigazione è un menu laterale e non una barra di tab: la chat è il cuore
 * dell'app e le sue conversazioni passate sono la voce che si apre più spesso,
 * e uno storico non sta in una tab bar. Il menu tiene insieme le due cose —
 * sezioni dell'app e conversazioni — nello stesso posto da cui ci si aspetta di
 * trovarle in un assistente conversazionale.
 */
export default function AppLayout() {
  const theme = useTheme();
  const t = useT();
  const { user, loading } = useAuth();
  const { width } = useWindowDimensions();

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    // Gli avvisi stanno sopra il Drawer e non dentro una schermata: il pallino dei non
    // letti si vede nel menu, cioè da qualsiasi sezione dell'app, e le notifiche vanno
    // registrate all'ingresso nell'area riservata — non quando si apre la sezione, che
    // chi non ha mai avuto un avviso non aprirebbe mai.
    <AnnouncementsProvider>
      <AssistantProvider>
        <Drawer
          drawerContent={(props) => <AppSidebar {...props} />}
          screenOptions={{
            headerShown: false,
            // `slide` su entrambe le piattaforme: il menu è la navigazione dell'app,
            // e vederla spingere via la schermata dice cosa sta succedendo meglio di
            // un pannello che ci si sovrappone.
            drawerType: 'slide',
            drawerStyle: {
              backgroundColor: theme.backgroundElement,
              width: Math.min(SIDEBAR_MAX_WIDTH, width * 0.84),
            },
            overlayColor: 'rgba(0,0,0,0.35)',
            swipeEdgeWidth: 48,
          }}>
          <Drawer.Screen name="chat" options={{ title: t.nav.assistente }} />
          <Drawer.Screen name="avvisi" options={{ title: t.nav.avvisi }} />
          <Drawer.Screen name="documenti" options={{ title: t.nav.documenti }} />
          <Drawer.Screen name="blog" options={{ title: t.nav.blog }} />
          <Drawer.Screen name="richieste" options={{ title: t.nav.richieste }} />
          <Drawer.Screen name="profilo" options={{ title: t.nav.profilo }} />
        </Drawer>
      </AssistantProvider>
    </AnnouncementsProvider>
  );
}
