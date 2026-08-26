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

Le function callable, tutte in `europe-west1`:

| Function | Cosa fa | Stato |
| --- | --- | --- |
| `createInvite` | Crea l'utenza, genera il link di attivazione e manda l'email | deployata; l'invio parte quando c'è la chiave Resend |
| `requestPasswordReset` | Manda al cliente il link per rifare la password. **Senza autenticazione** | da deployare |
| `listClients` | Elenco dei clienti (tutti gli utenti senza claim `revnaAdmin`) | deployata |
| `updateClient` | Rinomina, disattiva/riattiva e revoca le sessioni | deployata |
| `saveClientProfile` | Salva il profilo struttura redatto da Revna | deployata |
| `deleteConversation` | Elimina una conversazione del cliente | deployata |
| `createContactRequest` | Apre una richiesta di contatto del cliente | da deployare |
| `updateContactRequest` | Cambia lo stato di una richiesta (solo referenti Revna) | da deployare |
| `getDocumentUrl` | Rilascia un URL firmato a 5 minuti per un documento | deployata |
| `saveAnnouncement` | Salva una comunicazione ai clienti (bozza o correzione) | da deployare |
| `sendAnnouncement` | Consegna la comunicazione ai destinatari e manda le notifiche | da deployare |
| `deleteAnnouncement` | Ritira una comunicazione: originale, copie consegnate e immagini | da deployare |
| `markAnnouncementRead` | Segna un avviso come letto e conta la lettura | da deployare |
| `askAssistant` | Assistente Revna: proxy verso Gemini, ragiona sul profilo della struttura e sulla base di conoscenza | deployata; serve la chiave Gemini |
| `previewAssistant` | Prova l'assistente dal backoffice con il profilo di un cliente | da deployare |

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

users/{uid}/announcements/{id}      la copia consegnata di una comunicazione
├── titolo · corpo (markdown) · estratto
├── inviatoAt
└── lettoAt      null finché il cliente non l'apre: è il pallino rosso nell'app

users/{uid}/pushTokens/{id}        un documento per dispositivo
├── token         ExponentPushToken[…], scritto dall'app
├── piattaforma · dispositivo
└── updatedAt

users/{uid}/conversations/{id}
├── title       riassunto in ≤5 parole, generato alla prima risposta
├── createdAt · updatedAt
└── messages[]  { role: 'user' | 'model', text, sources?: [{ n, titolo, fonte, riferimento }] }
```

### La personalità e la conoscenza dell'assistente

```
agent/config                  riservato ai referenti Revna
├── identita · ragionamento · tono · perimetro     il system prompt, a sezioni
├── temperature
└── updatedAt · updatedBy

agent/public                  leggibile da ogni cliente autenticato
└── spunti[]     le schede di partenza della nuova conversazione, nell'app

knowledge/{id}                riservato ai referenti Revna, in lettura e scrittura
├── titolo · tipo · tags[]
├── fonte          «Hotel Mystery Guest, Derosas» — la provenienza che il cliente legge
├── riferimento    «cap. 7.4 — Le restrizioni tariffarie» — il punto preciso
├── contenuto      il testo che entra nel contesto del modello
├── attivo         solo le voci attive finiscono in una risposta
└── updatedAt · updatedBy
```

Il documento della personalità è **diviso in due** per riservatezza: `agent/config`
contiene il system prompt, cioè come Revna ha istruito l'agente, e non deve uscire dal
backoffice; `agent/public` contiene solo ciò che l'app deve poter mostrare da sé. Li
scrive lo stesso form.

`knowledge` è **chiusa ai clienti anche in lettura**: è il patrimonio di Revna, e il
cliente ne vede soltanto quello che l'assistente cita rispondendo a una sua domanda.
`askAssistant` la legge con l'Admin SDK, che non passa dalle regole.

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

**Questi documenti vanno trattati come riservati**: possono contenere dati economici,
report gestionali, contratti. Perciò:

- la **lettura diretta su Storage è negata a chiunque**, referenti Revna compresi
- l'unico modo di arrivare a un file è `getDocumentUrl`, che verifica chi sta chiedendo
  e rilascia un URL firmato valido **5 minuti**
- non esistono link permanenti: un indirizzo copiato e girato scade da solo
- la **scrittura** resta diretta e riservata ai referenti Revna, con tetto di 50 MB

`getDocumentUrl` non si fida del percorso scritto nella scheda: verifica che stia sotto
`clients/{uid}/documents/` del proprietario. Senza quel controllo, chi riuscisse a
scrivere nella scheda potrebbe farsi firmare un URL per un file qualsiasi del bucket.
Ogni richiesta finisce nei log con chi l'ha fatta.

Nelle regole di Storage il tetto sulla dimensione è condizionato a
`request.resource == null`: in cancellazione non c'è nessun file in arrivo, e senza
quella guardia l'eliminazione fallirebbe.

### Prerequisito IAM per la firma

Per firmare gli URL il service account di runtime deve poter firmare per sé stesso:

- API **IAM Service Account Credentials** (`iamcredentials.googleapis.com`) abilitata
- ruolo **Service Account Token Creator** concesso al service account
  `<numero>-compute@developer.gserviceaccount.com` **su sé stesso**
  (IAM → Service Accounts → seleziona l'account → Permissions → Grant access)

Senza, `getSignedUrl` fallisce con `iam.serviceAccounts.signBlob denied`.

Le liste di valori ammessi stanno in `functions/src/profile.ts`, duplicate con le
etichette italiane in `backoffice/src/app/core/profile.model.ts` e
`app-mobile/src/lib/profile.ts`. Le chiavi sono stabili: cambiarle richiede una
migrazione dei documenti.

Le regole Firestore fanno rispettare la separazione: il cliente legge tutto il proprio
documento ma in scrittura può toccare **solo** `profile.noteCliente`; Revna legge tutto
e scrive solo passando dalle functions, che normalizzano i campi.

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

### Recupero della password

`requestPasswordReset` rifà lo stesso percorso dell'attivazione — stesso `oobCode`,
stessa pagina, stesso schermo dell'app — con `&reset=1` in coda all'URL. Il parametro
serve solo a far cambiare le parole a pagina e app: chi sta recuperando l'accesso non
lo sta attivando, e leggere «Attiva il tuo accesso» lo farebbe dubitare di aver
cliccato il link giusto.

È l'unica function chiamabile **senza autenticazione**: chi ha perso la password non è
dentro. Da lì le due cautele:

- **Risposta cieca.** Email sconosciuta, invio in pausa o invio riuscito danno la stessa
  risposta. Altrimenti la function diventerebbe un modo per sapere chi è cliente Revna.
- **Un invio al minuto per email** (`passwordResets/{email}`, scritta in transazione).
  Non è solo contro lo spam nella casella: ogni nuovo `oobCode` invalida il precedente,
  quindi senza freno si può tenere un cliente fuori dal suo account rigenerandogli il
  codice mentre prova a usarlo.

La collezione `passwordResets` non compare fra quelle aperte nelle regole: la scrive
solo l'Admin SDK, e il `deny` finale la tiene chiusa a tutti gli altri.

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
| Persona e perimetro | documento `agent/config`, redatto dal backoffice |
| Base di conoscenza | collezione `knowledge`, redatta dal backoffice |

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

### La base di conoscenza e le citazioni

Il sapere Revna **non sta nei pesi di un modello ma nel contesto della richiesta**: è
l'unico modo di tenere la promessa fatta al cliente — ogni risposta rimanda al materiale
da cui deriva — perché un peso non ha provenienza, una voce di `knowledge` sì. È anche
l'unico modo perché Katia possa aggiornare un contenuto senza un deploy.

A ogni domanda, `agent.ts`:

1. **carica** personalità e voci attive, con una cache di un minuto nell'istanza — le
   voci sono le stesse per tutti i clienti e cambiano di rado;
2. **sceglie** cosa mettere in contesto. Finché la conoscenza attiva sta sotto i 120.000
   caratteri (~30k token) la inietta **tutta**: con una base piccola, un passaggio di
   selezione costerebbe una chiamata e mezzo secondo per non scartare niente. Sopra la
   soglia, un passaggio al modello sceglie le 10 voci più pertinenti dall'indice dei
   titoli; se quella chiamata fallisce si ripiega su un punteggio per parole chiave,
   perché una risposta senza fonti è peggio di una con fonti approssimative;
3. **numera** le voci nel prompt — `[1] Titolo — Fonte, riferimento` — e istruisce il
   modello a citare `[1]` subito dopo l'affermazione che vi poggia;
4. **risolve** i marcatori in `sources` strutturate, correggendo due errori tipici del
   modello: i numeri che non esistono (marcatore rimosso) e le citazioni che partono da
   `[2]` senza aver mai usato `[1]` (numerazione compattata, perché un elenco di fonti
   che comincia da 2 sembra un pezzo mancante).

Le `sources` viaggiano nella risposta finale e vengono salvate sul turno: riaprendo una
conversazione dalla sidebar il cliente ritrova le fonti sotto ogni risposta.

**Le regole di citazione non sono modificabili dal backoffice**, a differenza della
personalità: sono un contratto tecnico fra il prompt e `resolveCitations`, che si aspetta
esattamente i marcatori `[n]`. Chi scrive il tono dell'assistente non deve poterlo
rompere per sbaglio.

Quando non c'è materiale pertinente il prompt cambia: al modello viene detto di
rispondere con la propria competenza di settore e di **non citare nulla**. Meglio una
risposta dichiaratamente senza fonti che una fonte inventata.

### Richieste di contatto

La valvola di sfogo dell'assistente. Un assistente che su una domanda fuori dal suo
perimetro può solo dire «non me ne occupo» lascia il cliente dov'era: qui quella
risposta diventa l'inizio di qualcosa.

Il modello ha nel prompt un protocollo, non modificabile dal backoffice come le regole
di citazione: quando la domanda esce dal perimetro, o quando servirebbe una decisione
che spetta a una persona, chiude la risposta con un marcatore

```
<<<CONTATTO: testo della richiesta, in prima persona, come la scriverebbe il cliente>>>
```

`extractContactProposal` lo stacca dal testo prima che la risposta esca dal server: il
marcatore non arriva mai al cliente, e la proposta torna nel campo `proposal` della
risposta e sul turno salvato. Nell'app diventa un bottone sotto quella risposta, e il
testo passa da un campo modificabile e da una conferma esplicita — l'assistente propone
le parole, chi firma la richiesta è il cliente. Il marcatore aperto e non chiuso vale
come chiuso: succede quando la risposta viene troncata, e buttare via la proposta per
tre segni maggiore costerebbe al cliente l'unica cosa utile di quella risposta.

Le richieste stanno in `contactRequests`, collezione di **primo livello** e non
sottocollezione dell'utente come documenti e conversazioni: quelle si guardano un
cliente alla volta, queste si guardano tutte insieme, e il backoffice ha bisogno di una
coda unica ordinata per data. Il cliente vede le sue con un filtro su `uid`, che le
regole obbligano a mettere.

| Campo | Cosa contiene |
| --- | --- |
| `stato` | `inviata` → `visualizzata` → `chiusa` |
| `messaggio` | Il testo confermato dal cliente |
| `origine` | `assistente` se nata dalla chat, `richieste` se dalla sezione dell'app |
| `conversationId` | La conversazione da cui è nata, se esiste ancora |
| `contatto` | Recapito del cliente **congelato** al momento della richiesta |
| `statoAt`, `statoBy` | Quando e da chi lo stato è stato mosso l'ultima volta |

Nessuno scrive direttamente: le regole negano scrittura a entrambe le parti.
`createContactRequest` prende dal client **solo il testo** — nome, recapito e stato li
mette il server, perché sono le cose di cui il consulente che richiama deve potersi
fidare, e il cliente non deve poter chiudere da sé una richiesta. `updateContactRequest`
è riservata ai referenti Revna e ammette qualsiasi passaggio, compreso il ritorno da
«chiusa»: una richiesta chiusa troppo presto si riapre.

Il recapito è una copia e non un riferimento: chi apre la richiesta fra due settimane
deve vedere il numero a cui il cliente si aspettava di essere richiamato, non quello che
nel frattempo è stato corretto. Il profilo vivo resta a un clic, nella scheda del cliente.

Un cliente può avere al massimo **10 richieste aperte**. Non è una tariffa, è un argine:
dieci richieste aperte sono già un segnale che qualcosa non funziona, e senza un limite
un ciclo dell'app potrebbe riempire la coda del backoffice.

### Comunicazioni ai clienti

Il verso opposto delle richieste di contatto: lì è il cliente che chiama, qui è Revna che
parla. Da questo il modello dei dati rovesciato — una comunicazione è **una cosa scritta
una volta e consegnata a molti**, e le due metà hanno bisogni opposti: il consulente
vuole vedere «la comunicazione e chi l'ha letta», il cliente vuole vedere «i miei
avvisi».

```
announcements/{id}                 l'originale, riservato ai referenti Revna
├── titolo · corpo (markdown) · estratto
├── destinatari      { modo: 'tutti' | 'selezione', uids[] }   l'intenzione
├── stato            'bozza' | 'inviato'
├── inviatoA[]       i destinatari veri, risolti all'invio
├── destinatariCount · lettiCount
├── createdAt · createdBy · updatedAt · updatedBy
└── inviatoAt · inviatoBy
```

La **copia consegnata** sta sotto ciascun destinatario (`users/{uid}/announcements/{id}`,
stesso id) e costa una scrittura per destinatario a ogni invio. In cambio evita la cosa
che conta di più: senza di essa il client dovrebbe leggere `announcements` filtrando su un
elenco di destinatari, e quell'elenco — chi sono gli altri clienti Revna e quanti sono —
finirebbe sul telefono di ciascuno. Per lo stesso motivo `announcements` è **chiusa ai
clienti anche in lettura**.

Nessuno scrive direttamente, da nessuna delle due parti. Non è una cautela contro i
referenti Revna: `stato` e `destinatariCount` sono il resoconto di una consegna, e se li
potesse scrivere il client «inviato a 42 clienti» sarebbe un'affermazione senza garanzie.

| Regola | Perché |
| --- | --- |
| `tutti` si risolve **all'invio**, non al salvataggio | Un avviso è datato: chi diventa cliente domani non deve ricevere quello di ieri |
| I clienti **disattivati** non ricevono, anche se scelti a mano | Una bozza di tre settimane fa può contenere qualcuno che nel frattempo è uscito |
| Si invia **una volta sola** | Una seconda consegna sarebbe una seconda notifica per un avviso già letto |
| Dopo l'invio si correggono titolo e testo, **non i destinatari** | La correzione raggiunge subito chi ha ricevuto; allargare il pubblico farebbe arrivare la notifica a metà dei clienti e all'altra metà no |
| Il ritiro **cancella davvero** — copie e immagini comprese | Un avviso mandato per errore deve poter sparire dall'app, e uno «ritirato» ma leggibile non risolve il problema per cui lo si ritira |

`lettoAt` lo scrive `markAnnouncementRead` e non il client, per un motivo che non è la
sicurezza — falsificare la propria lettura non porta niente a nessuno — ma la
contabilità: la lettura va contata anche sull'originale, che il cliente non può vedere.
In transazione, perché aprire due volte lo stesso avviso è la cosa più normale del mondo.

Il corpo è **markdown** e non HTML: lo mostra l'app con il renderer delle risposte
dell'assistente (`app-mobile/src/components/markdown.tsx`), che non è un browser e non
esegue tag. Nel backoffice si scrive con un editor WYSIWYG che traduce nei due versi.

Le **immagini** dentro il testo sono l'eccezione alla regola «nessuna lettura diretta su
Storage»: stanno in `announcements/{id}/` e l'indirizzo nel testo è un download URL di
Firebase, con il suo token. Chiunque lo abbia vede l'immagine, senza essere autenticato.
È la differenza con i documenti, ed è voluta — un'immagine dentro un testo la deve poter
caricare il telefono di ogni cliente che apre l'avviso, anche fra un mese, e con URL
firmati a 5 minuti mostrerebbe un riquadro vuoto. Chi scrive lo deve sapere: lì ci vanno
grafici e foto, non un report riservato messo dentro come immagine.

### Notifiche push

Le manda `sendAnnouncement` subito **dopo** la consegna: la notifica avverte che qualcosa
è arrivato, e non deve poter arrivare prima della cosa. Se il servizio push è giù la
consegna resta valida e l'invio non fallisce — il cliente trova l'avviso con il pallino
rosso al prossimo avvio, che è la stessa cosa che vede chi ha negato le notifiche.

Passano dal **servizio push di Expo** (`exp.host/--/api/v2/push/send`) e non da FCM con
l'Admin SDK, benché Firebase ci sia già: l'app è una build Expo e i suoi token sono token
Expo. Il servizio di Expo è il ponte verso APNs e FCM, e ci risparmia certificati APNs e
`google-services.json`. Nessuna chiave da custodire: il token *è* il segreto.

I token li scrive l'app in `users/{uid}/pushTokens/{id}`, uno per dispositivo — è l'unica
sottocollezione che il cliente scrive da sé, perché il token lo rilascia il servizio push
al telefono e nessun altro lo conosce. Il server li legge con l'Admin SDK e **pota** quelli
che Expo dichiara `DeviceNotRegistered`: app disinstallata o notifiche revocate.

Il numero sul badge dell'icona viaggia nella notifica e vale i **non letti di quel
cliente**, contati al momento dell'invio: mandarlo senza vorrebbe dire un'icona che dice
«1» quando gli avvisi da leggere sono tre. Poi lo tiene allineato l'app.

**Perché le notifiche arrivino servono due cose** (senza, tutto il resto funziona e l'app
si arrende in silenzio):

1. una **development build** o la build di store dell'app — da Expo SDK 53 Expo Go non
   riceve più notifiche remote;
2. un **`projectId` EAS** in `app-mobile/app.json` sotto `expo.extra.eas.projectId`, che
   è come il servizio push riconosce l'app. Si ottiene con `eas init` dentro
   `app-mobile/`.

### Provare l'assistente dal backoffice

`previewAssistant` risponde con il profilo di un cliente indicato, per chi dal backoffice
sta scrivendo la personalità o la base di conoscenza e vuole vedere l'effetto senza
entrare nell'app come cliente.

Il lavoro sul modello sta in `model.ts` ed è **lo stesso** delle risposte vere: se la
prova avesse un suo percorso — un prompt costruito diversamente, un'altra selezione della
conoscenza — proverebbe un assistente che non esiste, e sarebbe peggio di non averla.
`askAssistant` e `previewAssistant` restano sottili: la prima aggiunge chi è il cliente e
la persistenza, la seconda il controllo di accesso e la diagnostica.

**La prova non scrive niente.** Nessuna conversazione finisce sotto il cliente — non deve
comparire nel suo storico una chat che non ha avuto — né sotto il referente Revna. Per
questo lo storico della prova viaggia nella richiesta invece di stare su Firestore: è
l'unico caso in cui il contesto lo tiene il client, e va bene perché lì il client è il
backoffice e la conversazione non è di nessuno. Arrivando dal client va limitata qui, ed
è quello che fa `MAX_PREVIEW_TURNS`.

Il profilo, invece, si legge dal server: si indica **quale** cliente impersonare, non si
manda un profilo inventato. Provare l'assistente su dati finti direbbe poco. Non si
possono impersonare altri referenti Revna, che non hanno una struttura, e ogni prova
finisce nei log con chi l'ha fatta: legge il profilo di un cliente, e su dati di un
cliente serve sapere chi ha guardato cosa.

Oltre alla risposta torna una diagnostica: quali voci sono entrate in contesto, quali
sono state **davvero citate**, quante voci attive c'erano in tutto, il profilo come lo
legge il modello e il prompt di sistema completo. È la parte che serve di più: dice se una
voce non è stata usata perché non è stata scelta o perché il modello l'ha ignorata.

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
