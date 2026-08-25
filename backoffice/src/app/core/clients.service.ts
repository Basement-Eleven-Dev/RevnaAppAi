import { Injectable } from '@angular/core';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { getFirebaseDb, getFirebaseFunctions } from './firebase';
import { EMPTY_PROFILE, type ClientProfile } from './profile.model';

export type Client = {
  uid: string;
  email: string;
  displayName: string | null;
  disabled: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

export type Invite = {
  uid: string;
  activationUrl: string;
  /** false se la chiave Resend non è ancora configurata: il link va consegnato a mano. */
  emailSent: boolean;
};

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly functions = getFirebaseFunctions();

  private readonly createInviteFn = httpsCallable<
    { email: string; profile: Omit<ClientProfile, 'noteCliente'> },
    Invite
  >(this.functions, 'createInvite');

  private readonly listClientsFn = httpsCallable<void, { clients: Client[] }>(
    this.functions,
    'listClients'
  );

  private readonly updateClientFn = httpsCallable<
    { uid: string; displayName?: string; disabled?: boolean },
    { ok: true }
  >(this.functions, 'updateClient');

  private readonly saveProfileFn = httpsCallable<
    { uid: string; profile: Omit<ClientProfile, 'noteCliente'> },
    { ok: true }
  >(this.functions, 'saveClientProfile');

  async createInvite(
    email: string,
    profile: Omit<ClientProfile, 'noteCliente'>
  ): Promise<Invite> {
    const { data } = await this.createInviteFn({ email, profile });
    return data;
  }

  /** Legge il profilo direttamente da Firestore: le regole aprono la lettura agli admin. */
  async profile(uid: string): Promise<ClientProfile> {
    const snapshot = await getDoc(doc(getFirebaseDb(), 'users', uid));
    const stored = snapshot.data()?.['profile'] as Partial<ClientProfile> | undefined;
    return { ...EMPTY_PROFILE, ...stored };
  }

  async saveProfile(uid: string, profile: Omit<ClientProfile, 'noteCliente'>): Promise<void> {
    await this.saveProfileFn({ uid, profile });
  }

  async list(): Promise<Client[]> {
    const { data } = await this.listClientsFn();
    return data.clients;
  }

  async rename(uid: string, displayName: string): Promise<void> {
    await this.updateClientFn({ uid, displayName });
  }

  async setDisabled(uid: string, disabled: boolean): Promise<void> {
    await this.updateClientFn({ uid, disabled });
  }
}
