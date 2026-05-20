import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';

import {
  ApiErrorResponse,
  AuthTokenResponseDto,
  AuthenticatedUserDto,
  LoginRequest,
  RegisterRequest
} from '../../shared/models';
import { AuthApiService } from './auth-api.service';
import { AuthStorageService } from './auth-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly authApi = inject(AuthApiService);
  private readonly storage = inject(AuthStorageService);
  private readonly session = signal<AuthTokenResponseDto | null>(null);
  private bootstrapRequest: Observable<boolean> | null = null;

  readonly token = computed(() => this.session()?.accessToken ?? null);
  readonly user = computed<AuthenticatedUserDto | null>(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => Boolean(this.token() && this.user()));
  readonly hasToken = computed(() => Boolean(this.token()));
  readonly isLoading = signal(false);
  readonly authError = signal<ApiErrorResponse | null>(null);

  constructor() {
    this.loadFromStorage();
  }

  login(request: LoginRequest): Observable<AuthTokenResponseDto> {
    this.isLoading.set(true);
    this.authError.set(null);

    return this.authApi.login(request).pipe(
      tap((session) => this.setSession(session)),
      catchError((error: unknown) => {
        this.authError.set(toApiError(error));
        return throwAuthError(error);
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  register(request: RegisterRequest): Observable<AuthTokenResponseDto> {
    this.isLoading.set(true);
    this.authError.set(null);

    return this.authApi.register(request).pipe(
      tap((session) => this.setSession(session)),
      catchError((error: unknown) => {
        this.authError.set(toApiError(error));
        return throwAuthError(error);
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  setSession(session: AuthTokenResponseDto): void {
    this.storage.write(session);
    this.session.set(session);
    this.authError.set(null);
  }

  clearSession(): void {
    this.storage.clear();
    this.session.set(null);
    this.bootstrapRequest = null;
  }

  clear(): void {
    this.clearSession();
  }

  loadFromStorage(): void {
    this.session.set(this.storage.read());
  }

  bootstrapSession(): Observable<boolean> {
    if (!this.token()) {
      this.clearSession();
      return of(false);
    }

    if (this.user()) {
      return of(true);
    }

    if (this.bootstrapRequest) {
      return this.bootstrapRequest;
    }

    this.isLoading.set(true);
    this.authError.set(null);

    this.bootstrapRequest = this.authApi.me().pipe(
      tap((user) => {
        const current = this.session();

        if (current) {
          this.setSession({ ...current, user });
        }
      }),
      map(() => true),
      catchError((error: unknown) => {
        this.authError.set(toApiError(error));
        this.clearSession();
        return of(false);
      }),
      finalize(() => {
        this.isLoading.set(false);
        this.bootstrapRequest = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    return this.bootstrapRequest;
  }

  logout(): void {
    this.authError.set(null);
    this.clearSession();
  }
}

function toApiError(error: unknown): ApiErrorResponse {
  if (error && typeof error === 'object' && 'error' in error) {
    const maybeHttpError = error as { error?: unknown; status?: number; statusText?: string; url?: string | null };

    if (isApiErrorResponse(maybeHttpError.error)) {
      return maybeHttpError.error;
    }

    return {
      timestamp: new Date().toISOString(),
      status: maybeHttpError.status ?? 0,
      error: maybeHttpError.statusText ?? 'Error',
      code: 'HTTP_ERROR',
      message: 'No fue posible completar la solicitud.',
      path: maybeHttpError.url ?? '',
      correlationId: null,
      details: []
    };
  }

  return {
    timestamp: new Date().toISOString(),
    status: 0,
    error: 'Error',
    code: 'UNKNOWN_ERROR',
    message: 'No fue posible completar la solicitud.',
    path: '',
    correlationId: null,
    details: []
  };
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return Boolean(value && typeof value === 'object' && 'code' in value && 'message' in value);
}

function throwAuthError(error: unknown): Observable<never> {
  return throwError(() => error);
}
