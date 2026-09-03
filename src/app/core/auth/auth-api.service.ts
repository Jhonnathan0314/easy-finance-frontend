import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AuthenticatedUserDto,
  AuthTokenResponseDto,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest
} from '../../shared/models';
import { ApiClient } from '../http/api-client';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly api = inject(ApiClient);

  login(request: LoginRequest): Observable<AuthTokenResponseDto> {
    return this.api.post<AuthTokenResponseDto, LoginRequest>('/auth/login', request);
  }

  register(request: RegisterRequest): Observable<AuthTokenResponseDto> {
    return this.api.post<AuthTokenResponseDto, RegisterRequest>('/auth/register', request);
  }

  me(): Observable<AuthenticatedUserDto> {
    return this.api.get<AuthenticatedUserDto>('/auth/me');
  }

  updateProfile(request: UpdateProfileRequest): Observable<AuthenticatedUserDto> {
    return this.api.put<AuthenticatedUserDto, UpdateProfileRequest>('/auth/me', request);
  }

  refresh(): Observable<AuthTokenResponseDto> {
    return this.api.post<AuthTokenResponseDto, undefined>('/auth/refresh', undefined, { withCredentials: true });
  }

  logout(): Observable<void> {
    return this.api.post<void, undefined>('/auth/logout', undefined, { withCredentials: true });
  }
}
