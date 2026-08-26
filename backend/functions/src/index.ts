/**
 * Cloud Functions del progetto Revna AI.
 * Regione europe-west1 per tutte le function (dati e utenti sono in UE).
 */

export { createInvite } from './invites';
export { requestPasswordReset } from './password-reset';
export { listClients, updateClient, saveClientProfile } from './clients';
export { askAssistant } from './assistant';
export { previewAssistant } from './preview';
export { deleteConversation } from './conversations';
export { createContactRequest, updateContactRequest } from './requests';
export { getDocumentUrl } from './documents';
export {
  saveAnnouncement,
  sendAnnouncement,
  deleteAnnouncement,
  markAnnouncementRead,
} from './announcements';
export { ingestKnowledgeFile, getKnowledgeFileUrl } from './knowledge';
