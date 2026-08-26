import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

/**
 * Uno Stack dentro Profilo, per poterci mettere sopra Impostazioni.
 *
 * Impostazioni ha una sua voce nel menu laterale, ma resta una schermata impilata
 * sul profilo e non una sezione a sé: impilata si porta dietro gratis il gesto
 * «indietro» del sistema, che da una schermata di form serve.
 */
export default function ProfileLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="impostazioni" />
    </Stack>
  );
}
