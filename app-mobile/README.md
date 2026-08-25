# Revna AI — App mobile

App React Native realizzata con **Expo SDK 57** + **Expo Router**, in TypeScript.

## Requisiti

- Node 20+
- App **Expo Go** sul telefono, oppure un simulatore iOS / emulatore Android

## Avvio

```bash
npm install
cp .env.example .env.local
npm start
```

Poi premi `i` per iOS, `a` per Android, `w` per il web, oppure inquadra il QR con Expo Go.

## Configurazione Firebase

I valori vanno presi da *Console Firebase → Impostazioni progetto → le tue app → App web*
e scritti in `.env.local` (vedi `.env.example`). Le variabili `EXPO_PUBLIC_*` finiscono
nel bundle: la config client di Firebase non è un segreto, la sicurezza sta nelle regole
Firestore (in [`../backend`](../backend)).

Finché mancano le variabili, la schermata iniziale lo segnala ed elenca quelle assenti.

## Accesso

Non c'è registrazione: gli account li crea il [backoffice](../backoffice). Il cliente
riceve un'email con un link che apre l'app sulla schermata `/attiva`, dove sceglie la
password ed entra — la password non si imposta mai su una pagina Firebase.

Se il deep link non scatta (succede in Expo Go, che usa uno schema suo), dalla schermata
di login c'è «Ho un codice di attivazione»: si incolla lì il `code` preso dall'URL.

`useSessionWatch` forza il rinnovo del token all'apertura e ogni 5 minuti: se il
backoffice ha disattivato l'utenza, la sessione cade da sola.

Le due app condividono lo stesso progetto Firebase e la stessa base utenti: chi ha il
custom claim `revnaAdmin` è un referente Revna e usa il backoffice, chi non ce l'ha è
un cliente e usa l'app.

## Struttura

```
app-mobile/
├── assets/images/
│   ├── brand/            # loghi Revna originali in SVG
│   └── *.png             # icona app, splash, favicon (generate dal monogramma)
└── src/
    ├── app/              # schermate — routing file-based di Expo Router
    │   ├── login.tsx     # accesso cliente
    │   ├── attiva.tsx    # scelta password alla prima attivazione
    │   ├── index.tsx     # smistamento: area riservata o login
    │   └── (app)/        # area riservata, a tab
    │       ├── chat.tsx     # conversazione con l'assistente
    │       ├── documenti.tsx # materiali condivisi da Revna
    │       └── profilo.tsx  # profilo struttura + note personali
    ├── components/       # componenti riusabili
    ├── constants/theme.ts# colori del brand, spaziature, font
    ├── hooks/            # use-auth, use-theme, use-color-scheme
    └── lib/firebase/     # inizializzazione unica di Firebase
```

Importa Firebase **sempre** da `@/lib/firebase`, mai direttamente da `firebase/*`:

```ts
import { getFirebaseAuth, getFirebaseDb, getFirebaseFunctions } from '@/lib/firebase';
```

Sono getter, non istanze: Firebase si inizializza alla prima chiamata, una volta sola
anche con il fast refresh. Finché `.env.local` non è compilato l'app parte comunque —
l'errore arriva solo se qualcosa prova davvero a usare Firebase.

## La chat

La risposta arriva **in streaming**: la function invia i pezzi con `sendChunk` mentre
il modello scrive, e la schermata riscrive l'ultimo turno a ogni chunk.

C'è un dettaglio non ovvio dietro: il `fetch` di React Native non espone
`response.body`, quindi le callable in streaming del Firebase SDK non funzionerebbero.
In `src/lib/firebase/index.ts` sostituiamo il `fetchImpl` interno del SDK con quello di
`expo/fetch`, che espone un vero `ReadableStream`. Non è API pubblica, perciò è protetto:
se dovesse sparire, `supportsStreaming()` torna false e la chat ripiega sulla risposta
unica. Stesso ripiego se lo streaming fallisce prima di aver prodotto qualcosa.

Il markdown è reso da `src/components/markdown.tsx`, scritto a mano invece di usare una
libreria: durante lo streaming il testo è quasi sempre markdown incompleto, e un parser
tollerante mostra il testo grezzo per un istante invece di rompersi.

Le conversazioni sono persistite su Firestore e l'elenco vive nella sidebar, che entra
da sinistra dal tasto in alto: titolo riassuntivo, data, tieni premuto per eliminare.
È un pannello dentro la schermata e non un Drawer di navigazione — le tab sono già la
navigazione dell'app, e annidarci un secondo navigatore complicherebbe il routing per
un pannello che vive solo qui.

Il client manda al server solo il messaggio nuovo e l'id della conversazione: lo
storico lo rilegge il server. I turni nello stato servono a disegnare la schermata,
non a ricostruire il contesto.

Ogni risposta è preceduta da `AssistantBadge`: monogramma Revna, nome e la dicitura
«Risposta generata da AI». È trasparenza dovuta, non decorazione — non va rimossa.

## Documenti

La tab Documenti elenca in tempo reale i materiali che Revna ha condiviso con questa
struttura. L'URL di download si chiede solo all'apertura, non in elenco: sarebbe una
richiesta di rete per ogni documento, per un link che quasi sempre non serve.

Il file si apre nel browser in-app (`expo-web-browser`), da cui il sistema offre
salvataggio e condivisione su entrambe le piattaforme.

## Profilo struttura

`profilo.tsx` legge in tempo reale `users/{uid}` da Firestore: se il consulente aggiorna
il profilo dal backoffice, l'app se ne accorge senza riavvio. Il cliente vede tutto e
può scrivere solo le proprie note — le regole Firestore ammettono dal client il solo
campo `profile.noteCliente`.

Tipi ed etichette stanno in `src/lib/profile.ts`, allineati a
`backend/functions/src/profile.ts`.

## Loghi

Gli originali sono in `assets/images/brand/`:

| File | Uso |
| --- | --- |
| `logo_dark.svg` | logo completo per sfondi **chiari** |
| `logo_light.svg` | logo completo per sfondi **scuri** |
| `revna_dark.svg` | solo lettering |
| `revna_R.svg` | monogramma "R" — sorgente di icona, splash e favicon |

Si importano come componenti React grazie a `react-native-svg-transformer`:

```tsx
import LogoDark from '@/assets/images/brand/logo_dark.svg';
```

Il componente `BrandLogo` sceglie già la variante giusta in base al tema.

> Icona e splash sono generate dal monogramma su fondo bianco: da rivedere quando
> arriva il brand book definitivo e l'eventuale logo "Revna AI".

## Emulatori Firebase

Metti `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1` in `.env.local` e avvia gli emulatori da
[`../backend`](../backend). Su emulatore Android l'host va impostato a `10.0.2.2`.
