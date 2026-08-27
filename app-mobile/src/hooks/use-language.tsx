import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Brand, Surface } from '@/theme';
import {
  DICTIONARIES,
  deviceLanguage,
  isLanguage,
  type Dictionary,
  type Language,
} from '@/lib/i18n';

/**
 * La scelta sta su questo dispositivo e non sul profilo utente: la lingua
 * dell'interfaccia serve anche prima del login (accesso e attivazione), quando
 * non c'è ancora un utente su cui salvarla.
 */
const STORAGE_KEY = 'revna.language';

type LanguageState = {
  language: Language;
  setLanguage: (next: Language) => void;
  t: Dictionary;
};

const LanguageContext = createContext<LanguageState | null>(null);

/**
 * Rende disponibile la lingua a tutta l'app.
 *
 * I figli si montano solo dopo aver letto la preferenza salvata. Partire dalla
 * lingua di sistema e correggerla appena la lettura arriva sarebbe più rapido di
 * qualche millisecondo, ma a chi ha scelto la lingua non di sistema mostrerebbe un
 * lampo nella lingua sbagliata a ogni avvio.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(deviceLanguage);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (isLanguage(stored)) setLanguageState(stored);
      })
      // Storage illeggibile: si resta sulla lingua di sistema, che è comunque
      // una risposta sensata. Non è un motivo per non far partire l'app.
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setLanguage = useCallback((next: Language) => {
    // L'interfaccia cambia subito; la scrittura può prendersi il suo tempo e, se
    // fallisce, al prossimo avvio si torna alla lingua di sistema.
    setLanguageState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Surface.base,
        }}>
        <ActivityIndicator color={Brand.accent} />
      </View>
    );
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: DICTIONARIES[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageState {
  const state = useContext(LanguageContext);

  if (!state) {
    throw new Error('useLanguage richiede <LanguageProvider> (vedi src/app/_layout.tsx).');
  }

  return state;
}

/** Scorciatoia per i componenti che devono solo scrivere del testo. */
export function useT(): Dictionary {
  return useLanguage().t;
}
