import { Routes } from '@angular/router';

import { CreditCardClosingPageComponent } from './credit-card-closing/credit-card-closing-page.component';
import { ExpensesPageComponent } from './expenses-page.component';

export const EXPENSES_ROUTES: Routes = [
  {
    path: '',
    component: ExpensesPageComponent
  },
  {
    path: 'credit-card-closing',
    component: CreditCardClosingPageComponent
  }
];
