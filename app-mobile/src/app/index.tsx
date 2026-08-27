import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { Brand, Surface } from '@/theme';

/** Smistamento all'avvio: area riservata o accesso. */
export default function IndexScreen() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Brand.accent} />
      </View>
    );
  }

  return <Redirect href={user ? '/chat' : '/login'} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Surface.base,
  },
});
