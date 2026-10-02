import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { AuthService } from './auth.service';

/** Lascia passare solo i referenti Revna; gli altri finiscono al login, che poi li riporta qui. */
export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenReady();
  return auth.isAdmin()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { da: state.url } });
};

/** Impedisce di rivedere il login quando si è già dentro. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenReady();
  return auth.isAdmin() ? router.createUrlTree(['/clienti']) : true;
};
