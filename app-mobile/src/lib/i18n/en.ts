import type { Dictionary } from './it';

/**
 * Testi dell'interfaccia in inglese.
 *
 * L'annotazione `: Dictionary` non è decorativa: è quella che fa fallire la
 * compilazione se qui manca una chiave che esiste in `it.ts`. Da aggiornare
 * sempre nello stesso commit del testo italiano.
 */
export const en: Dictionary = {
  dateLocale: 'en-GB',

  comune: {
    annulla: 'Cancel',
    caricamento: 'Loading…',
    chiudi: 'Close',
    continua: 'Continue',
    elimina: 'Delete',
    email: 'Email',
    ieri: 'Yesterday',
    indietro: 'Back',
    password: 'Password',
  },

  nav: {
    assistente: 'Assistant',
    avvisi: 'Notices',
    documenti: 'Documents',
    blog: 'Blog',
    richieste: 'Requests',
    profilo: 'Profile',
    apri: 'Open the menu',
  },

  login: {
    sottotitolo: 'For Revna clients only',
    accedi: 'Sign in',
    inCorso: 'Signing in…',
    passwordDimenticata: 'Forgotten your password?',
    hoUnCodice: 'I have an activation code',
    nessunAccesso: "No account yet? Your Revna contact will set one up for you.",
    firebaseDaConfigurare: (chiavi: string) => `Firebase not configured: missing ${chiavi}`,
    fallito: 'Sign-in failed.',
  },

  recupero: {
    titolo: 'Recover your account',
    sottotitolo:
      'Enter the email you sign in with: we’ll send you a link to choose a new password.',
    invia: 'Send me the link',
    inCorso: 'Sending…',
    fatto: (email: string) =>
      `If ${email} matches a Revna account, the link is on its way. Check your spam folder too.`,
    riprova: 'Didn’t arrive? Try again',
    tornaAllAccesso: 'Back to sign-in',
    fallito: 'Could not send the link.',
  },

  attivazione: {
    titolo: 'Activate your account',
    titoloPer: (email: string) => `Activate the account for ${email}`,
    incollaCodice: 'Paste the code from your activation email.',
    codice: 'Activation code',
    nuovaPassword: (minimo: number) => `New password (min ${minimo} characters)`,
    ripetiPassword: 'Repeat the password',
    attiva: 'Activate and sign in',
    inCorso: 'Activating…',
    fallita: 'Activation failed.',

    reset: {
      titolo: 'Choose a new password',
      titoloPer: (email: string) => `New password for ${email}`,
      incollaCodice: 'Paste the code from your recovery email.',
      codice: 'Recovery code',
      conferma: 'Save and sign in',
      inCorso: 'Saving…',
      fallita: 'Password not reset.',
    },
  },

  chat: {
    titolo: 'Revna Assistant',
    strutturaSconosciuta: 'Your property',
    nuovaConversazione: 'New conversation',
    incipit: 'Where shall we start?',
    incipitAiuto: "Answers take your property's data into account.",
    scrivi: 'Type your question…',
    invia: 'Send',
    disclaimer: 'Revna AI can make mistakes. Check important information.',
    fallita: 'No answer received.',
    spuntiDiScorta: [
      'Analyse my seasonality',
      'How do I improve my ADR',
      'How do I reduce my reliance on OTAs',
      'What rates should I set for the next long weekend',
    ],
  },

  conversazioni: {
    titolo: 'Conversations',
    nuova: 'New conversation',
    vuoto: "No conversations yet. They'll show up here as soon as you start one.",
    suggerimentoElimina: 'Press and hold a conversation to delete it.',
    senzaTitolo: 'Conversation',
    confermaTitolo: 'Delete this conversation?',
    confermaTesto: (titolo: string) => `“${titolo}” will be deleted permanently.`,
  },

  richieste: {
    titolo: 'Requests',
    sottotitolo: "When the assistant isn't enough, ask to speak to your Revna contact from here.",
    vuoto:
      'No requests yet. Open one whenever you need a person: your Revna contact will pick it up.',
    nuova: 'New request',
    apri: 'Ask to be contacted',
    inviata: 'Request sent',
    trovaInSezione: "You'll find it under Requests, with its status.",
    aperta: (quando: string) => `Opened ${quando}`,
    richiamoSu: (recapito: string) => `We'll get back to you at ${recapito}`,
    leggiConversazione: 'Started from the chat with the assistant',

    modale: {
      titolo: 'Ask to be contacted',
      aiuto:
        'Tell us what you need. Your name and contact details go with the request, taken from your profile.',
      aiutoProposta:
        'The assistant drafted this for you. Edit it as you like: it only goes out when you confirm.',
      placeholder: 'What do you need?',
      conferma: 'Send the request',
      inCorso: 'Sending…',
      vuota: 'Tell us what you need.',
      fallita: 'Request not sent.',
    },

    stati: {
      inviata: 'Sent',
      visualizzata: 'Seen',
      chiusa: 'Closed',
    },

    statiAiuto: {
      inviata: 'Waiting for your Revna contact to open it.',
      visualizzata: 'Your Revna contact has read it and is on it.',
      chiusa: 'Closed by your Revna contact.',
    },

    origine: {
      assistente: 'From the chat with the assistant',
      richieste: 'Opened by you',
    },
  },

  assistente: {
    nome: 'Revna AI',
    generatoDaAi: 'AI-generated answer',
    materialeRevna: 'Revna material',
  },

  blog: {
    titolo: 'Blog',
    // Il blog del sito è solo in italiano: dirlo qui evita che chi ha l'app
    // in inglese tocchi una card aspettandosi un articolo tradotto.
    sottotitolo: 'Analysis and news from the Revenue su Misura blog, newest first. Articles are in Italian.',
    apri: 'Read on the website',
    apertura: 'Opening…',
    vuoto: 'No articles to show right now.',
    archivio: 'Open the blog on the website',
    errore: 'Could not load the articles. Check your connection.',
    riprova: 'Try again',
    nonApribile: 'Could not open the article.',
  },

  avvisi: {
    titolo: 'Notices',
    sottotitolo: 'Announcements and updates from your Revna contact.',
    daLeggere: (quanti: number) => (quanti === 1 ? '1 notice to read' : `${quanti} notices to read`),
    vuoto:
      'No notices yet. Whenever Revna has something to tell you it will appear here, and a notification will let you know.',
    leggi: 'Read',
    da: 'Revna',
    ritirato: 'This notice is no longer available: Revna has withdrawn it.',
    tuttiGliAvvisi: 'See all notices',
    notificheNegate:
      'Notifications are turned off for Revna AI. Notices still appear here: to be told as soon as they arrive, turn notifications back on in your phone settings.',
  },

  documenti: {
    titolo: 'Documents',
    sottotitolo: 'Reports, presentations and material Revna has shared with you.',
    vuoto: "Nothing here yet. Documents your Revna contact shares will appear here.",
    apri: 'Open document',
    apertura: 'Opening…',
    nonApribile: 'The document could not be opened.',
    categorie: {
      report: 'Report',
      presentazione: 'Presentation',
      playbook: 'Playbook',
      pickup: 'Pick-up',
      analisi: 'Analysis',
      contratto: 'Contract',
      altro: 'Other',
    },
  },

  profilo: {
    titolo: 'Profile',
    apriImpostazioni: 'Settings',
    nonCompilato:
      'Your profile has not been filled in yet. Your Revna contact writes it: it will show up here as soon as it is ready.',
    esci: 'Sign out',

    sezioni: {
      struttura: 'Property',
      referente: 'Contact person',
      alloggi: (unita: number) => `Accommodation · ${unita} units`,
      comeLavora: 'How it operates',
      obiettivi: 'Goals',
      noteConsulente: "Consultant's notes",
    },

    campi: {
      nome: 'Name',
      tipologia: 'Type',
      categoria: 'Rating',
      apertaDal: 'Open since',
      sito: 'Website',
      dove: 'Location',
      ruolo: 'Role',
      telefono: 'Phone',
      stagionalita: 'Seasonality',
      servizi: 'Facilities',
      canali: 'Channels',
      target: 'Segments',
    },

    note: {
      titolo: 'My notes',
      aiuto:
        "Add whatever you find useful. They stay yours: they don't overwrite the profile Revna wrote.",
      placeholder: 'Personal notes…',
      salva: 'Save my notes',
      inCorso: 'Saving…',
      fallito: 'Could not save.',
    },

    liste: {
      tipologiaStruttura: {
        hotel: 'Hotel',
        resort: 'Resort',
        bnb: 'B&B',
        agriturismo: 'Farm stay',
        casaVacanze: 'Holiday home',
        residence: 'Serviced apartments / Aparthotel',
        dimoraStorica: 'Historic residence',
        ostello: 'Hostel',
        glamping: 'Glamping',
        campeggio: 'Campsite / Village',
        rifugio: 'Mountain hut',
        altro: 'Other',
      },
      categoria: {
        '5L': '5-star luxury',
        '5': '5-star',
        '4': '4-star',
        '3': '3-star',
        '2': '2-star',
        '1': '1-star',
        nonClassificata: 'Unrated',
      },
      tipologiaAlloggio: {
        singola: 'Single',
        doppia: 'Double / Twin',
        tripla: 'Triple',
        quadrupla: 'Quadruple / Family',
        suite: 'Suite',
        juniorSuite: 'Junior suite',
        appartamento: 'Apartment',
        villa: 'Villa / Chalet',
        bungalow: 'Bungalow / Mobile home',
        piazzola: 'Pitch',
        dormitorio: 'Dormitory bed',
      },
      servizi: {
        ristorante: 'Restaurant',
        bar: 'Bar',
        colazione: 'Breakfast included',
        spa: 'Spa / Wellness centre',
        piscina: 'Swimming pool',
        palestra: 'Gym',
        spiaggiaPrivata: 'Private beach',
        parcheggio: 'Parking',
        navetta: 'Shuttle',
        saleMeeting: 'Meeting rooms',
        animaliAmmessi: 'Pets allowed',
        giardino: 'Garden / Terrace',
        biciclette: 'Bike rental',
        checkInAutomatico: 'Self check-in',
        ricarica: 'EV charging',
      },
      canali: {
        diretto: 'Direct website',
        telefono: 'Phone / Email',
        bookingCom: 'Booking.com',
        expedia: 'Expedia',
        airbnb: 'Airbnb',
        tourOperator: 'Tour operator',
        agenzie: 'Travel agencies',
        gds: 'GDS',
        gruppi: 'Groups / MICE',
      },
      target: {
        leisure: 'Leisure',
        business: 'Business',
        famiglie: 'Families',
        coppie: 'Couples',
        gruppi: 'Groups',
        mice: 'MICE / Conferences',
        senior: 'Seniors',
        sportivi: 'Sports / Outdoor',
        wedding: 'Weddings',
        internazionale: 'International guests',
      },
      stagionalita: {
        annuale: 'All year round',
        estiva: 'Summer season',
        invernale: 'Winter season',
        doppiaStagione: 'Two seasons',
        weekend: 'Weekends and events',
      },
    },
  },

  impostazioni: {
    titolo: 'Settings',

    lingua: {
      titolo: 'Language',
      aiuto: 'Applies to the app interface. Stays set on this device.',
    },

    password: {
      titolo: 'Change password',
      aiuto: 'You need your current password to change it.',
      attuale: 'Current password',
      nuova: (minimo: number) => `New password (min ${minimo} characters)`,
      ripeti: 'Repeat the new password',
      salva: 'Update password',
      inCorso: 'Updating…',
      fatto: 'Password updated.',
      nonCoincidono: 'The two passwords do not match.',
      fallito: 'Password not updated.',
    },

    emailAccesso: {
      titolo: 'Change email',
      aiuto:
        'We send a verification link to the new address. Your sign-in only changes once you open it: until then you keep using this one.',
      attuale: 'Current email',
      nuova: 'New email',
      conferma: 'Current password',
      salva: 'Send the verification link',
      inCorso: 'Sending…',
      fatto: (email: string) => `Verification link sent to ${email}. Open it to confirm.`,
      ugualeAllaAttuale: 'That is already your sign-in email.',
      fallito: 'Email not updated.',
    },
  },

  legale: {
    nota: 'By continuing you accept the privacy policy and the data processing notice.',
    privacy: 'Privacy policy',
    trattamentoDati: 'Data processing',
  },

  erroriAuth: {
    'invalid-credential': 'Wrong email or password.',
    'wrong-password': 'Wrong email or password.',
    'user-not-found': 'Wrong email or password.',
    'invalid-email': 'That email address is not valid.',
    'missing-password': 'The password is missing.',
    'weak-password': 'Password too weak: use a longer one.',
    'email-already-in-use': 'That email is already used by another account.',
    'requires-recent-login': 'For security, sign in again and retry.',
    'too-many-requests': 'Too many attempts. Try again in a few minutes.',
    'network-request-failed': 'No connection. Try again.',
    'user-disabled': 'This account has been deactivated.',
    'expired-action-code':
      'The activation link has expired. Ask your Revna contact to send you a new one.',
    'invalid-action-code': 'Activation code invalid or already used.',
    'operation-not-allowed': 'This operation is not allowed on this account.',
  },
};
