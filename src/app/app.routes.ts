import { Routes } from '@angular/router';

import { authChildGuard, authGuard } from './core/guards/auth.guard';
import { PrivateLayoutComponent } from './core/layout/private-layout.component';

export const appRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'app/accounts'
  },
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES)
  },
  {
    path: 'app',
    component: PrivateLayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [authChildGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'accounts'
      },
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES)
      },
      {
        path: 'accounts',
        loadChildren: () => import('./features/accounts/accounts.routes').then((m) => m.ACCOUNTS_ROUTES)
      },
      {
        path: 'expenses',
        redirectTo: 'accounts'
      },
      {
        path: 'debts',
        redirectTo: 'accounts'
      },
      {
        path: 'budgets',
        redirectTo: 'accounts'
      },
      {
        path: 'income',
        redirectTo: 'accounts'
      },
      {
        path: 'analytics',
        redirectTo: 'accounts'
      },
      {
        path: 'imports',
        redirectTo: 'accounts'
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'app/accounts'
  }
];
