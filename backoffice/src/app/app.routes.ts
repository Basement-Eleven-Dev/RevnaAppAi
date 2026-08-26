import { Routes } from '@angular/router';

import { adminGuard, guestGuard } from './core/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    // Pubblica: ci atterrano i clienti dal link nell'email, non i referenti Revna.
    path: 'attiva',
    loadComponent: () => import('./pages/activate/activate').then((m) => m.Activate),
  },
  {
    // Tutto il backoffice vive dentro il telaio con la barra laterale: la guardia
    // sta qui una volta sola, e la pagina è il `<router-outlet>` dello Shell.
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('./core/shell').then((m) => m.Shell),
    children: [
      {
        path: 'clienti',
        loadComponent: () => import('./pages/clients/clients').then((m) => m.Clients),
      },
      {
        // Prima di `clienti/:uid`, altrimenti «nuovo» verrebbe letto come un uid.
        path: 'clienti/nuovo',
        loadComponent: () => import('./pages/users/users').then((m) => m.Users),
      },
      {
        path: 'clienti/:uid',
        loadComponent: () =>
          import('./pages/client-detail/client-detail').then((m) => m.ClientDetail),
      },
      {
        path: 'clienti/:uid/documenti',
        loadComponent: () =>
          import('./pages/client-documents/client-documents').then((m) => m.ClientDocuments),
      },
      {
        path: 'clienti/:uid/conversazioni',
        loadComponent: () =>
          import('./pages/client-conversations/client-conversations').then(
            (m) => m.ClientConversations
          ),
      },
      {
        path: 'richieste',
        loadComponent: () => import('./pages/requests/requests').then((m) => m.Requests),
      },
      {
        path: 'comunicazioni',
        loadComponent: () =>
          import('./pages/announcements/announcements').then((m) => m.Announcements),
      },
      {
        // `nuova` come id significa comunicazione da scrivere: una rotta sola per
        // creazione e modifica, come per le voci di conoscenza.
        path: 'comunicazioni/:id',
        loadComponent: () =>
          import('./pages/announcements/editor').then((m) => m.AnnouncementEditor),
      },
      {
        path: 'assistente',
        loadComponent: () => import('./pages/agent/persona').then((m) => m.AgentPersona),
      },
      {
        path: 'assistente/conoscenza',
        loadComponent: () => import('./pages/agent/knowledge').then((m) => m.AgentKnowledge),
      },
      {
        path: 'assistente/prova',
        loadComponent: () => import('./pages/agent/prova').then((m) => m.AgentProva),
      },
      {
        // `nuova` come id significa voce da creare: una rotta sola per creazione e modifica.
        path: 'assistente/conoscenza/:id',
        loadComponent: () => import('./pages/agent/entry').then((m) => m.AgentEntry),
      },
      // La creazione di un'utenza non è più una sezione a sé: si arriva da «Clienti».
      { path: 'utenti', pathMatch: 'full', redirectTo: 'clienti/nuovo' },
      { path: '', pathMatch: 'full', redirectTo: 'clienti' },
      { path: '**', redirectTo: 'clienti' },
    ],
  },
];
