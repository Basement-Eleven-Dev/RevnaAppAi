import { Routes } from '@angular/router';

import { adminGuard, guestGuard } from './core/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'utenti',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/users/users').then((m) => m.Users),
  },
  {
    path: 'clienti',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/clients/clients').then((m) => m.Clients),
  },
  {
    path: 'clienti/:uid',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/client-detail/client-detail').then((m) => m.ClientDetail),
  },
  {
    path: 'clienti/:uid/documenti',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/client-documents/client-documents').then((m) => m.ClientDocuments),
  },
  {
    // Pubblica: ci atterrano i clienti dal link nell'email, non i referenti Revna.
    path: 'attiva',
    loadComponent: () => import('./pages/activate/activate').then((m) => m.Activate),
  },
  { path: '', pathMatch: 'full', redirectTo: 'utenti' },
  { path: '**', redirectTo: 'utenti' },
];
