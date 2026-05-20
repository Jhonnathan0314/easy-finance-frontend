import { Routes } from '@angular/router';

import { accountRouteGuard } from '../../core/guards/account-route.guard';
import { AccountsPageComponent } from './accounts-page.component';
import { AccountMembersPageComponent } from './members/account-members-page.component';

export const ACCOUNTS_ROUTES: Routes = [
  {
    path: '',
    component: AccountsPageComponent
  },
  {
    path: ':accountId/dashboard',
    canActivate: [accountRouteGuard],
    loadChildren: () => import('../dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES)
  },
  {
    path: ':accountId/expenses',
    canActivate: [accountRouteGuard],
    loadChildren: () => import('../expenses/expenses.routes').then((m) => m.EXPENSES_ROUTES)
  },
  {
    path: ':accountId/debts',
    canActivate: [accountRouteGuard],
    loadChildren: () => import('../debts/debts.routes').then((m) => m.DEBTS_ROUTES)
  },
  {
    path: ':accountId/budgets',
    canActivate: [accountRouteGuard],
    loadChildren: () => import('../budgets/budgets.routes').then((m) => m.BUDGETS_ROUTES)
  },
  {
    path: ':accountId/income',
    canActivate: [accountRouteGuard],
    loadChildren: () => import('../income/income.routes').then((m) => m.INCOME_ROUTES)
  },
  {
    path: ':accountId/analytics',
    pathMatch: 'full',
    redirectTo: ':accountId/dashboard'
  },
  {
    path: ':accountId/imports',
    canActivate: [accountRouteGuard],
    loadChildren: () => import('../imports/imports.routes').then((m) => m.IMPORTS_ROUTES)
  },
  {
    path: ':accountId/catalogs',
    canActivate: [accountRouteGuard],
    loadChildren: () => import('../catalogs/catalogs.routes').then((m) => m.CATALOGS_ROUTES)
  },
  {
    path: ':accountId/settings',
    canActivate: [accountRouteGuard],
    component: AccountMembersPageComponent
  },
  {
    path: ':accountId/settings/members',
    canActivate: [accountRouteGuard],
    component: AccountMembersPageComponent
  }
];
