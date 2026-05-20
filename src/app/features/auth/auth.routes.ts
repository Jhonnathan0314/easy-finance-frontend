import { Routes } from '@angular/router';

import { publicGuard } from '../../core/guards/auth.guard';
import { LoginPageComponent } from './login/login-page.component';
import { RegisterPageComponent } from './register/register-page.component';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    canActivate: [publicGuard],
    component: LoginPageComponent
  },
  {
    path: 'register',
    canActivate: [publicGuard],
    component: RegisterPageComponent
  }
];
