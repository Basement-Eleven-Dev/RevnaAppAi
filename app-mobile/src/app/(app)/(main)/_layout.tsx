import { Stack } from 'expo-router';

import { Surface } from '@/theme';

/**
 * Lo Stack dell'area riservata: le cinque sezioni con la loro tab bar, e sopra le
 * schermate che si impilano.
 *
 * Un avviso aperto, le impostazioni e le richieste stanno **fuori** dalle tab e
 * non dentro: impilate si portano dietro gratis il gesto «indietro» del sistema,
 * e soprattutto la tab bar sparisce — sono schermate in cui l'unica strada è
 * tornare da dove si è arrivati, e cinque sezioni in fondo direbbero il contrario.
 */
export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Surface.base },
      }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="avvisi/[id]" />
      <Stack.Screen name="richieste" />
      <Stack.Screen name="impostazioni" />
      <Stack.Screen name="memoria" />
    </Stack>
  );
}
