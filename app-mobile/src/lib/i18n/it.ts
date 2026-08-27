/**
 * Testi dell'interfaccia in italiano.
 *
 * Questo file è la forma autorevole del dizionario: `Dictionary` è il suo `typeof`,
 * quindi ogni chiave aggiunta qui diventa obbligatoria in `en.ts` e la traduzione
 * mancante la segnala TypeScript, non un utente che vede una scritta sbagliata.
 *
 * Le liste a valori chiusi (tipologie di struttura, servizi, canali…) stanno qui e
 * non in `lib/profile.ts`: i valori sono un contratto con il backend e non si
 * toccano, le etichette sono testo d'interfaccia e vanno tradotte come tutto il
 * resto. Le chiavi dei record sono quei valori, quindi il compilatore tiene le due
 * lingue allineate anche sulle liste.
 */
export const it = {
  /** Tag per `toLocaleDateString`: la nostra `Language` non è un locale valido. */
  dateLocale: 'it-IT',

  comune: {
    annulla: 'Annulla',
    caricamento: 'Caricamento…',
    chiudi: 'Chiudi',
    continua: 'Continua',
    elimina: 'Elimina',
    email: 'Email',
    ieri: 'Ieri',
    indietro: 'Indietro',
    password: 'Password',
    /** Sul campo password: dice cosa fa il tocco, non che cosa sta accadendo ora. */
    mostra: 'Mostra',
    nascondi: 'Nascondi',
  },

  nav: {
    assistente: 'Assistente',
    avvisi: 'Avvisi',
    documenti: 'Documenti',
    blog: 'Blog',
    richieste: 'Richieste',
    profilo: 'Profilo',
    apri: 'Apri il menu',
  },

  login: {
    sottotitolo: 'L’assistente della tua struttura, con il metodo Revna dentro.',
    accedi: 'Accedi',
    inCorso: 'Accesso in corso…',
    passwordDimenticata: 'Password dimenticata?',
    hoUnCodice: 'Ho un codice di attivazione',
    nessunAccesso: 'L’accesso lo apre Revna.',
    firebaseDaConfigurare: (chiavi: string) => `Firebase da configurare: mancano ${chiavi}`,
    fallito: 'Accesso non riuscito.',
  },

  recupero: {
    titolo: 'Recupera l’accesso',
    sottotitolo:
      'Inserisci l’email con cui entri: ti mandiamo un link per scegliere una nuova password.',
    invia: 'Inviami il link',
    inCorso: 'Invio…',
    /** Volutamente al condizionale: non diciamo a nessuno se un’email è registrata o no. */
    fatto: (email: string) =>
      `Se ${email} corrisponde a un accesso Revna, il link è in arrivo. Controlla anche la posta indesiderata.`,
    riprova: 'Non è arrivato? Riprova',
    tornaAllAccesso: 'Torna all’accesso',
    fallito: 'Invio non riuscito.',
  },

  attivazione: {
    titolo: 'Attiva il tuo accesso',
    titoloPer: (email: string) => `Attiva l'accesso di ${email}`,
    incollaCodice: "Incolla il codice che trovi nell'email di attivazione.",
    codice: 'Codice di attivazione',
    nuovaPassword: (minimo: number) => `Nuova password (min ${minimo} caratteri)`,
    ripetiPassword: 'Ripeti la password',
    attiva: 'Attiva ed entra',
    inCorso: 'Attivazione in corso…',
    fallita: 'Attivazione non riuscita.',

    /**
     * Lo stesso schermo serve due momenti diversi: la prima attivazione e il
     * recupero della password. Il meccanismo è identico — un codice, una password
     * nuova — ma chi legge sta vivendo due cose diverse, e dirgliela giusta
     * costa sei stringhe.
     */
    reset: {
      titolo: 'Scegli una nuova password',
      titoloPer: (email: string) => `Nuova password per ${email}`,
      incollaCodice: "Incolla il codice che trovi nell'email di recupero.",
      codice: 'Codice di recupero',
      conferma: 'Salva ed entra',
      inCorso: 'Salvataggio…',
      fallita: 'Password non reimpostata.',
    },
  },

  chat: {
    titolo: 'Assistente Revna',
    strutturaSconosciuta: 'La tua struttura',
    messaggi: (quanti: number): string =>
      quanti === 1 ? '1 messaggio' : `${quanti} messaggi`,
    nuovaConversazione: 'Nuova conversazione',
    incipit: 'Da dove partiamo\noggi?',
    incipitAiuto: (struttura: string) =>
      `Conosco il profilo di ${struttura}, i materiali di Revna e le tue conversazioni passate.`,
    scrivi: 'Scrivi la tua domanda…',
    invia: 'Invia',
    disclaimer: 'Revna AI può sbagliare. Verifica le informazioni importanti.',
    fallita: 'Risposta non riuscita.',
    /** Spunti mostrati finché il backoffice non ne ha impostati di suoi. */
    spuntiDiScorta: [
      'Analizza la mia stagionalità',
      'Come miglioro il mio ADR',
      'Come riduco la dipendenza dalle OTA',
      'Che tariffe imposto per il prossimo ponte',
    ],
  },

  conversazioni: {
    titolo: 'Conversazioni',
    nuova: 'Nuova conversazione',
    vuoto: 'Nessuna conversazione. Le trovi qui appena ne inizi una.',
    suggerimentoElimina: 'Tieni premuto su una conversazione per eliminarla.',
    senzaTitolo: 'Conversazione',
    confermaTitolo: 'Eliminare la conversazione?',
    confermaTesto: (titolo: string) => `«${titolo}» verrà eliminata definitivamente.`,
  },

  richieste: {
    titolo: 'Richieste',
    sottotitolo:
      "Quando l'assistente non basta, da qui chiedi di parlare con il tuo referente Revna.",
    vuoto:
      'Nessuna richiesta. Aprine una quando ti serve una persona: il tuo referente Revna la prende in mano.',
    nuova: 'Nuova richiesta',
    apri: 'Chiedi di essere ricontattato',
    /** L'occhiello della card che nasce sotto la risposta dell'assistente. */
    tiFaccioRichiamare: 'Ti faccio richiamare',
    rivediEInvia: 'Rivedi e invia',
    noGrazie: 'No grazie',
    testoModificabile: 'Il testo è modificabile: parte quello che leggi tu.',
    inviata: 'Richiesta inviata',
    trovaInSezione: 'La trovi in Richieste, con il suo stato.',
    aperta: (quando: string) => `Aperta ${quando}`,
    richiamoSu: (recapito: string) => `Ti ricontattiamo su ${recapito}`,
    leggiConversazione: "Nata dalla chat con l'assistente",

    modale: {
      titolo: 'Chiedi di essere ricontattato',
      aiuto:
        'Scrivi cosa ti serve. Insieme alla richiesta arrivano il tuo nome e il tuo recapito, presi dal profilo.',
      aiutoProposta:
        "Questo testo l'ha preparato l'assistente per te. Correggilo come vuoi: parte solo quando lo confermi.",
      placeholder: 'Di cosa hai bisogno?',
      conferma: 'Invia la richiesta',
      inCorso: 'Invio…',
      vuota: 'Scrivi cosa ti serve.',
      fallita: 'Richiesta non inviata.',
    },

    stati: {
      inviata: 'Inviata',
      visualizzata: 'Visualizzata',
      chiusa: 'Chiusa',
    },

    statiAiuto: {
      inviata: 'In attesa che il tuo referente Revna la apra.',
      visualizzata: "Il tuo referente Revna l'ha letta e la sta seguendo.",
      chiusa: 'Chiusa dal tuo referente Revna.',
    },

    origine: {
      assistente: "Dalla chat con l'assistente",
      richieste: 'Aperta da te',
    },
  },

  assistente: {
    nome: 'Revna AI',
    generatoDaAi: 'Risposta generata da AI',
    materialeRevna: 'Materiale Revna',
  },

  blog: {
    titolo: 'Blog',
    sottotitolo: 'Analisi e notizie dal blog di Revenue su Misura, dall’articolo più recente.',
    apri: 'Leggi sul sito',
    apertura: 'Apertura…',
    vuoto: 'Nessun articolo da mostrare in questo momento.',
    archivio: 'Apri il blog sul sito',
    errore: 'Non è stato possibile caricare gli articoli. Controlla la connessione.',
    riprova: 'Riprova',
    nonApribile: "Non è stato possibile aprire l'articolo.",
  },

  avvisi: {
    titolo: 'Avvisi',
    sottotitolo: 'Comunicazioni e annunci dal tuo referente Revna.',
    /** Il conteggio dei non letti prende il posto del sottotitolo: è il motivo per cui si è qui. */
    daLeggere: (quanti: number) =>
      quanti === 1 ? '1 avviso da leggere' : `${quanti} avvisi da leggere`,
    vuoto:
      'Nessun avviso. Quando Revna ha qualcosa da comunicarti lo trovi qui, e te lo segnala una notifica.',
    leggi: 'Leggi',
    da: 'Revna',
    giaLetti: 'Già letti',
    /** L'unica azione in fondo a un avviso: portarlo in chat, dove ci sono i numeri. */
    chiediAllAssistente: 'Chiedi cosa cambia per me',
    domandaSuAvviso: (titolo: string) => `Cosa cambia per me con «${titolo}»?`,
    ritirato: 'Questo avviso non è più disponibile: è stato ritirato da Revna.',
    tuttiGliAvvisi: 'Vedi tutti gli avvisi',
    /** Solo a permesso negato: dice dove si rimedia, senza insistere. */
    notificheNegate:
      'Le notifiche sono disattivate per Revna AI. Gli avvisi li trovi comunque qui: per essere avvisato appena arrivano, riattivale nelle impostazioni del telefono.',
  },

  documenti: {
    titolo: 'Documenti',
    sottotitolo: 'Report, presentazioni e materiali che Revna ha condiviso con te.',
    vuoto: "Non c'è ancora nulla. I documenti che il tuo referente Revna condivide compaiono qui.",
    apri: 'Apri documento',
    apertura: 'Apertura…',
    nonApribile: 'Non è stato possibile aprire il documento.',
    /** Un documento arrivato negli ultimi giorni: l'unico uso dell'arancio nell'elenco. */
    nuovo: 'Nuovo',
    nota: 'I file si aprono con un link valido cinque minuti, richiesto al momento dell’apertura.',
    categorie: {
      report: 'Report',
      presentazione: 'Presentazione',
      playbook: 'Playbook',
      pickup: 'Pick-up',
      analisi: 'Analisi',
      contratto: 'Contratto',
      altro: 'Altro',
    },
  },

  profilo: {
    titolo: 'Profilo',
    apriImpostazioni: 'Impostazioni',
    /** I numeri grandi in cima alla scheda: la struttura in tre dati. */
    statistiche: {
      unita: (tipologie: number) =>
        tipologie === 1 ? 'unità · 1 tipologia' : `unità · ${tipologie} tipologie`,
      apertaDal: 'aperta dal',
      canali: (quanti: number): string => (quanti === 1 ? 'canale attivo' : 'canali attivi'),
    },
    nonCompilato:
      'Il tuo profilo non è ancora stato compilato. Lo redige il tuo referente Revna: appena pronto lo trovi qui.',
    esci: 'Esci',

    sezioni: {
      struttura: 'Struttura',
      referente: 'Referente',
      alloggi: (unita: number) => `Alloggi · ${unita} unità`,
      comeLavora: 'Come lavora',
      obiettivi: 'Obiettivi',
      noteConsulente: 'Note del consulente',
    },

    campi: {
      nome: 'Nome',
      tipologia: 'Tipologia',
      categoria: 'Categoria',
      apertaDal: 'Aperta dal',
      sito: 'Sito',
      dove: 'Dove',
      ruolo: 'Ruolo',
      telefono: 'Telefono',
      stagionalita: 'Stagionalità',
      servizi: 'Servizi',
      canali: 'Canali',
      target: 'Target',
    },

    note: {
      titolo: 'Le mie note',
      aiuto:
        'Aggiungi quello che ritieni utile. Restano tue: non sovrascrivono il profilo scritto da Revna.',
      placeholder: 'Note personali…',
      salva: 'Salva le mie note',
      modifica: 'Modifica',
      inCorso: 'Salvataggio…',
      fallito: 'Salvataggio non riuscito.',
    },

    liste: {
      tipologiaStruttura: {
        hotel: 'Hotel',
        resort: 'Resort',
        bnb: 'B&B',
        agriturismo: 'Agriturismo',
        casaVacanze: 'Casa vacanze',
        residence: 'Residence / Aparthotel',
        dimoraStorica: 'Dimora storica',
        ostello: 'Ostello',
        glamping: 'Glamping',
        campeggio: 'Campeggio / Village',
        rifugio: 'Rifugio',
        altro: 'Altro',
      },
      categoria: {
        '5L': '5 stelle lusso',
        '5': '5 stelle',
        '4': '4 stelle',
        '3': '3 stelle',
        '2': '2 stelle',
        '1': '1 stella',
        nonClassificata: 'Non classificata',
      },
      tipologiaAlloggio: {
        singola: 'Singola',
        doppia: 'Doppia / Matrimoniale',
        tripla: 'Tripla',
        quadrupla: 'Quadrupla / Familiare',
        suite: 'Suite',
        juniorSuite: 'Junior suite',
        appartamento: 'Appartamento',
        villa: 'Villa / Chalet',
        bungalow: 'Bungalow / Mobile home',
        piazzola: 'Piazzola',
        dormitorio: 'Posto letto in dormitorio',
      },
      servizi: {
        ristorante: 'Ristorante',
        bar: 'Bar',
        colazione: 'Colazione inclusa',
        spa: 'SPA / Centro benessere',
        piscina: 'Piscina',
        palestra: 'Palestra',
        spiaggiaPrivata: 'Spiaggia privata',
        parcheggio: 'Parcheggio',
        navetta: 'Navetta',
        saleMeeting: 'Sale meeting',
        animaliAmmessi: 'Animali ammessi',
        giardino: 'Giardino / Terrazza',
        biciclette: 'Noleggio biciclette',
        checkInAutomatico: 'Check-in automatico',
        ricarica: 'Ricarica auto elettriche',
      },
      canali: {
        diretto: 'Sito diretto',
        telefono: 'Telefono / Email',
        bookingCom: 'Booking.com',
        expedia: 'Expedia',
        airbnb: 'Airbnb',
        tourOperator: 'Tour operator',
        agenzie: 'Agenzie di viaggio',
        gds: 'GDS',
        gruppi: 'Gruppi / MICE',
      },
      target: {
        leisure: 'Leisure',
        business: 'Business',
        famiglie: 'Famiglie',
        coppie: 'Coppie',
        gruppi: 'Gruppi',
        mice: 'MICE / Congressuale',
        senior: 'Senior',
        sportivi: 'Sportivi / Outdoor',
        wedding: 'Wedding',
        internazionale: 'Clientela estera',
      },
      stagionalita: {
        annuale: "Tutto l'anno",
        estiva: 'Stagione estiva',
        invernale: 'Stagione invernale',
        doppiaStagione: 'Doppia stagione',
        weekend: 'Weekend ed eventi',
      },
    },
  },

  impostazioni: {
    titolo: 'Impostazioni',

    /**
     * La memoria dell'assistente. Sta nelle impostazioni e non in una sezione sua:
     * è una cosa che si apre quando si vuole controllare, non tutti i giorni.
     */
    memoria: {
      titolo: 'Memoria dell’assistente',
      aiuto:
        'Le preferenze che hai dato all’assistente parlando: come vuoi che ti risponda, cosa non deve fare. Le rispetta in ogni risposta, senza che tu le ripeta. Le annota lui: tu puoi correggere una riga, cancellarla, o cancellare tutto.',
      vuoto:
        'Non ha ancora annotato niente. Quando gli dici come preferisci essere aiutato — «non usare elenchi puntati», «rispondimi più corto» — te lo ritrovi qui.',
      conteggio: (quanti: number) =>
        quanti === 1 ? '1 preferenza ricordata' : `${quanti} preferenze ricordate`,
      visualizza: 'Visualizza i ricordi',
      imparato: (data: string) => (data ? `Imparato il ${data}` : 'Imparato'),
      corretto: 'corretto da te',
      da: (titolo: string) => `da «${titolo}»`,
      modifica: 'Correggi',
      salva: 'Salva la correzione',
      inCorso: 'Salvataggio…',
      dimentica: 'Dimentica',
      confermaTitolo: 'Dimenticare questo?',
      confermaTesto: (testo: string) => `L’assistente non terrà più conto di: «${testo}»`,
      cancellaTutto: 'Cancella tutta la memoria',
      cancellaTuttoTitolo: 'Cancellare tutta la memoria?',
      cancellaTuttoTesto:
        'L’assistente dimenticherà tutto quello che ha imparato su di te e ricomincerà da capo. Le conversazioni e il profilo della struttura restano. Non si può annullare.',
      cancellazione: 'Cancellazione…',
      fallito: 'Non è stato possibile aggiornare la memoria.',
    },

    lingua: {
      titolo: 'Lingua',
      aiuto: "Vale per l'interfaccia dell'app. Resta impostata su questo dispositivo.",
    },

    password: {
      titolo: 'Cambia password',
      aiuto: 'Per cambiarla serve la password che usi adesso.',
      attuale: 'Password attuale',
      nuova: (minimo: number) => `Nuova password (min ${minimo} caratteri)`,
      ripeti: 'Ripeti la nuova password',
      salva: 'Aggiorna la password',
      inCorso: 'Aggiornamento…',
      fatto: 'Password aggiornata.',
      nonCoincidono: 'Le due password non coincidono.',
      fallito: 'Password non aggiornata.',
    },

    emailAccesso: {
      titolo: 'Cambia email',
      aiuto:
        "Mandiamo un link di verifica alla nuova email. L'accesso cambia solo quando lo apri: fino a quel momento continui a entrare con questa.",
      attuale: 'Email attuale',
      nuova: 'Nuova email',
      conferma: 'Password attuale',
      salva: 'Invia il link di verifica',
      inCorso: 'Invio…',
      fatto: (email: string) => `Link di verifica inviato a ${email}. Aprilo per confermare.`,
      ugualeAllaAttuale: 'È già la tua email di accesso.',
      fallito: 'Email non aggiornata.',
    },
  },

  legale: {
    nota: 'Proseguendo accetti la privacy policy e l’informativa sul trattamento dei dati.',
    privacy: 'Privacy policy',
    trattamentoDati: 'Trattamento dei dati',
  },

  /**
   * Messaggi per i codici d'errore di Firebase Auth, senza il prefisso `auth/`.
   * Quelli non elencati ricadono sul messaggio generico della schermata, con il
   * codice in coda: meglio un codice leggibile che una frase inventata.
   */
  erroriAuth: {
    'invalid-credential': 'Email o password non corretti.',
    'wrong-password': 'Email o password non corretti.',
    'user-not-found': 'Email o password non corretti.',
    'invalid-email': 'Indirizzo email non valido.',
    'missing-password': 'Manca la password.',
    'weak-password': 'Password troppo debole: usane una più lunga.',
    'email-already-in-use': 'Questa email è già usata da un altro accesso.',
    'requires-recent-login': 'Per sicurezza rientra e riprova.',
    'too-many-requests': 'Troppi tentativi. Riprova tra qualche minuto.',
    'network-request-failed': 'Connessione assente. Riprova.',
    'user-disabled': 'Questa utenza è stata disattivata.',
    'expired-action-code':
      'Il link di attivazione è scaduto. Chiedi al tuo referente Revna di rimandartelo.',
    'invalid-action-code': 'Codice di attivazione non valido o già usato.',
    'operation-not-allowed': 'Operazione non consentita su questo account.',
  },
};

/** La forma del dizionario: `en.ts` deve riempirla tutta. */
export type Dictionary = typeof it;
