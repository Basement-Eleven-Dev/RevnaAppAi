import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { auth, db } from './admin';
import { requireAdmin } from './guards';
import { profileDisplayName, sanitizeProfile } from './profile';

export type Client = {
  uid: string;
  email: string;
  displayName: string | null;
  disabled: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

/**
 * Elenco dei clienti dell'app: tutti gli utenti che NON sono referenti Revna.
 * Base utenti unica, quindi i due gruppi si distinguono solo per il claim.
 */
export const listClients = onCall<void, Promise<{ clients: Client[] }>>(
  { region: 'europe-west1' },
  async (request) => {
    requireAdmin(request);

    const { users } = await auth.listUsers(1000);

    const clients = users
      .filter((user) => user.customClaims?.['revnaAdmin'] !== true)
      .map<Client>((user) => ({
        uid: user.uid,
        email: user.email ?? '',
        displayName: user.displayName ?? null,
        disabled: user.disabled,
        createdAt: user.metadata.creationTime,
        lastSignInAt: user.metadata.lastSignInTime || null,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { clients };
  }
);

type UpdateRequest = { uid: string; displayName?: string; disabled?: boolean };

/**
 * Modifica un cliente: nome e stato di attivazione.
 *
 * Disattivare non basta a buttare fuori chi è già dentro: il client tiene un
 * ID token valido fino a un'ora. Per questo revochiamo anche i refresh token —
 * al primo rinnovo forzato l'app se ne accorge e chiude la sessione.
 */
export const updateClient = onCall<UpdateRequest, Promise<{ ok: true }>>(
  { region: 'europe-west1' },
  async (request) => {
    requireAdmin(request);

    const { uid, displayName, disabled } = request.data;
    if (!uid) {
      throw new HttpsError('invalid-argument', 'uid mancante.');
    }

    const target = await auth.getUser(uid).catch(() => null);
    if (!target) {
      throw new HttpsError('not-found', 'Utente inesistente.');
    }
    if (target.customClaims?.['revnaAdmin'] === true) {
      throw new HttpsError('permission-denied', 'Non si modificano i referenti Revna da qui.');
    }

    await auth.updateUser(uid, {
      ...(displayName !== undefined ? { displayName: displayName.trim() || null } : {}),
      ...(disabled !== undefined ? { disabled } : {}),
    });

    if (disabled === true) {
      await auth.revokeRefreshTokens(uid);
      logger.info('Cliente disattivato e sessioni revocate', { uid });
    }

    return { ok: true };
  }
);

type SaveProfileRequest = { uid: string; profile: unknown };

/**
 * Salva il profilo struttura redatto da Revna.
 *
 * Passa da una function e non da una scrittura diretta su Firestore per due
 * motivi: la normalizzazione dei campi resta lato server, e il `displayName`
 * dell'utenza Auth resta allineato al nome della struttura.
 *
 * Non tocca `noteCliente`: quelle sono del cliente e Revna non le sovrascrive.
 */
export const saveClientProfile = onCall<SaveProfileRequest, Promise<{ ok: true }>>(
  { region: 'europe-west1' },
  async (request) => {
    requireAdmin(request);

    const { uid } = request.data;
    if (!uid) {
      throw new HttpsError('invalid-argument', 'uid mancante.');
    }

    const target = await auth.getUser(uid).catch(() => null);
    if (!target) {
      throw new HttpsError('not-found', 'Utente inesistente.');
    }
    if (target.customClaims?.['revnaAdmin'] === true) {
      throw new HttpsError('permission-denied', 'I referenti Revna non hanno un profilo struttura.');
    }

    const { noteCliente: _ignored, ...profile } = sanitizeProfile(request.data.profile);
    const displayName = profileDisplayName({ ...profile, noteCliente: '' });

    await db
      .collection('users')
      .doc(uid)
      .set(
        {
          profile,
          updatedAt: new Date().toISOString(),
          updatedBy: request.auth?.token['email'] ?? null,
        },
        { merge: true }
      );

    if (displayName && displayName !== target.displayName) {
      await auth.updateUser(uid, { displayName });
    }

    logger.info('Profilo aggiornato', { uid });
    return { ok: true };
  }
);
