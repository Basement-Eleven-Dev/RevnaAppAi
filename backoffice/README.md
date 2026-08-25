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

L'ordine delle due scritture è voluto: prima il file, poi la scheda. Se il caricamento
fallisce non resta una scheda che punta al vuoto; il caso opposto lascia un file orfano
su Storage, meno grave e visibile dalla console.

## Il profilo struttura

Il form è un unico componente, `components/profile-fields`, usato sia in creazione
(`/utenti`) sia in modifica (`/clienti/:uid`). Copre referente, struttura, indirizzo,
categorie e quantità di alloggi, servizi, canali di vendita, target, stagionalità,
obiettivi e note del consulente.

Solo l'email è obbligatoria: un profilo si può completare in più riprese. Il campo
`noteCliente` non è nel form — appartiene al cliente e nel dettaglio si legge soltanto.

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
