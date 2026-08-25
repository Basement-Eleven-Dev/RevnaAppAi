/**
 * Punto unico di inizializzazione di Firebase per l'app mobile.
 * Importa sempre da qui (`@/lib/firebase`), mai direttamente da `firebase/*`,
 * così l'inizializzazione resta una sola anche con il fast refresh.
 *
 * L'inizializzazione è pigra: finché la config non è compilata in .env.local
 * l'app parte lo stesso, e l'errore compare solo se qualcuno usa davvero Firebase.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetch as expoFetch } from 'expo/fetch';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  initializeAuth,
  type Auth,
  type Persistence,
  type ReactNativeAsyncStorage,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';
import { Platform } from 'react-native';

import {
  emulatorHost,
  firebaseConfig,
  isFirebaseConfigured,
  missingFirebaseEnvKeys,
  useEmulators,
} from './config';

export { isFirebaseConfigured, missingFirebaseEnvKeys } from './config';

/**
 * `getReactNativePersistence` esiste solo nella build React Native di @firebase/auth:
 * Metro la risolve a runtime, ma i tipi pubblici del pacchetto non la espongono.
 */
const getReactNativePersistence = (
  require('firebase/auth') as {
    getReactNativePersistence?: (storage: ReactNativeAsyncStorage) => Persistence;
  }
).getReactNativePersistence;

function assertConfigured() {
  if (isFirebaseConfigured) return;
  throw new Error(
    `Firebase non è configurato: mancano ${missingFirebaseEnvKeys().join(', ')} in .env.local. ` +
      'Vedi app-mobile/README.md.'
  );
}

let appInstance: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;
let functionsInstance: Functions | undefined;
let storageInstance: FirebaseStorage | undefined;
let emulatorsConnected = false;

export function getFirebaseApp(): FirebaseApp {
  assertConfigured();
  appInstance ??= getApps().length ? getApp() : initializeApp(firebaseConfig);
  return appInstance;
}

export function getFirebaseAuth(): Auth {
  if (authInstance) return authInstance;
  const app = getFirebaseApp();

  if (Platform.OS === 'web' || !getReactNativePersistence) {
    authInstance = getAuth(app);
  } else {
    try {
      // Su native serve AsyncStorage, altrimenti la sessione si perde a ogni riavvio.
      authInstance = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch {
      // Già inizializzato (fast refresh): riusiamo l'istanza esistente.
      authInstance = getAuth(app);
    }
  }

  if (useEmulators && !emulatorsConnected) {
    emulatorsConnected = true;
    connectAuthEmulator(authInstance, `http://${emulatorHost}:9099`, { disableWarnings: true });
  }
  return authInstance;
}

export function getFirebaseDb(): Firestore {
  if (dbInstance) return dbInstance;
  dbInstance = getFirestore(getFirebaseApp());
  if (useEmulators) connectFirestoreEmulator(dbInstance, emulatorHost, 8080);
  return dbInstance;
}

/** Le Cloud Functions sono deployate in europe-west1 (vedi backend/functions). */
export function getFirebaseFunctions(): Functions {
  if (functionsInstance) return functionsInstance;
  functionsInstance = getFunctions(getFirebaseApp(), 'europe-west1');
  if (useEmulators) connectFunctionsEmulator(functionsInstance, emulatorHost, 5001);

  // Il fetch di React Native non espone `response.body`, quindi le callable in
  // streaming non funzionerebbero: la risposta arriverebbe tutta insieme alla fine.
  // Quello di Expo espone un vero ReadableStream. `fetchImpl` non è API pubblica,
  // per questo la sostituzione è protetta: se un domani sparisce, la chat continua
  // a funzionare senza streaming invece di rompersi.
  if (Platform.OS !== 'web') {
    const service = functionsInstance as unknown as { fetchImpl?: typeof fetch };
    if (typeof service.fetchImpl === 'function') {
      service.fetchImpl = expoFetch as unknown as typeof fetch;
    }
  }

  return functionsInstance;
}

/** true se le callable possono davvero ricevere la risposta a pezzi. */
export function supportsStreaming(): boolean {
  if (Platform.OS === 'web') return true;
  const service = getFirebaseFunctions() as unknown as { fetchImpl?: unknown };
  return service.fetchImpl === (expoFetch as unknown);
}

export function getFirebaseStorage(): FirebaseStorage {
  if (storageInstance) return storageInstance;
  storageInstance = getStorage(getFirebaseApp());
  if (useEmulators) connectStorageEmulator(storageInstance, emulatorHost, 9199);
  return storageInstance;
}
