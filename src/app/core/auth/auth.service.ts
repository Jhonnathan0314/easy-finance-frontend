import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AuthTokenResponseDto, AuthenticatedUserDto, LoginRequest, RegisterRequest } from '../../shared/models';
import { AccountStore } from '../state/account.store';
import { AuthApiService } from './auth-api.service';
import { AuthStore } from './auth.store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApiService);
  private readonly authStore = inject(AuthStore);
  private readonly accountStore = inject(AccountStore);

  login(request: LoginRequest): Observable<AuthTokenResponseDto> {
    return this.authStore.login(request);
  }

  register(request: RegisterRequest): Observable<AuthTokenResponseDto> {
    return this.authStore.register(request);
  }

  me(): Observable<AuthenticatedUserDto> {
    return this.authApi.me();
  }

  logout(): void {
    this.authStore.logout();
    this.accountStore.clear();
  }
}
