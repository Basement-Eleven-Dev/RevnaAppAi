/**
 * Config Firebase del progetto revnaappai — la stessa usata da app-mobile.
 * Non è un segreto: la config client Firebase finisce comunque nel bundle,
 * la sicurezza sta nelle regole Firestore e nei controlli delle Cloud Functions.
 * Rigenerabile con: firebase apps:sdkconfig web --project revnaappai
 */
export const environment = {
  production: false,
  useEmulators: false,
  firebase: {
    apiKey: 'AIzaSyCXWxhfPKloiHreMGic8npgZt2DFkAp5Ck',
    authDomain: 'revnaappai.firebaseapp.com',
    projectId: 'revnaappai',
    storageBucket: 'revnaappai.firebasestorage.app',
    messagingSenderId: '829628737693',
    appId: '1:829628737693:web:51f44edc3ed1ba93e94c74',
  },
  functionsRegion: 'europe-west1',
};
