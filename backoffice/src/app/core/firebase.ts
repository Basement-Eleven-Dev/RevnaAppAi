/**
 * Inizializzazione di Firebase per il backoffice.
 *
 * È lo stesso progetto usato da app-mobile (`revnaappai`): stessa base utenti,
 * stesse Cloud Functions. A distinguere i due accessi è il custom claim
 * `revnaAdmin`, che solo i referenti Revna hanno.
 */

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';

import { environment } from '../../environments/environment';

let authInstance: Auth | undefined;
let functionsInstance: Functions | undefined;
let dbInstance: Firestore | undefined;
let storageInstance: FirebaseStorage | undefined;

function firebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(environment.firebase);
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(firebaseApp());
    if (environment.useEmulators) {
      connectAuthEmulator(authInstance, 'http://localhost:9099', { disableWarnings: true });
    }
  }
  return authInstance;
}

export function getFirebaseFunctions(): Functions {
  if (!functionsInstance) {
    functionsInstance = getFunctions(firebaseApp(), environment.functionsRegion);
    if (environment.useEmulators) {
      connectFunctionsEmulator(functionsInstance, 'localhost', 5001);
    }
  }
  return functionsInstance;
}

export function getFirebaseDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(firebaseApp());
    if (environment.useEmulators) {
      connectFirestoreEmulator(dbInstance, 'localhost', 8080);
    }
  }
  return dbInstance;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storageInstance) {
    storageInstance = getStorage(firebaseApp());
    if (environment.useEmulators) {
      connectStorageEmulator(storageInstance, 'localhost', 9199);
    }
  }
  return storageInstance;
}
