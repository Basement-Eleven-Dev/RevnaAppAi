/**
 * Configurazione Firebase letta dalle variabili d'ambiente.
 *
 * Le variabili con prefisso EXPO_PUBLIC_ vengono inlined da Expo nel bundle:
 * non sono segrete (la config Firebase client non lo è mai), ma tenerle fuori
 * dal codice permette di avere ambienti diversi (dev / prod) senza toccare i sorgenti.
 *
 * Copia .env.example in .env.local e compila i valori presi dalla console Firebase.
 */

export type FirebaseEnv = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

export const firebaseConfig: FirebaseEnv = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

/** true quando tutte le variabili necessarie sono presenti. */
export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => value.length > 0
);

/** Nomi delle variabili mancanti, utili per un messaggio d'errore leggibile. */
export function missingFirebaseEnvKeys(): string[] {
  return Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => `EXPO_PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`);
}

/** Host degli emulatori, attivi solo se EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1. */
export const useEmulators = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === '1';
export const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST ?? 'localhost';
