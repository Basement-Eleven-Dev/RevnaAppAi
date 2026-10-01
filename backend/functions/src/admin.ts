import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Una sola inizializzazione dell'Admin SDK, condivisa da tutte le function.
if (getApps().length === 0) {
  initializeApp();
}

export const auth = getAuth();
export const db = getFirestore();

/**
 * Tutti gli utenti di Firebase Auth, pagina dopo pagina: `listUsers` ne torna al
 * massimo 1000 per chiamata, e oltre quel numero un elenco non paginato tace.
 */
export async function listAllUsers(): Promise<UserRecord[]> {
  const users: UserRecord[] = [];
  let pageToken: string | undefined;

  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  return users;
}
