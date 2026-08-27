import Tabs from 'expo-router/js-tabs';

import { AppTabBar } from '@/components/app-tab-bar';
import { useT } from '@/hooks/use-language';
import { Duration, NavigatorCurve, Surface } from '@/theme';

/**
 * Le cinque sezioni dell'app, nell'ordine in cui stanno nella tab bar.
 *
 * L'assistente è la prima perché è il motivo per cui l'app esiste; il profilo è
 * l'ultima perché è quella che si apre una volta e poi più. La barra è disegnata
 * da noi (vedi `components/app-tab-bar.tsx`): la smussatura del sistema Revna non
 * esiste in quella di serie.
 *
 * Fra una sezione e l'altra c'è una **dissolvenza** di 220 ms, la stessa durata
 * d'entrata del sistema. Non è un vezzo: cinque sezioni che si sostituiscono senza
 * transizione sono cinque schermate che sbattono, e l'occhio non ha modo di capire
 * se ha cambiato pagina o se la pagina è cambiata sotto. Non uno scorrimento
 * laterale, però — le tab non hanno un ordine da attraversare, ci si arriva
 * direttamente, e uno slittamento direbbe che ci si è passati attraverso.
 */
export default function TabsLayout() {
  const t = useT();

  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: Surface.base },
        animation: 'fade',
        transitionSpec: {
          animation: 'timing',
          config: { duration: Duration.enter, easing: NavigatorCurve },
        },
      }}>
      <Tabs.Screen name="chat" options={{ title: t.nav.assistente }} />
      <Tabs.Screen name="avvisi" options={{ title: t.nav.avvisi }} />
      <Tabs.Screen name="documenti" options={{ title: t.nav.documenti }} />
      <Tabs.Screen name="blog" options={{ title: t.nav.blog }} />
      <Tabs.Screen name="profilo" options={{ title: t.nav.profilo }} />
    </Tabs>
  );
}
