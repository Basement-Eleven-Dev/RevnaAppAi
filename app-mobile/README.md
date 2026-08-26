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

### Password dimenticata

Da «Password dimenticata?» si arriva a `/recupera`: si inserisce l'email e la function
`requestPasswordReset` manda un link che riporta su `/attiva`, stavolta con `?reset=1`.
È lo stesso `oobCode` dell'attivazione e lo stesso schermo — quel parametro cambia solo
le parole, non il meccanismo.

La schermata risponde allo stesso modo che l'email esista o no: da fuori non si deve
poter scoprire chi è cliente Revna. Il freno agli invii ravvicinati sta sul backend, non
qui: serve anche contro chi chiama la function senza passare dall'app.

### Documenti legali

Privacy policy e trattamento dei dati sono sotto tutte e tre le schermate di accesso,
tramite `components/legal-links.tsx`. Gli indirizzi stanno in `constants/legal.ts` e
oggi sono **segnaposto**: vanno sostituiti con gli URL definitivi quando Revna li
fornisce, in quell'unico file.

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
    │   ├── recupera.tsx  # richiesta del link per rifare la password
    │   ├── attiva.tsx    # scelta password: prima attivazione e recupero
    │   ├── index.tsx     # smistamento: area riservata o login
    │   └── (app)/        # area riservata
    │       ├── chat.tsx      # conversazione con l'assistente
    │       ├── avvisi/       # comunicazioni di Revna
    │       │   ├── index.tsx # elenco, con i non letti in evidenza
    │       │   └── [id].tsx  # l'avviso per esteso
    │       ├── documenti.tsx # materiali condivisi da Revna
    │       ├── richieste.tsx # richieste di contatto e loro stato
    │       └── profilo/
    │           ├── index.tsx        # profilo struttura + note personali
    │           └── impostazioni.tsx # lingua, password, email
    ├── components/       # componenti riusabili (markdown, sources, sidebar…)
    ├── constants/         # theme.ts (colori, spaziature, font), legal.ts (URL legali)
    ├── hooks/            # use-auth, use-assistant, use-language, use-theme…
    └── lib/
        ├── firebase/     # inizializzazione unica di Firebase
        └── i18n/         # dizionari italiano e inglese
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

## Le fonti sotto le risposte

Quando una risposta poggia sul materiale Revna, sotto compare `components/sources.tsx`
con le voci citate. I numeri corrispondono ai marcatori `[1]` dentro il testo, così si
risale da una singola affermazione alla sua fonte e non solo alla risposta nel suo
insieme. Sta in fondo e non in cima perché non è un disclaimer, è una firma.

Le fonti le decide il server: `askAssistant` seleziona il materiale, lo numera nel prompt
e traduce i marcatori scritti dal modello in `sources` strutturate. Il client non ne
compone nessuna — nemmeno potrebbe, la base di conoscenza non è leggibile dall'app.

Durante lo streaming le fonti **non** ci sono ancora: arrivano con la risposta finale,
insieme al testo con i marcatori rinumerati, che sostituisce quello mostrato a pezzi.
Per questo `show()` in `use-assistant.ts` accetta le fonti come secondo argomento e
l'ultimo turno viene riscritto una volta di più alla fine.

Le fonti sono salvate sul turno in Firestore: riaprendo una conversazione dalla sidebar
ricompaiono, perché sono parte della risposta e non un ornamento del momento.

Gli **spunti** della chat vuota non sono più una costante dell'app: `use-starters.ts` li
legge da `agent/public`, dove li scrive Revna dal backoffice. Fanno parte della
personalità dell'assistente, non del codice. Se il documento manca o la lettura fallisce
restano quattro spunti di scorta: una chat vuota senza appigli è peggio di spunti non
aggiornati.

## Avvisi

È l'unica sezione in cui il contenuto arriva **senza che il cliente l'abbia chiesto**:
sono le comunicazioni che Revna scrive dal backoffice. Per questo l'elenco distingue letto
da non letto prima di ogni altra cosa — il pallino non è una decorazione, è la risposta
alla domanda con cui si entra qui.

Il pallino sta sull'icona della voce nel **menu laterale**, cioè si vede da qualsiasi
schermata: per questo gli avvisi vivono in un provider sopra il Drawer
(`hooks/use-announcements.tsx`) e non dentro la schermata. Senza un posto comune, ogni
componente che mostra quel numero aprirebbe una propria connessione a Firestore per
contare le stesse righe.

L'elenco è in ascolto live su `users/{uid}/announcements`, come i documenti: un avviso che
arriva mentre l'app è aperta compare da sé, e lo stesso vale per una **correzione** — se
il consulente riscrive il testo di una comunicazione già mandata, chi la sta leggendo vede
la versione giusta.

Aprire un avviso lo segna come letto (`markAnnouncementRead`). Non c'è un bottone «segna
come letto»: leggere è quello che è appena successo, e lasciarlo a un tocco vorrebbe dire
un pallino rosso accesso su una comunicazione che il cliente ha davanti agli occhi. Il
pallino sparisce subito, senza attendere la risposta del server.

Il testo è markdown e lo rende `components/markdown.tsx`, lo stesso renderer delle
risposte dell'assistente, esteso con le **immagini** — che l'assistente non produce ma un
avviso sì. Due renderer per lo stesso markdown vorrebbero dire due modi in cui un titolo
può apparire nell'app.

### Notifiche

Quando parte una comunicazione, chi la riceve prende una notifica sul telefono; toccarla
apre **quell'avviso**, non l'elenco. Il numero sull'icona dell'app segue i non letti, in
salita e in discesa: lo tiene allineato l'app, perché deve scendere quando un avviso viene
letto e di quello le notifiche non sanno niente.

Il token del dispositivo lo scrive l'app in `users/{uid}/pushTokens/{id}`. Il permesso si
chiede **all'ingresso nell'area riservata** e non alla prima apertura: prima del login non
c'è nessuno a cui mandare niente, e un pannello di sistema davanti alla schermata di
accesso è la richiesta fuori contesto per eccellenza — quella che si nega per riflesso.
All'uscita dall'account il token viene dimenticato: su un telefono passato di mano non
devono più comparire le comunicazioni di Revna a quella struttura.

**Servono una development build e un `projectId` EAS** (`expo.extra.eas.projectId` in
`app.json`, da `eas init`): da Expo SDK 53 Expo Go non riceve più notifiche remote. Senza
di questi, `lib/push.ts` si arrende in silenzio e il resto continua a funzionare — gli
avvisi si vedono nell'app con il loro pallino, che è la stessa cosa che vede chi ha negato
le notifiche. A permesso negato la sezione lo dice, in fondo all'elenco e una volta sola.

## Documenti

La tab Documenti elenca in tempo reale i materiali che Revna ha condiviso con questa
struttura. I file sono trattati come riservati: Storage nega la lettura diretta, e il
link lo rilascia la function `getDocumentUrl` con validità di 5 minuti. Si chiede solo
al momento dell'apertura, così non restano in giro link ancora validi.

Il file si apre nel browser in-app (`expo-web-browser`), da cui il sistema offre
salvataggio e condivisione su entrambe le piattaforme.

## Richieste di contatto

Quando l'assistente non basta, il cliente chiede una persona. Due strade, che finiscono
nella stessa coda del backoffice.

**Dalla chat.** Se l'assistente capisce di non potercela fare, la risposta arriva con una
proposta di richiesta già scritta (campo `proposal` sul turno, vedi `backend/README.md`).
Sotto quella risposta compare l'offerta di essere ricontattati; il tocco apre una modale
con il testo **modificabile** e chiede conferma esplicita. L'assistente propone le
parole, quelle che partono sono quelle che il cliente ha letto e voluto. Insieme alla
richiesta viaggia l'id della conversazione, così dal backoffice si legge come si è
arrivati fin lì.

Il marcatore con cui il modello segnala la proposta non deve comparire mai, nemmeno per
un istante: la risposta finale arriva dal server già pulita, e durante lo streaming
`stripHandoff` taglia il testo al primo `<<`.

**Dalla sezione «Richieste».** Non tutto nasce da una domanda all'assistente: a volte si
vuole parlare con una persona e basta, e quella strada non deve passare per una chat.
Stessa modale, foglio bianco.

La sezione esiste anche per il dopo: una richiesta, dopo averla mandata, bisogna poterla
ritrovare. L'elenco è in ascolto live su `contactRequests` filtrato sul proprio `uid`, e
mostra lo stato — **inviata**, **visualizzata**, **chiusa** — con una riga che dice cosa
significa. È l'attesa fra l'invio e la prima risposta quella che fa dubitare di essere
stati ascoltati: «visualizzata» arriva nell'app nel momento in cui un referente Revna
apre la richiesta, senza che il cliente debba ricaricare niente.

Sotto ogni richiesta c'è il recapito con cui è partita, che è la seconda domanda di chi
aspetta una chiamata: dove mi chiamano.

## Profilo struttura

`profilo/index.tsx` legge in tempo reale `users/{uid}` da Firestore: se il consulente
aggiorna il profilo dal backoffice, l'app se ne accorge senza riavvio. Il cliente vede
tutto e può scrivere solo le proprie note — le regole Firestore ammettono dal client il
solo campo `profile.noteCliente`.

I tipi stanno in `src/lib/profile.ts`, allineati a `backend/functions/src/profile.ts`.
Le **etichette** delle liste a valori chiusi (tipologie, servizi, canali, target…) no:
stanno nei dizionari in `src/lib/i18n/`, perché i valori sono un contratto con il
backend e le etichette sono testo d'interfaccia da tradurre. Le chiavi di quei record
sono esattamente i valori ammessi, quindi la lista è scritta una volta per lingua e il
compilatore tiene le due allineate.

Dall'intestazione si arriva a **Impostazioni** (vedi sotto).

## Lingua

L'interfaccia esiste in italiano e in inglese. I testi stanno in `src/lib/i18n/`:
`it.ts` è la forma autorevole del dizionario (`Dictionary` è il suo `typeof`) ed `en.ts`
la riempie con l'annotazione `: Dictionary`. È quell'annotazione a far fallire la
compilazione quando una chiave manca — una traduzione dimenticata la trova `tsc`, non un
cliente che vede la scritta sbagliata. **Le due lingue si aggiornano nello stesso commit.**

Nessuna libreria di i18n: due lingue e qualche centinaio di stringhe non ripagano un
formato di file in più, e un oggetto tipizzato dà comunque chiavi verificate,
interpolazione e liste a valori chiusi.

Nelle schermate:

```tsx
const t = useT();               // solo testo
const { language, setLanguage, t } = useLanguage(); // anche il cambio lingua
```

`LanguageProvider` sta in `src/app/_layout.tsx` **sopra** lo Stack, perché la lingua
serve già ad accesso e attivazione. Monta i figli solo dopo aver letto la preferenza
salvata: partire dalla lingua di sistema e correggerla dopo mostrerebbe, a chi ha scelto
l'altra, un lampo nella lingua sbagliata a ogni avvio.

La scelta sta in AsyncStorage (`revna.language`) e non sul profilo utente: serve anche
prima del login, quando non c'è un utente su cui salvarla. Al primo avvio si deduce dalle
lingue preferite del telefono (`expo-localization`), guardandole tutte e non solo la
prima; se nessuna è tra le nostre si ripiega sull'italiano.

Anche le date passano da qui: `t.dateLocale` è il tag per `toLocaleDateString`, perché
`'it'` e `'en'` non sono locale validi.

Restano **in italiano per costruzione** le cose che l'app non scrive: gli spunti della
chat vuota e i profili redatti da Revna dal backoffice, e i titoli delle conversazioni,
che li genera il modello. Gli spunti di scorta, quelli sì, sono tradotti.

## Impostazioni

`profilo/impostazioni.tsx` — lingua dell'interfaccia, cambio password, cambio email.

Non è una sezione della navigazione principale ma una schermata impilata dentro Profilo
(`profilo/_layout.tsx` è uno Stack): ci si passa raramente, e in cima al menu avrebbe lo
stesso peso della chat. Impilata si porta dietro gratis il gesto «indietro» del sistema.

Password ed email si cambiano da qui e **non** dal backoffice: sono le credenziali di chi
entra, e il consulente Revna non deve poterle né vedere né scegliere.

Entrambe chiedono di nuovo la password attuale (`reauthenticateWithCredential`): è quello
che Firebase pretende per un'operazione sensibile, e ha senso anche per noi — il telefono
sbloccato di qualcun altro non basta a prendersi l'accesso.

L'email passa da `verifyBeforeUpdateEmail` e non da `updateEmail`: il cambio scatta solo
quando il cliente apre il link mandato al **nuovo** indirizzo, così un refuso non lo
chiude fuori dal suo account. Fino alla verifica entra ancora con l'email di prima.
Il link lo manda Firebase, non il nostro mailer: è l'unico modo di far verificare un
indirizzo che ancora non è sull'utenza.

Non serve toccare il backoffice: l'elenco clienti legge l'email da Firebase Auth
(`listClients`), quindi il cambio si vede da sé.

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

## Font

Il font del brand è **Rethink Sans** ([Google Fonts](https://fonts.google.com/specimen/Rethink+Sans)),
dal pacchetto `@expo-google-fonts/rethink-sans`. I file sono caricati all'avvio in
`src/app/_layout.tsx` (`SansFontAssets`), e fino a quel momento resta lo splash: meglio
un istante in più che vedere l'app cambiare font sotto gli occhi.

Carichiamo i file anche sul web, invece di puntare alla CDN di Google: un solo modo di
dire «Rethink Sans» su tutte le piattaforme, e nessuna dipendenza da un dominio esterno.

**Ogni peso è una famiglia a sé**, perché è un file a sé: il peso si scrive nel nome della
famiglia, non in `fontWeight`. Lasciare `fontWeight` su una famiglia che è già quella del
peso giusto fa applicare al sistema un finto grassetto — il testo viene più pesante di
quanto il font prevede. Da qui i due aiuti in `constants/theme.ts`:

```tsx
// peso noto: dentro uno StyleSheet
bold: sansStyle(700),
italic: sansStyle(400, true),

// peso che arriva da fuori: lo stile appiattito diventa la famiglia giusta
<Text style={withSansFont(StyleSheet.flatten([styles.base, style]))} />
```

`ThemedText` fa già la seconda cosa, quindi il testo dell'app va scritto con quello e
`fontWeight` continua a funzionare come si aspetta chi lo usa. Restano da dichiarare a
mano i `TextInput`, che non passano da `ThemedText`: `fontFamily: Fonts.sans`.

Pesi caricati: 400, 500, 600, 700, 800 in tondo; 400 e 700 in corsivo (il corsivo compare
solo nel markdown delle risposte). `sansStyle` avvicina al peso più prossimo fra questi.

## Emulatori Firebase

Metti `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1` in `.env.local` e avvia gli emulatori da
[`../backend`](../backend). Su emulatore Android l'host va impostato a `10.0.2.2`.
