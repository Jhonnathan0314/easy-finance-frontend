import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { AuthStore } from '../auth/auth.store';

const canAccessPrivateRoute = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    return true;
  }

  if (authStore.hasToken()) {
    return authStore.bootstrapSession().pipe(
      map((authenticated) => (authenticated ? true : router.createUrlTree(['/login'])))
    );
  }

  return router.createUrlTree(['/login']);
};

const canAccessPublicRoute = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    return router.createUrlTree(['/app/accounts']);
  }

  if (authStore.hasToken()) {
    return authStore.bootstrapSession().pipe(
      map((authenticated) => (authenticated ? router.createUrlTree(['/app/accounts']) : true))
    );
  }

  return true;
};

export const authGuard: CanActivateFn = canAccessPrivateRoute;
export const authChildGuard: CanActivateChildFn = canAccessPrivateRoute;
export const publicGuard: CanActivateFn = canAccessPublicRoute;
