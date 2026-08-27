import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { LanguageProvider } from '@/hooks/use-language';
import { useSessionWatch } from '@/hooks/use-session-watch';
import { FontAssets, Surface } from '@/theme';

// Fuori dal componente: dentro sarebbe già tardi, lo splash si sarebbe nascosto
// da solo prima che i font del brand siano pronti.
SplashScreen.preventAutoHideAsync();

/**
 * La radice dell'app.
 *
 * **Una sola apparenza, quella scura.** Il sistema visivo Revna è costruito sul
 * nero: l'accento a schermo — Cinnabar Live, `#FF5C36` — è la versione dello
 * stesso rosso che su fondo chiaro non regge, e la scala di grigi è White Smoke a
 * opacità decrescente, che su bianco non esiste. Un tema chiaro non sarebbe lo
 * stesso sistema con i colori invertiti: sarebbe un secondo sistema.
 */
export default function RootLayout() {
  useSessionWatch();

  // Funnel Display e Funnel Sans, i font del brand. Finché non sono caricati non
  // mostriamo nulla: meglio un istante di splash in più che vedere l'app cambiare
  // font sotto gli occhi.
  const [fontsLoaded, fontsError] = useFonts(FontAssets);

  useEffect(() => {
    // Anche in caso di errore: senza i font l'app resta usabile con quello di
    // sistema, restare sullo splash per sempre no.
    if (fontsLoaded || fontsError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontsError]);

  if (!fontsLoaded && !fontsError) return null;

  return (
    // Radice dei gesti: senza, il pannello laterale dell'area riservata non si apre
    // trascinando dal bordo.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DarkTheme}>
        {/* Sopra lo Stack: la lingua serve già alle schermate di accesso. */}
        <LanguageProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Surface.base },
            }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="recupera" />
            <Stack.Screen name="attiva" />
            <Stack.Screen name="(app)" />
          </Stack>
        </LanguageProvider>
        <StatusBar style="light" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
