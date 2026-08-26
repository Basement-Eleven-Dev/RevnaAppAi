/**
 * Gli indirizzi dei documenti legali mostrati sotto le schermate di accesso.
 *
 * Stanno in un file loro e non nei singoli schermi perché sono la stessa cosa
 * detta in tre punti: login, attivazione, recupero. Quando arrivano gli URL
 * definitivi si cambia qui, una volta.
 *
 * I valori attuali sono SEGNAPOSTO: puntano a pagine che potrebbero non esistere
 * ancora. Sono URL veri e non stringhe vuote di proposito — un link che apre una
 * pagina sbagliata si nota subito, un link assente no.
 */
export const LegalUrls = {
  // TODO: sostituire con gli URL definitivi forniti da Revna.
  privacy: 'https://revna.it/privacy-policy',
  trattamentoDati: 'https://revna.it/trattamento-dati',
} as const;
