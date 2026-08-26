import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

/**
 * Uno Stack dentro Avvisi, per la schermata di lettura.
 *
 * Un avviso si apre sopra l'elenco e non al posto suo: impilato si porta dietro gratis
 * il gesto «indietro» del sistema, e chi ha appena letto una comunicazione torna dove
 * era — nell'elenco, alla riga successiva — invece di ritrovarsi a decidere dove andare.
 */
export default function AnnouncementsLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
