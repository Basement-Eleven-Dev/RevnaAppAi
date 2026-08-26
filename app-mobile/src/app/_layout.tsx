import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors, SansFontAssets } from '@/constants/theme';
import { LanguageProvider } from '@/hooks/use-language';
import { useSessionWatch } from '@/hooks/use-session-watch';

// Fuori dal componente: dentro sarebbe già tardi, lo splash si sarebbe nascosto
// da solo prima che i font del brand siano pronti.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useSessionWatch();

  // Rethink Sans, il font del brand. Finché non è caricato non mostriamo nulla:
  // meglio un istante di splash in più che vedere l'app cambiare font sotto gli occhi.
  const [fontsLoaded, fontsError] = useFonts(SansFontAssets);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  useEffect(() => {
    // Anche in caso di errore: senza il font l'app resta usabile con quello di
    // sistema, restare sullo splash per sempre no.
    if (fontsLoaded || fontsError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontsError]);

  if (!fontsLoaded && !fontsError) return null;

  return (
    // Radice dei gesti: senza, il menu laterale dell'area riservata non si apre
    // trascinando dal bordo.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        {/* Sopra lo Stack: la lingua serve già alle schermate di accesso. */}
        <LanguageProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.background },
            }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="recupera" />
            <Stack.Screen name="attiva" />
            <Stack.Screen name="(app)" />
          </Stack>
        </LanguageProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
