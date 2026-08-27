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
│   ├── brand/            # loghi Revna originali in SVG (file sorgente del brand)
│   └── *.png             # icona app, splash, favicon (dal monogramma, su fondo #060505)
└── src/
    ├── theme/            # il sistema visivo: colore, forma, tipografia, movimento
    ├── app/              # schermate — routing file-based di Expo Router
    │   ├── login.tsx     # accesso cliente
    │   ├── recupera.tsx  # richiesta del link per rifare la password
    │   ├── attiva.tsx    # scelta password: prima attivazione e recupero
    │   ├── index.tsx     # smistamento: area riservata o login
    │   └── (app)/        # area riservata — Drawer
    │       └── (main)/   # Stack: qui si impilano le schermate di dettaglio
    │           ├── (tabs)/           # le cinque sezioni, con la tab bar
    │           │   ├── chat.tsx      # conversazione con l'assistente
    │           │   ├── avvisi.tsx    # elenco delle comunicazioni di Revna
    │           │   ├── documenti.tsx # materiali condivisi da Revna
    │           │   ├── blog.tsx      # articoli di Revenue su Misura
    │           │   └── profilo.tsx   # scheda struttura + note personali
    │           ├── avvisi/[id].tsx   # un avviso per esteso (senza tab bar)
    │           ├── richieste.tsx     # richieste di contatto e loro stato
    │           └── impostazioni.tsx  # memoria dell'assistente, lingua, password, email
    ├── components/
    │   ├── ui/           # gli atomi del sistema visivo (vedi sotto)
    │   ├── brand/        # lettering e monogramma Revna, come componenti SVG
    │   └── *.tsx         # composti dell'app: sidebar, tab bar, markdown, sources…
    ├── constants/        # legal.ts (URL delle informative)
    ├── hooks/            # use-auth, use-assistant, use-memory, use-language, use-announcements…
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

## Il sistema visivo

Tutto quello che riguarda l'aspetto sta in `src/theme/` e in `src/components/ui/`. Una
schermata non decide un colore, una misura o un raggio: sceglie un token e un
componente. Se serve una forma nuova si aggiunge **una volta** in `components/ui`.

### Colore — `theme/palette.ts`

L'app ha **una sola apparenza, quella scura**, e non è una scorciatoia: `#DD5237` è il
Cinnabar da stampa e su fondo nero perde luce, quindi a schermo l'accento è **`#FF5C36`
(Cinnabar Live)**, che su fondo chiaro non regge. La scala di grigi è White Smoke
(`#F4F4F4`) a opacità decrescente, che su bianco non esiste. Un tema chiaro non sarebbe
lo stesso sistema con i colori invertiti: sarebbe un secondo sistema.

Per questo i token sono **costanti** e non un hook: `#FF5C36` non cambia mai, quindi i
colori possono stare dentro `StyleSheet.create`, che è il posto giusto per uno stile che
non cambia. `useTheme()` non c'è più.

| Gruppo | A cosa serve |
| --- | --- |
| `Brand` | accento (`accent`), accento da stampa, accento schiarito, inchiostro |
| `Surface` | i tre piani: `base` (il fondo), `raised`, `card`, `element`, `control` |
| `Ink` | il testo per ruolo: `primary` 100%, `body` 86%, `secondary` 56%, `faint` 34%, `ghost` 28% |
| `Line` | `hairline` 9%, `field` 10%, `glass` 14%, e i due bordi in accento |
| `Glass` | i tre livelli di vetro, e la sfocatura prevista dal sistema |
| `Danger` | l'unico rosso funzionale, `#FF6B6B`, mai accanto all'accento |

### Forma — `theme/shape.ts` e `components/ui/bevel.tsx`

Il segno del brand è la **smussatura**: due angoli tagliati in diagonale, sempre gli
stessi due (alto a sinistra, basso a destra), in quattro misure e solo quattro —
`Corner.surface` 22, `Corner.card` 14, `Corner.control` 8, `Corner.badge` 4. La diagonale non
si specchia e non si somma: un box smussato su tutti e quattro gli angoli non è più il
segno Revna, è un ottagono.

In React Native `clip-path` non esiste, quindi la smussatura la disegna **un solo
componente**, `<Bevel>`: un `Path` di `react-native-svg` dietro il contenuto che fa sia
riempimento sia bordo, così la diagonale ha il filo come gli altri lati.

```tsx
<Bevel radius={Corner.card} fill={Surface.card} stroke={Line.accent}>…</Bevel>
```

Il `Path` ha bisogno di misure in pixel e le misure arrivano dal layout: il fondo compare
un frame dopo il contenuto. È il prezzo di avere una sola implementazione della forma, e
a occhio non si vede — mentre un fondo con angoli quadrati, dove il sistema ne vuole due
smussati, si vede sempre.

Due prop meno ovvie:

- `highlight` — la linea di luce del vetro: solo il lato in alto e la diagonale che lo
  chiude, perché sotto un elemento che galleggia il bordo non c'è.
- `mask` — il colore del fondo, **ridipinto sopra** i due angoli. Serve dove il contenuto
  è opaco e arriva fino al bordo (una copertina del blog, l'immagine di un avviso):
  `overflow: 'hidden'` conosce solo il rettangolo e gli angoli tondi, mentre due triangoli
  del colore del fondo fanno quello che farebbe una maschera, su tutte le piattaforme.

### Tipografia — `theme/typography.ts`

**Funnel Display** per i titoli (600 e 700, tracking negativo), **Funnel Sans** per tutto
il resto — dai pacchetti `@expo-google-fonts/funnel-display` e `.../funnel-sans`. I file
sono caricati all'avvio in `src/app/_layout.tsx` (`FontAssets`) e fino a quel momento
resta lo splash: meglio un istante in più che vedere l'app cambiare font sotto gli occhi.

Ogni peso è un file, quindi una famiglia a sé: **il peso si scrive nel nome della
famiglia**, non in `fontWeight`. Lasciare `fontWeight` su una famiglia che è già quella
del peso giusto fa applicare al sistema un finto grassetto.

I ruoli sono nove e **non c'è misura intermedia**. Sei sono i livelli delle fondamenta,
tre sono gli elementi ricorrenti che nel sistema hanno una misura propria:

| Ruolo | Misura | Dove |
| --- | --- | --- |
| `display` | Display 700 · 40/42 | il lettering di una schermata d'ingresso |
| `title` | Display 600 · 28/32 | il titolo di una sezione |
| `section` | Display 600 · 19/24 | un titolo dentro il contenuto |
| `rowTitle` | Display 600 · 15/20 | il titolo di una riga d'elenco |
| `stat` | Display 700 · 26/28 | il numero grande di una statistica |
| `body` | Sans 400 · 15/23 | il corpo del testo |
| `service` | Sans 500 · 13/19 | sottotitoli, etichette, aiuti |
| `micro` | Sans 600 · 11/14 maiuscoletto | occhielli e metadati |
| `tab` | Sans 600 · 10/12 | l'etichetta di una tab |

Il colore fa parte del ruolo: «servizio» non è solo 13/19, è 13/19 al 56% — separarli
vorrebbe dire deciderlo di nuovo ogni volta. Si scrive così:

```tsx
<Text variant="title">Avvisi</Text>
<Text variant="service" color={Ink.secondary}>Aggiornato tre minuti fa</Text>
```

Restano da dichiarare a mano i `TextInput`, che non passano da `Text`: lo fa già
`components/ui/field.tsx`, e nei due campi che non sono `Field` (il composer della chat)
la famiglia è scritta nello stile.

### Movimento — `theme/motion.ts`

Tocco 120 ms, entrate 220 ms sulla curva `0.2 / 0.8 / 0.2 / 1`, foglio 320 ms.
**L'arancio non pulsa mai, tranne il caret dello streaming**: è l'unica cosa nell'app che
deve dire «sta succedendo adesso», e perché si legga così nient'altro può lampeggiare.

### Gli atomi — `components/ui/`

| File | Cosa contiene |
| --- | --- |
| `bevel.tsx` | la smussatura: l'unico posto dove è disegnata |
| `text.tsx` | `Text` con i nove ruoli |
| `button.tsx` | `Button` (piena / secondaria / contorno) e `IconButton` (quadrato smussato) |
| `field.tsx` | `Field`, `PasswordField` (con «Mostra»), `FieldNote` |
| `surface.tsx` | `Card`, `AccentCard`, `BlockLabel`, `DataRow` |
| `glass.tsx` | `GlassBar` (tab bar), `GlassPanel` (composer) |
| `row.tsx` | `AccentRow`, `QuietRow`, `Tile` |
| `chip.tsx` | `SourceChip`, `SourceMarker`, `StatusChip`, `Tag`, `FormatBlock` |
| `mark.tsx` | `Mark` (monogramma nel quadrato arancione), `AssistantSignature` |
| `waiting.tsx` | `TypingDots`, `StreamCaret` |
| `glow.tsx` | `AccentGlow`: l'alone, come gradiente radiale e non come ombra |
| `screen.tsx` | `Screen`, `ScreenBar`, `PageHeading`, `EmptyState`, `ErrorNote` |
| `icon.tsx` | le dodici icone di linea, tratto 1.7 |

## Navigazione

Due piani, e non è una ridondanza.

**La tab bar** in fondo tiene le cinque sezioni — Assistente, Avvisi, Documenti, Blog,
Profilo: si passa da una all'altra col pollice, senza aprire niente. È disegnata da noi
(`components/app-tab-bar.tsx`) sopra le `Tabs` di `expo-router/js-tabs`, perché nel
sistema Revna la tab attiva è una tessera smussata in velatura d'accento, e la smussatura
in quella di serie non esiste. Il contatore sta **solo** su Avvisi: è l'unica sezione in
cui può arrivare qualcosa che il cliente non ha chiesto.

**Il pannello laterale** (`components/app-sidebar.tsx`) tiene ciò che in una tab bar non
sta: lo **storico delle conversazioni**, che in un assistente è la cosa che si apre più
spesso, e in fondo le due voci di servizio — richieste e impostazioni. Le cinque sezioni
qui **non si ripetono**: un menu che rifà la barra sotto costringe a scegliere due volte
la stessa strada.

L'annidamento è `Drawer › Stack › Tabs`, e ogni livello ha un compito:

```
(app)/_layout.tsx              Drawer  — il pannello laterale, disponibile da ogni schermata
(app)/(main)/_layout.tsx       Stack   — le schermate di dettaglio, impilate
(app)/(main)/(tabs)/_layout.tsx Tabs   — le cinque sezioni
```

Avviso aperto, richieste e impostazioni stanno **fuori** dalle tab e dentro lo Stack:
impilate si portano dietro gratis il gesto «indietro» del sistema, e soprattutto la tab
bar sparisce — sono schermate in cui l'unica strada è tornare da dove si è arrivati, e
cinque sezioni in fondo direbbero il contrario.

## La chat

La risposta arriva **in streaming**: la function invia i pezzi con `sendChunk` mentre
il modello scrive, e la schermata riscrive l'ultimo turno a ogni chunk.

C'è un dettaglio non ovvio dietro: il `fetch` di React Native non espone
`response.body`, quindi le callable in streaming del Firebase SDK non funzionerebbero.
In `src/lib/firebase/index.ts` sostituiamo il `fetchImpl` interno del SDK con quello di
`expo/fetch`, che espone un vero `ReadableStream`. Non è API pubblica, perciò è protetto:
se dovesse sparire, `supportsStreaming()` torna false e la chat ripiega sulla risposta
unica. Stesso ripiego se lo streaming fallisce prima di aver prodotto qualcosa.

A conversazione vuota il monogramma fa da segno d'attesa — grande e con l'alone — e gli
spunti sono **tessere a piena larghezza**: si leggono con una mano, invece di essere tre
bottoni in fila da centrare. A conversazione avviata il monogramma torna piccolo, come
firma di ogni risposta.

Il markdown è reso da `src/components/markdown.tsx`, scritto a mano invece di usare una
libreria: durante lo streaming il testo è quasi sempre markdown incompleto, e un parser
tollerante mostra il testo grezzo per un istante invece di rompersi.

L'attesa ha **due stati e si vedono diversi**: i puntini fra l'invio e il primo pezzo di
risposta, il caret arancione mentre il testo arriva. Finché non è arrivato niente non c'è
testo a cui attaccare un cursore, e un cursore da solo in mezzo al vuoto non dice che la
domanda è partita.

Il client manda al server solo il messaggio nuovo e l'id della conversazione: lo
storico lo rilegge il server. I turni nello stato servono a disegnare la schermata,
non a ricostruire il contesto.

Ogni risposta è preceduta da `AssistantSignature`: monogramma Revna, nome e la dicitura
«Risposta generata da AI». È trasparenza dovuta, non decorazione — non va rimossa. La
riga «le risposte possono contenere errori» sotto il composer compare invece solo a
conversazione vuota: da lì in poi la trasparenza la porta la firma, che sta su ogni
singola risposta.

### Le fonti sotto le risposte

Quando una risposta poggia sul materiale Revna, sotto compaiono i **chip numerati** di
`components/sources.tsx`. Gli stessi numeri compaiono in accento **dentro il testo**, dove
il modello scrive `[1]`: li rende il parser inline di `components/markdown.tsx`, così si
risale da una singola affermazione alla sua fonte e non solo alla risposta nel suo insieme.
I chip stanno in fondo e non in cima perché non sono un disclaimer, sono una firma.

Le fonti le decide il server: `askAssistant` seleziona il materiale, lo numera nel prompt
e traduce i marcatori scritti dal modello in `sources` strutturate. Il client non ne
compone nessuna — nemmeno potrebbe, la base di conoscenza non è leggibile dall'app.

Durante lo streaming le fonti **non** ci sono ancora: arrivano con la risposta finale,
insieme al testo con i marcatori rinumerati, che sostituisce quello mostrato a pezzi.

Le fonti sono salvate sul turno in Firestore: riaprendo una conversazione dal pannello
laterale ricompaiono, perché sono parte della risposta e non un ornamento del momento.

> **Da fare.** Nel design i chip delle fonti sono *toccabili*: aprono il materiale
> citato. Oggi non lo sono, perché una `Source` porta un numero e un titolo e non il
> riferimento al documento — servirebbe un campo in più dal backend (vedi «Cosa manca»).

Gli **spunti** della chat vuota non sono una costante dell'app: `use-starters.ts` li
legge da `agent/public`, dove li scrive Revna dal backoffice. Fanno parte della
personalità dell'assistente, non del codice. Se il documento manca o la lettura fallisce
restano quattro spunti di scorta: una chat vuota senza appigli è peggio di spunti non
aggiornati.

## Avvisi

È l'unica sezione in cui il contenuto arriva **senza che il cliente l'abbia chiesto**:
sono le comunicazioni che Revna scrive dal backoffice. Per questo l'elenco distingue letto
da non letto prima di ogni altra cosa — ed è la prima domanda con cui si entra qui.

Nel sistema Revna «da leggere» e «già letto» non sono la stessa riga con un pallino in
più: sono **due componenti diversi**. `AccentRow` è la card in velatura d'accento con la
barra laterale, `QuietRow` è una riga di testo su una linea sottile. Metterli a confronto
dice da lontano cosa richiede attenzione.

Il contatore dei non letti sta nella **tab bar**, cioè si vede da qualsiasi schermata: per
questo gli avvisi vivono in un provider sopra la navigazione
(`hooks/use-announcements.tsx`) e non dentro la schermata. Senza un posto comune, ogni
componente che mostra quel numero aprirebbe una propria connessione a Firestore per
contare le stesse righe.

L'elenco è in ascolto live su `users/{uid}/announcements`, come i documenti: un avviso che
arriva mentre l'app è aperta compare da sé, e lo stesso vale per una **correzione** — se
il consulente riscrive il testo di una comunicazione già mandata, chi la sta leggendo vede
la versione giusta.

Aprire un avviso lo segna come letto (`markAnnouncementRead`). Non c'è un bottone «segna
come letto»: leggere è quello che è appena successo, e lasciarlo a un tocco vorrebbe dire
un contatore acceso su una comunicazione che il cliente ha davanti agli occhi. Il numero
scende subito, senza attendere la risposta del server.

Il testo è markdown e lo rende `components/markdown.tsx`, lo stesso renderer delle
risposte dell'assistente, esteso con le **immagini** — che l'assistente non produce ma un
avviso sì. Due renderer per lo stesso markdown vorrebbero dire due modi in cui un titolo
può apparire nell'app.

In fondo all'avviso c'è **una** azione: «Chiedi cosa cambia per me» apre una conversazione
nuova con la domanda già scritta nel composer, **senza inviarla** — il testo si corregge
prima di partire, perché è il cliente a chiedere, non l'app a chiedere per lui. Il
meccanismo è `prefill()` in `use-assistant.tsx`.

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
di questi, `lib/push.ts` si arrende in silenzio e il resto continua a funzionare. A
permesso negato la sezione lo dice, in fondo all'elenco e una volta sola.

## Documenti

La sezione elenca in tempo reale i materiali che Revna ha condiviso con questa struttura.
Il **tipo di file** è la prima informazione che serve, quindi diventa un blocco di formato
a sinistra della riga (`FormatBlock`, con il formato ricavato dall'estensione in
`lib/documents.ts`); categoria, peso e data stanno in coda; **«Nuovo»** è l'unico uso
dell'arancio nell'elenco, e vuol dire «arrivato negli ultimi sette giorni» — non «non
l'hai ancora aperto», che l'app non può sapere perché i documenti si aprono nel browser.

I file sono trattati come riservati: Storage nega la lettura diretta, e il link lo rilascia
la function `getDocumentUrl` con validità di 5 minuti. Si chiede solo al momento
dell'apertura, così non restano in giro link ancora validi.

Il file si apre nel browser in-app (`expo-web-browser`), da cui il sistema offre
salvataggio e condivisione su entrambe le piattaforme.

## Richieste di contatto

Quando l'assistente non basta, il cliente chiede una persona. Due strade, che finiscono
nella stessa coda del backoffice.

**Dalla chat.** Se l'assistente capisce di non potercela fare, la risposta arriva con una
proposta di richiesta già scritta (campo `proposal` sul turno, vedi `backend/README.md`).
Sotto quella risposta nasce la card «Ti faccio richiamare» (`components/handoff-card.tsx`),
che mostra **già lì** il testo proposto: chi sta per firmare una richiesta deve sapere cosa
c'è scritto. «Rivedi e invia» apre il foglio in cui correggerlo e chiede conferma
esplicita; «No grazie» mette la card da parte. L'assistente propone le parole, quelle che
partono sono quelle che il cliente ha letto e voluto. Insieme alla richiesta viaggia l'id
della conversazione, così dal backoffice si legge come si è arrivati fin lì.

Il marcatore con cui il modello segnala la proposta non deve comparire mai, nemmeno per
un istante: la risposta finale arriva dal server già pulita, e durante lo streaming
`stripHandoff` taglia il testo al primo `<<`.

**Dalla sezione «Richieste».** Non tutto nasce da una domanda all'assistente: a volte si
vuole parlare con una persona e basta, e quella strada non deve passare per una chat.
Stessa modale, foglio bianco. La sezione sta nel pannello laterale e non nella tab bar: è
la schermata che si apre quando si sta aspettando una risposta, non una delle cinque in
cui si vive.

Esiste anche per il dopo: una richiesta, dopo averla mandata, bisogna poterla ritrovare.
L'elenco è in ascolto live su `contactRequests` filtrato sul proprio `uid`, e mostra lo
stato — **inviata**, **visualizzata**, **chiusa** — con una riga che dice cosa significa.
Lo stato ha tre toni, dal vivo allo spento: chiuso non deve più chiamare l'occhio.

Sotto ogni richiesta c'è il recapito con cui è partita, che è la seconda domanda di chi
aspetta una chiamata: dove mi chiamano.

## Profilo struttura

`(tabs)/profilo.tsx` legge in tempo reale `users/{uid}` da Firestore: se il consulente
aggiorna il profilo dal backoffice, l'app se ne accorge senza riavvio. Il cliente vede
tutto e può scrivere solo le proprie note — le regole Firestore ammettono dal client il
solo campo `profile.noteCliente`.

I dati stanno come **numeri grandi** e non come modulo grigio da compilare: chi apre
questa schermata vuole vedere che l'assistente conosce la sua struttura, e tre numeri
— unità, anno di apertura, canali attivi — lo dicono meglio di dodici righe di etichette.
Il resto sta sotto, in schede con la tabella chiave/valore (`DataRow`).

Le note del cliente sono in fondo e si aprono con «Modifica»: la bozza in corso di
scrittura è **stato derivato** e non una copia tenuta allineata da un effetto — la verità
è quella del server, e a salvataggio riuscito la bozza si azzera e si torna a leggerla, che
è anche il modo in cui una nota cambiata da un altro dispositivo ricompare.

I tipi stanno in `src/lib/profile.ts`, allineati a `backend/functions/src/profile.ts`.
Le **etichette** delle liste a valori chiusi (tipologie, servizi, canali, target…) no:
stanno nei dizionari in `src/lib/i18n/`, perché i valori sono un contratto con il
backend e le etichette sono testo d'interfaccia da tradurre.

Dall'intestazione si arriva a **Impostazioni**.

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
che li genera il modello. Il claim «Rethink your revenue.» sulla schermata d'accesso è
lettering del brand: non si traduce, come non si traduce il nome.

## Impostazioni

`(main)/impostazioni.tsx` — memoria dell'assistente, lingua dell'interfaccia, cambio
password, cambio email.

Non è una sezione della tab bar ma una schermata impilata, raggiungibile dal pannello
laterale e dall'intestazione del profilo: ci si passa raramente, e in una barra da cinque
avrebbe lo stesso peso della chat. Impilata si porta dietro gratis il gesto «indietro».

### La memoria dell'assistente

La prima scheda della schermata: **le preferenze** che il cliente ha dato all'assistente
parlando — come vuole le risposte, cosa non deve fare — una per riga, con la data in cui
l'assistente le ha imparate e la conversazione da cui sono venute fuori
(`hooks/use-memory.ts`; le righe stanno in `users/{uid}/memory`).

Preferenze e non dati della struttura, ed è la scelta che tiene in piedi la schermata: i
numeri cambiano, e una lista di numeri che si contraddicono è esattamente quello che il
cliente non deve trovare qui. Quelli stanno nel profilo. Il perché sta in
`backend/README.md`, sezione «La memoria dell'assistente», insieme al come ci finiscono.

Sta nelle impostazioni e non in una sezione sua perché è una cosa che si **controlla**, non
che si usa: una rotta propria l'avrebbe trasformata in una funzione da cercare. La promessa
che dimostra — «gliel'ho detto una volta e se lo ricorda» — si vede nella chat, non qui.

L'elenco è **in ascolto live**: con una conversazione in corso su un altro dispositivo, la
riga nuova compare da sé mentre la schermata è aperta.

Tre libertà, e nient'altro: **correggere** il testo di una riga, **dimenticarne** una,
**cancellare tutto** (che passa da `clearMemory`, perché sono cancellazioni su un numero di
documenti che l'app non conosce, e a metà strada lascerebbero una memoria mutilata invece
di una vuota). Aggiungere una preferenza a mano no: se il cliente potesse scrivere lì,
quella smetterebbe di essere la memoria dell'assistente — cioè ciò che ha capito, la sola
cosa che vale la pena verificare — e diventerebbe un secondo campo note, che nel profilo
c'è già. Le regole Firestore ammettono dall'app esattamente `testo`, `updatedAt` e
`origine`, e la cancellazione.

### Credenziali

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

## Loghi e icone

Gli originali del brand sono in `assets/images/brand/`:

| File | Uso |
| --- | --- |
| `logo_dark.svg` | logo completo per sfondi chiari |
| `logo_light.svg` | logo completo per sfondi scuri |
| `revna_dark.svg` | solo lettering |
| `revna_R.svg` | monogramma "R" — sorgente di icona, splash e favicon |

Nell'app **non** si importano come file: `components/brand/wordmark.tsx` e
`components/brand/monogram.tsx` sono componenti `react-native-svg` con i tracciati
dentro e un prop `color`. Così il lettering può essere White Smoke e il monogramma nero
sopra l'arancio, che è quello che il sistema chiede — mentre un `.svg` con le tinte
scritte nel file non si ricolora, e le classi CSS che quei file usano
`react-native-svg` non le legge in modo affidabile.

```tsx
<Wordmark width={132} />              // White Smoke, il default
<Monogram height={46} />              // l'accento, il default
```

Due dettagli che sembrano piccoli e non lo sono:

- I numeri dei tracciati sono **arrotondati alla terza cifra**. I file originali ne hanno
  diciotto e omettono il separatore fra un numero e il successivo
  (`-1.620652909050477.246803898819053`): è SVG valido, i browser lo leggono, ma è la
  forma che i parser dei path nativi digeriscono peggio — e su un canvas di 260 unità
  quelle cifre non disegnano nulla.
- Il **segno dell'assistente** (`components/ui/mark.tsx`) disegna quadrato arancione e
  monogramma **dentro lo stesso `Svg`**, non come due livelli sovrapposti: è un grafico
  unico, e due `Svg` fratelli sono due livelli che una piattaforma può comporre a modo
  suo — su nativo il risultato era il quadrato senza la R. Per questo `monogram.tsx`
  esporta anche `MONOGRAM_PATH` e `MONOGRAM_BOX`.

Icona, splash e favicon sono **il monogramma in Cinnabar Live su `#060505`**, rigenerati
dal monogramma quando l'app è passata all'apparenza scura.

> Da rivedere quando arriva il brand book definitivo e l'eventuale logo "Revna AI".

## Emulatori Firebase

Metti `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=1` in `.env.local` e avvia gli emulatori da
[`../backend`](../backend). Su emulatore Android l'host va impostato a `10.0.2.2`.
