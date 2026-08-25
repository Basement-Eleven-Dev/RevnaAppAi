import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

/** Smistamento all'avvio: area riservata o login. */
export default function IndexScreen() {
  const theme = useTheme();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  return <Redirect href={user ? '/chat' : '/login'} />;
}
