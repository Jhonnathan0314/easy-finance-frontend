import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AccountStore } from '../state/account.store';

export const accountRouteGuard: CanActivateFn = (route) => {
  const accountStore = inject(AccountStore);
  const router = inject(Router);
  const accountId = Number(route.paramMap.get('accountId'));

  if (!Number.isFinite(accountId)) {
    return router.createUrlTree(['/app/accounts']);
  }

  return accountStore.selectAccountById(accountId).pipe(
    map((account) => (account ? true : router.createUrlTree(['/app/accounts']))),
    catchError(() => of(router.createUrlTree(['/app/accounts'])))
  );
};
