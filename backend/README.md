# Backend — Firebase

Firebase è il BaaS del progetto. Questa cartella contiene la **configurazione** e le
**Cloud Functions**; il progetto Firebase va creato dalla console e intestato a Revna.

La configurazione Firebase (`firebase.json`, `.firebaserc`) sta **nella radice del repo**,
non qui: copre anche il backoffice, e Firebase Hosting non accetta percorsi fuori dalla
propria cartella di progetto. Tutti i comandi `firebase` vanno lanciati dalla radice.

| Percorso | Contenuto |
| --- | --- |
| `firestore.rules` | regole di accesso a Firestore — di default nega tutto |
| `firestore.indexes.json` | indici compositi (vuoto per ora) |
| `storage.rules` | regole di Cloud Storage — di default nega tutto |
| `functions/` | Cloud Functions in TypeScript (Node 22, regione `europe-west1`) |
| `../firebase.json` | regole, codebase functions, hosting del backoffice, emulatori |
| `../.firebaserc` | alias del progetto Firebase (`revnaappai`) |

## Setup iniziale

1. Crea il progetto sulla console Firebase (piano **Blaze**, richiesto dalle Functions),
   attiva **Authentication**, **Firestore**, **Storage**.
2. Metti l'id del progetto in `../.firebaserc`.
3. Registra un'app **Web** e copia la config in `app-mobile/.env.local`
   e `backoffice/src/environments/`.
4. Autenticati con la CLI: `firebase login`.

Per `revnaappai` è già tutto fatto.

## Cloud Functions

```bash
npm --prefix functions install
npm --prefix functions run build
```

Due function callable, entrambe in `europe-west1`:

| Function | Cosa fa | Stato |
| --- | --- | --- |
| `createInvite` | Crea l'utenza, genera il link di attivazione e manda l'email | deployata; l'invio parte quando c'è la chiave Resend |
| `listClients` | Elenco dei clienti (tutti gli utenti senza claim `revnaAdmin`) | deployata |
| `updateClient` | Rinomina, disattiva/riattiva e revoca le sessioni | deployata |
| `saveClientProfile` | Salva il profilo struttura redatto da Revna | deployata |
| `deleteConversation` | Elimina una conversazione del cliente | deployata |

### Il documento `users/{uid}`

```
users/{uid}
├── email
├── createdAt · updatedAt · updatedBy
└── profile
    ├── referente   nome, cognome, ruolo, telefono
    ├── struttura   nome, tipologia, categoria, annoApertura, sitoWeb
    ├── indirizzo   via, citta, provincia, cap, regione, paese
    ├── alloggi[]   { tipologia, quantita }
    ├── servizi[] · canali[] · target[]   chiavi da liste chiuse
    ├── stagionalita · obiettivi
    ├── noteRevna     scritte dal consulente, il cliente le legge
    └── noteCliente   scritte dal cliente dall'app, Revna non le sovrascrive

users/{uid}/documents/{id}
├── name · description · categoria
├── contentType · size
├── storagePath   → clients/{uid}/documents/{id}-{nome}
└── uploadedAt · uploadedBy

users/{uid}/conversations/{id}
├── title       riassunto in ≤5 parole, generato alla prima risposta
├── createdAt · updatedAt
└── messages[]  { role: 'user' | 'model', text }
```

I messaggi sono un array dentro il documento e non una sottocollezione: una
conversazione si legge e si mostra sempre intera, e il limite di 1 MB per documento è
lontanissimo dalla lunghezza di una chat di consulenza. Oltre 200 turni i più vecchi
cadono.

Il cliente legge e cancella le proprie conversazioni; **scriverle è solo di
`askAssistant`**, che è anche l'unico posto in cui lo storico viene composto — così il
client non può riscrivere il passato per condizionare le risposte successive.

### Documenti condivisi

I file stanno su Cloud Storage in `clients/{uid}/documents/`, le schede in Firestore.
Caricamento e cancellazione sono del backoffice, che scrive direttamente su entrambi:
far transitare un binario da una Cloud Function non porterebbe alcun vantaggio, e le
regole bastano a difendere l'accesso.

Le regole di Storage sono il punto in cui la separazione fra clienti viene imposta:

- **legge** il referente Revna, oppure il cliente il cui `uid` è nel percorso
- **scrive ed elimina** solo il referente Revna, con un tetto di 50 MB per file
- tutto il resto del bucket resta chiuso

Il cliente scarica tramite l'URL di download di Firebase Storage: chi ha il link ha il
file, quindi non è la strada giusta per materiale riservato. Se un domani servisse,
la sostituzione è una function che rilascia URL firmati a scadenza breve.

Le liste di valori ammessi stanno in `functions/src/profile.ts`, duplicate con le
etichette italiane in `backoffice/src/app/core/profile.model.ts` e
`app-mobile/src/lib/profile.ts`. Le chiavi sono stabili: cambiarle richiede una
migrazione dei documenti.

Le regole Firestore fanno rispettare la separazione: il cliente legge tutto il proprio
documento ma in scrittura può toccare **solo** `profile.noteCliente`; Revna legge tutto
e scrive solo passando dalle functions, che normalizzano i campi.
| `askAssistant` | Assistente Revna: proxy verso Gemini, ragiona sul profilo della struttura | deployata; serve la chiave Gemini |

### Attivazione dell'account

La password il cliente la sceglie **dentro l'app**, non su una pagina Firebase.
`createInvite` genera il link di reset di Firebase, ne estrae il solo `oobCode` e lo
incapsula in un URL nostro:

```
https://revnaappai.web.app/attiva?code=<oobCode>
   → pagina pubblica del backoffice
   → deep link revnaai://attiva?code=<oobCode>
   → schermata /attiva dell'app: confirmPasswordReset + login automatico
```

Il passaggio dal web serve solo perché un'email deve puntare a un URL `https`.

### Invio delle email (Resend)

Il mittente e la base degli URL sono parametri non segreti in `functions/.env`;
la chiave sta in Secret Manager con un valore segnaposto:

```bash
firebase functions:secrets:set RESEND_API_KEY
```

Finché la chiave è `PLACEHOLDER` l'invio viene **saltato senza errori** e il backoffice
mostra il link da consegnare a mano. Serve anche un dominio mittente verificato su
Resend, da riportare in `MAIL_FROM` dentro `functions/.env`.

### Disattivazione

`updateClient` con `disabled: true` chiama anche `revokeRefreshTokens`. Non basta
disattivare: l'ID token già in mano al client resta valido fino a un'ora. L'app forza
il rinnovo all'apertura e ogni 5 minuti, quindi la sessione cade poco dopo.

### Il custom claim `revnaAdmin`

È ciò che separa un referente Revna da un cliente, sulla stessa base utenti.
`createInvite` lo pretende dal chiamante; solo l'Admin SDK può assegnarlo.

Il primo referente è stato nominato con una function temporanea di bootstrap, poi
rimossa. Per nominarne altri serve una function dedicata: assegnare un claim non è
un'operazione che si fa dal client.

### L'assistente

`askAssistant` è il proxy verso il modello: l'app non parla mai direttamente con il
provider, così la chiave resta lato server e ogni richiesta passa dal controllo di
accesso. Il profilo della struttura **non arriva dal client**: lo legge la function
da `users/{uid}`, quindi è il server a decidere di chi si sta parlando.

| Cosa | Dove |
| --- | --- |
| Provider | Google Gemini **via Vertex AI**, SDK `@google/genai` |
| Modello | `GEMINI_MODEL` in `functions/.env` (oggi `gemini-3.1-flash-lite`) |
| Regione | `GEMINI_LOCATION` in `functions/.env` (oggi `global`) |
| Autenticazione | nessuna chiave: Application Default Credentials del service account |
| Persona e perimetro | costante `PERSONA` in `src/assistant.ts` |

**Non serve una chiave API.** La function gira già dentro il progetto Google con il
proprio service account, quindi si autentica da sola: niente segreti da custodire,
ruotare o esporre. La strada della chiave AI Studio è stata abbandonata perché per le
API Gemini la chiave deve essere legata a un service account, cosa che una policy
dell'organizzazione impedisce.

Prerequisiti sul progetto:

- API **Vertex AI** (`aiplatform.googleapis.com`) abilitata
- il service account di runtime (`<numero>-compute@developer.gserviceaccount.com`)
  con il ruolo *Vertex AI User*

Gli errori del modello finiscono nei log con `logger.error`; al cliente arriva un
messaggio generico.

Il client manda solo il messaggio nuovo e l'id della conversazione: lo storico lo
rilegge il server da Firestore.

La risposta viene inviata a pezzi con `response.sendChunk` mentre il modello la scrive.
`sendChunk` non fa nulla se il client non ha chiesto lo streaming, quindi il testo
completo viene comunque restituito alla fine: un solo percorso di codice per entrambi
i casi.

**Manca ancora la base di conoscenza.** Oggi il modello ragiona sul profilo della
struttura e sulla propria conoscenza di settore: la tracciabilità delle fonti Revna,
prevista dal perimetro, arriva con l'impianto di ingestione dei contenuti.

## Deploy

Dalla radice del repo:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage,functions,hosting
```

## Emulatori (sviluppo locale)

```bash
firebase emulators:start --project demo-revna
```

UI su http://localhost:4000. Lato app, imposta `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1`
in `app-mobile/.env.local`. Porte: auth 9099, functions 5001, firestore 8080, storage 9199.

## Nota sulle regole

Le regole partono **chiuse**: l'unica eccezione è `users/{userId}`, leggibile e
aggiornabile dal solo utente proprietario. Le collezioni vanno aperte una alla volta,
quando il modello dati è deciso. La creazione degli utenti passa da `createInvite`
(Admin SDK), coerentemente con l'accesso su solo invito.
