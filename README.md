# Revna AI — Mobile App

Monorepo del progetto Revna AI: app mobile iOS/Android e configurazione del backend.

| Cartella | Contenuto |
| --- | --- |
| [`app-mobile/`](app-mobile) | App React Native con Expo (SDK 57) + Expo Router, TypeScript |
| [`backoffice/`](backoffice) | Pannello interno Revna in Angular 21 |
| [`backend/`](backend) | Firebase: regole Firestore/Storage, indici, emulatori, Cloud Functions |
| `docs/` | Documenti di progetto (non versionati) |
| `firebase.json`, `.firebaserc` | Configurazione Firebase dell'intero monorepo |

## Architettura

- **Client**: una sola codebase Expo per iOS e Android.
- **BaaS**: Firebase — Authentication (accesso su invito), Firestore (profili e conversazioni), Storage (materiali).
- **Cloud Functions** (`europe-west1`) per inviti, gestione clienti e come proxy verso il modello: la API key non entra mai nell'app.
- **Modello**: Google Gemini via `@google/genai`, chiamato solo lato server.
- L'app usa il **Firebase Web SDK** (`firebase`), quindi gira in Expo Go senza development build.

## Avvio rapido

```bash
cd app-mobile
cp .env.example .env.local   # e compila i valori dalla console Firebase
npm install
npm start
```

## Un solo backend

App mobile e backoffice puntano allo **stesso progetto Firebase** (`revnaappai`): stessa base
utenti, stesse Cloud Functions. A separare i due accessi è il custom claim `revnaAdmin`,
che hanno solo i referenti Revna e che può essere assegnato unicamente lato server.

```
backoffice (Angular)  ─┐
                       ├─→  Firebase revnaappai  ──→  Cloud Functions (europe-west1)
app-mobile (Expo)     ─┘     Auth · Firestore · Storage      createInvite · askAssistant
```

## Stato

| | |
| --- | --- |
| Firebase (Auth, Firestore eur3, Storage) | attivo, regole deployate |
| Functions deployate | `createInvite`, `listClients`, `updateClient`, `saveClientProfile` |
| Backoffice su https://revnaappai.web.app | login, creazione utenze con profilo completo, gestione clienti |
| App | login, attivazione in-app, tab Assistente e Profilo |
| Profilo struttura | modellato, redatto da Revna, visibile nell'app |
| Email di attivazione (Resend) | chiave impostata, manca il dominio verificato |
| Chat con l'assistente | funzionante su Gemini, ragiona sul profilo struttura; manca la chiave |
| Knowledge base Revna e tracciabilità delle fonti | da fare |
| Storico conversazioni | persistito, con sidebar e titoli automatici |
| Documenti condivisi | caricamento da backoffice, consultazione dall'app |
| Esportazione PDF, push, bilingue | da fare |
