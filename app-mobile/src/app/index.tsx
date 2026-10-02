import { Redirect } from 'expo-router';
import { Loading } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';

/** Smistamento all'avvio: area riservata o accesso. */
export default function IndexScreen() {
  const { user, loading } = useAuth();

  if (loading) return <Loading fill />;

  return <Redirect href={user ? '/chat' : '/login'} />;
}
