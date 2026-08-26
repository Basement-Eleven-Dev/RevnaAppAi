# Revna AI — Backoffice

Pannello interno Revna, in **Angular 21** (standalone, zoneless) con il **Firebase Web SDK**.

## Avvio

```bash
npm install
npm start
```

Poi http://localhost:4200.

> Angular è alla 22, ma richiede Node ≥ 24.15: qui siamo su Angular 21 perché gira
> sulla versione di Node installata. Aggiornato Node, basta `ng update`.

## Rotte

| Rotta | Cosa fa | Protezione |
| --- | --- | --- |
| `/login` | Accesso dei referenti Revna | `guestGuard` |
| `/utenti` | Creazione delle utenze cliente | `adminGuard` |
| `/clienti` | Elenco clienti: rinomina, disattiva, riattiva | `adminGuard` |
| `/clienti/:uid` | Profilo struttura completo, in modifica | `adminGuard` |
| `/clienti/:uid/documenti` | Documenti condivisi con quel cliente | `adminGuard` |
| `/clienti/:uid/conversazioni` | Le sue chat con l'assistente, in sola lettura | `adminGuard` |
| `/richieste` | Coda delle richieste di contatto; `?cliente=<uid>` per un cliente solo | `adminGuard` |
| `/comunicazioni` | Avvisi ai clienti: bozze, inviate, letture | `adminGuard` |
| `/comunicazioni/:id` | Una comunicazione (`nuova` per scriverla) | `adminGuard` |
| `/assistente` | Personalità dell'assistente: chi è, come ragiona, come scrive | `adminGuard` |
| `/assistente/conoscenza` | Base di conoscenza Revna, elenco e peso | `adminGuard` |
| `/assistente/conoscenza/:id` | Una voce di conoscenza (`nuova` per crearla) | `adminGuard` |
| `/assistente/prova` | Prova l'assistente fingendosi l'albergatore di un cliente | `adminGuard` |
| `/attiva` | Atterraggio del link nell'email, rimanda all'app | pubblica |

## Stesso backend dell'app

Backoffice e app mobile usano **lo stesso progetto Firebase** (`revnaappai`): stessa base
utenti Authentication, stesse Cloud Functions. Non ci sono due backend e non ci sono
due elenchi di utenti.

A distinguere i due accessi è un **custom claim**, `revnaAdmin`:

- ce l'ha → è un referente Revna, entra nel backoffice
- non ce l'ha → è un cliente, usa l'app; se prova a entrare qui il login lo rifiuta
  e chiude subito la sessione

Il claim non è assegnabile dal client: lo mette solo l'Admin SDK, dentro le Cloud Functions.

## Creazione delle utenze

`/utenti` chiama la callable `createInvite`, che crea l'account con l'Admin SDK, manda
l'email di attivazione via Resend e restituisce il link. Finché la chiave Resend non è
configurata l'email non parte: la pagina lo segnala e mostra il link da copiare — che è
anche il modo più rapido per attivare un'utenza di prova.

`/clienti` chiama `listClients` e `updateClient`. Disattivare revoca le sessioni: il
cliente viene buttato fuori dall'app entro pochi minuti.

La password non si imposta nel backoffice né su una pagina Firebase: `/attiva` rimanda
all'app, dove il cliente la sceglie.

## Documenti

`/clienti/:uid/documenti` carica su Cloud Storage in `clients/{uid}/documents/` e scrive
la scheda in `users/{uid}/documents/`. Più file alla volta, uno per volta in sequenza,
con barra di avanzamento: così la progressione resta leggibile e un errore non travolge
gli altri file.

Il download passa da `getDocumentUrl`: la lettura diretta su Storage è negata anche ai
referenti Revna, e il link vale 5 minuti.

L'ordine delle due scritture è voluto: prima il file, poi la scheda. Se il caricamento
fallisce non resta una scheda che punta al vuoto; il caso opposto lascia un file orfano
su Storage, meno grave e visibile dalla console.

## Richieste di contatto

`/richieste` è il capolinea di quello che l'assistente non ha potuto risolvere: se una
richiesta resta qui senza che nessuno la guardi, il cliente ha chiesto di parlare con una
persona e non è arrivato nessuno. Per questo la pagina parte da **quelle aperte** e dice
da quanto aspettano, invece di presentare uno storico completo.

Due colonne come per le conversazioni: la coda si lavora una riga alla volta senza
perdere di vista quello che resta. Nel dettaglio c'è il recapito del cliente pronto da
usare — telefono e email cliccabili — la richiesta come l'ha scritta, il link alla
conversazione da cui è nata e quello alla sua scheda.

**Aprire una richiesta la segna come «visualizzata»**, e il cliente lo vede nell'app.
È il solo passaggio di stato automatico, ed è automatico perché è esattamente quello che
è appena successo: qualcuno l'ha vista. Lasciarlo a un bottone significherebbe che al
cliente resta scritto «inviata» finché non ci si ricorda di premerlo, cioè che lo stato
dice una cosa falsa nel momento in cui conta. La richiesta selezionata all'apertura della
pagina **non** viene segnata: quello lo fa solo un clic.

Gli altri passaggi sono manuali e liberi in entrambi i versi: una richiesta chiusa troppo
presto si riapre. Lo stato lo scrive `updateContactRequest`, che registra chi l'ha mosso
e quando — è quello che il cliente vede, non un'etichetta interna.

## Comunicazioni

`/comunicazioni` è l'unico posto del backoffice in cui **Revna parla per prima**: tutto il
resto — profilo, documenti, assistente, richieste — nasce da qualcosa che il cliente
chiede o guarda. Per questo l'elenco mette in evidenza due numeri e non le date: a quanti
è arrivata e quanti l'hanno aperta. Sono la sola misura di una comunicazione, e un avviso
che nessuno apre è un avviso scritto male, o mandato al pubblico sbagliato.

Nell'app i clienti le trovano nella sezione **Avvisi**, con il pallino rosso sui non
letti; alla partenza arriva anche una notifica sul telefono.

### L'editor

Il testo si scrive con un piccolo WYSIWYG (`components/rich-text`): titolo, sottotitolo,
grassetto, corsivo, elenchi, citazione, link, immagini, riga di separazione. Una textarea
sarebbe bastata a mandare del testo, non a scrivere un avviso che qualcuno legge sul
telefono — e chiedere di ricordarsi la sintassi del markdown per avere un elenco o un
link avrebbe voluto dire, in pratica, non averli.

Sotto è un `contenteditable` guidato da `document.execCommand`, che è deprecato e senza
sostituto: le alternative sono un'intera libreria di editing per sette bottoni, o
gestire selezioni e Range a mano, che è riscrivere `execCommand` peggio. Se un giorno
sparisse, è l'unico file da rifare — il testo salvato resta quello.

Si salva **markdown**, non HTML: lo mostra l'app con il renderer delle risposte
dell'assistente, che non è un browser e non esegue tag. Le due traduzioni stanno in
`components/rich-text/markdown-html.ts`, con il loro giro di andata e ritorno coperto da
`markdown-html.spec.ts`.

Due scelte volute, che tengono il testo dentro il sottoinsieme che l'app sa mostrare: la
barra offre **solo** i comandi che il renderer conosce, e **l'incolla arriva senza
formattazione** — chi incolla da Word porterebbe font, colori e `<span>` che nell'app non
si vedrebbero, dando l'illusione di un testo che nessuno leggerà così.

Le immagini si caricano su Storage in `announcements/{id}/` e nel testo finisce il loro
download URL. Per questo l'id della comunicazione si genera **prima** del primo
salvataggio: senza, la prima immagine costringerebbe a un salvataggio forzato a metà
frase. Attenzione a cosa ci si mette dentro: quel link funziona per chiunque lo abbia,
anche fuori dall'app (vedi `backend/README.md`).

### Destinatari e invio

«Tutti i clienti» si risolve **al momento dell'invio**, sul server: chi diventa cliente
domani non riceve gli avvisi di ieri, e i clienti disattivati non ricevono in nessun caso,
neanche se scelti a mano in una bozza di tre settimane fa.

«Invia» **salva sempre prima di mandare**: il caso opposto — mandare a tutti i clienti la
versione salvata prima, mentre a schermo c'è un'altra — è il modo più semplice di
recapitare qualcosa che nessuno voleva mandare. La conferma dice il numero, perché fra
mandare a un cliente e mandare a tutti la differenza è tutta lì.

Dopo l'invio si correggono titolo e testo — la correzione arriva subito nell'app di chi
ha ricevuto, senza una seconda notifica — ma **non i destinatari**: per un altro pubblico
si scrive una comunicazione nuova. **Ritirare** cancella davvero: originale, copie
consegnate e immagini.

## L'assistente

Le due pagine sotto `/assistente` sono il punto in cui si costruisce l'agente che parla
con i clienti. Valgono per **tutti** i clienti insieme: quello che cambia da cliente a
cliente è il profilo struttura, non l'assistente.

**Personalità** (`pages/agent/persona`) scrive `agent/config`: identità, come ragiona,
come scrive, perimetro. Le quattro sezioni sono separate non per il modello — che riceve
un testo unico — ma per chi le scrive: tenere il tono distinto dal perimetro rende
evidente cosa si sta cambiando e cosa no. Ogni sezione ha un «testo di partenza» che la
riporta al comportamento noto senza toccare le altre.

Gli spunti della nuova conversazione si scrivono nello stesso form ma finiscono in
`agent/public`, un documento separato: `agent/config` contiene il system prompt, cioè
come Revna ha istruito l'agente, e le regole Firestore lo tengono chiuso ai clienti.
`agent/public` contiene solo ciò che l'app deve poter leggere da sé.

**Base di conoscenza** (`pages/agent/knowledge` e `pages/agent/entry`) scrive la
collezione `knowledge`. Ogni voce porta due campi di provenienza distinti — `fonte` è il
materiale, `riferimento` è il punto preciso dentro il materiale — perché insieme sono la
citazione che il cliente legge sotto la risposta nell'app. Sono la differenza fra un
assistente Revna e un chatbot generico: senza di loro la risposta resta senza origine.

Il dato in cima all'elenco è il **peso della conoscenza attiva**. Finché sta sotto la
soglia, l'assistente riceve tutto il materiale a ogni domanda e non può sbagliare a
scegliere; sopra, comincia a selezionare — funziona, ma è il momento in cui titoli e aree
tematiche smettono di essere estetica e diventano il modo in cui il materiale viene
ritrovato. Meglio saperlo prima che dopo.

Una voce **sospesa** resta in elenco ma esce dal contesto: serve per il materiale in
revisione, o per un contenuto che invecchia.

**Prova** (`pages/agent/prova`) è il banco di collaudo delle altre due: si sceglie una
struttura fra i clienti attivi e si fa la conversazione che farebbe il suo albergatore.
Risponde `previewAssistant`, che usa lo stesso motore delle risposte vere — quindi la
prova non mente — e **non salva niente**: la conversazione vive nello stato del
componente e sparisce cambiando cliente o ricaricando. Non deve comparire nello storico
del cliente una chat che non ha avuto.

Il valore vero non è la chat ma il pannello sotto: quali voci sono entrate in contesto,
quali sono state citate davvero, e il prompt esatto inviato al modello. È lì che si
capisce se una voce non è stata usata perché la selezione non l'ha scelta — e allora il
problema è nel suo titolo o nelle sue aree tematiche — o perché il modello l'ha ignorata,
che è un problema di personalità o di contenuto.

Il markdown della risposta è reso da `pages/agent/markdown.ts`, un sottoinsieme scritto
a mano: giudicare il tono di una risposta con i `**` ancora addosso è più difficile del
necessario. I marcatori delle fonti restano visibili, perché sono parte di quello che si
sta verificando.

Le scritture vanno **dirette su Firestore**, senza Cloud Function: le regole aprono
queste collezioni ai soli referenti Revna, e la normalizzazione che conta avviene lato
backend in lettura, cioè nel punto in cui questi testi entrano nel prompt del modello.
Il backend tiene una cache di un minuto, quindi una modifica si vede nell'app entro un
minuto — le pagine lo dicono, per non far sembrare un guasto la normale attesa.

## Il profilo struttura

Il form è un unico componente, `components/profile-fields`, usato sia in creazione
(`/utenti`) sia in modifica (`/clienti/:uid`). Copre referente, struttura, indirizzo,
categorie e quantità di alloggi, servizi, canali di vendita, target, stagionalità,
obiettivi e note del consulente.

Solo l'email è obbligatoria: un profilo si può completare in più riprese. Il campo
`noteCliente` non è nel form — appartiene al cliente e nel dettaglio si legge soltanto.

## Font

Il font del brand è **Rethink Sans** ([Google Fonts](https://fonts.google.com/specimen/Rethink+Sans)),
lo stesso dell'app mobile. Arriva dal pacchetto `@fontsource-variable/rethink-sans` ed è
importato in `src/styles.css`: file variabile, pesi 400-800, servito dal nostro bundle e
non dalla CDN di Google — così aprire il backoffice non manda l'IP di chi ci lavora a un
terzo. La famiglia si chiama `Rethink Sans Variable`; nel CSS si usa `var(--font-sans)`.

## Configurazione

`src/environments/environment.ts` contiene la config Firebase del progetto. Non è un
segreto — la config client finisce comunque nel bundle JS — quindi è versionata, così
`npm start` funziona subito dopo un clone. Rigenerabile con:

```bash
firebase apps:sdkconfig web --project revnaappai
```

## Deploy

Dalla radice del repo:

```bash
firebase deploy --only hosting --project revnaappai
```

Il `predeploy` compila da solo l'app Angular. Pubblicato su https://revnaappai.web.app,
configurato in [`../firebase.json`](../firebase.json).
