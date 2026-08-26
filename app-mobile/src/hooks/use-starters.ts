import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useT } from '@/hooks/use-language';
import { getFirebaseDb, isFirebaseConfigured } from '@/lib/firebase';

/**
 * Le schede di partenza della nuova conversazione, redatte da Revna dal backoffice.
 *
 * Stanno in `agent/public` e non in `agent/config` perché quel documento contiene il
 * system prompt dell'assistente, che non deve uscire dal backoffice: qui c'è solo
 * quello che l'app deve poter mostrare da sé.
 *
 * In caso di errore o di documento mancante restano gli spunti di scorta, tradotti
 * come il resto dell'interfaccia: una chat vuota senza appigli è peggio di quattro
 * spunti non aggiornati. Quelli scritti da Revna arrivano invece nella lingua in cui
 * li ha scritti — sono suoi, non nostri, e non abbiamo modo di tradurli.
 */
export function useStarters(): string[] {
  const { user } = useAuth();
  const fallback = useT().chat.spuntiDiScorta;
  const [spunti, setSpunti] = useState<string[] | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;

    return onSnapshot(
      doc(getFirebaseDb(), 'agent', 'public'),
      (snapshot) => {
        const stored = snapshot.data()?.['spunti'];
        const list = Array.isArray(stored)
          ? stored.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
          : [];
        setSpunti(list.length ? list : null);
      },
      () => setSpunti(null)
    );
  }, [user]);

  // `null` e non gli spunti di scorta già risolti: così cambiando lingua il ripiego
  // segue la lingua nuova invece di restare congelato su quella del primo caricamento.
  return spunti ?? fallback;
}
