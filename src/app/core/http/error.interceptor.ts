import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { ApiErrorResponse } from '../../shared/models';
import { AuthStore } from '../auth/auth.store';
import { AccountStore } from '../state/account.store';
import { GlobalErrorStore } from '../state/global-error.store';

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const authStore = inject(AuthStore);
  const accountStore = inject(AccountStore);
  const errorStore = inject(GlobalErrorStore);
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      const apiError = normalizeApiError(error);

      if (error.status === 401 && canAttemptRefresh(request, authStore)) {
        return authStore.refreshAccessToken().pipe(
          switchMap((session) =>
            next(
              request.clone({
                setHeaders: { Authorization: `Bearer ${session.accessToken}` }
              })
            )
          ),
          catchError((refreshError: unknown) => {
            const refreshApiError = normalizeRefreshError(refreshError, apiError);
            errorStore.set(refreshApiError);
            authStore.authError.set({
              ...refreshApiError,
              code: refreshApiError.code === 'TOKEN_EXPIRED' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
              message: 'Tu sesión expiró o dejó de ser válida. Inicia sesión nuevamente.'
            });
            endSession(authStore, accountStore);
            void router.navigate(['/login']);
            return throwError(() => refreshError);
          })
        );
      }

      errorStore.set(apiError);

      if (error.status === 401) {
        endSession(authStore, accountStore);
        if (!request.url.includes('/auth/login') && !request.url.includes('/auth/register')) {
          void router.navigate(['/login']);
        }
      }

      if (error.status === 403 && shouldEndSession(apiError.code)) {
        endSession(authStore, accountStore);
        void router.navigate(['/login']);
      }

      return throwError(() => error);
    })
  );
};

function endSession(authStore: AuthStore, accountStore: AccountStore): void {
  authStore.clearSession();
  accountStore.clear();
}

function canAttemptRefresh(request: HttpRequest<unknown>, authStore: AuthStore): boolean {
  return Boolean(authStore.token())
    && !request.url.includes('/auth/login')
    && !request.url.includes('/auth/register')
    && !request.url.includes('/auth/refresh');
}

function normalizeRefreshError(error: unknown, fallback: ApiErrorResponse): ApiErrorResponse {
  if (error instanceof HttpErrorResponse) {
    return normalizeApiError(error);
  }
  return fallback;
}

function normalizeApiError(error: HttpErrorResponse): ApiErrorResponse {
  const body = isApiErrorResponse(error.error) ? error.error : null;

  return {
    timestamp: body?.timestamp ?? new Date().toISOString(),
    status: body?.status ?? error.status,
    error: body?.error ?? error.statusText,
    code: body?.code ?? 'HTTP_ERROR',
    message: body?.message ?? 'No fue posible completar la solicitud.',
    path: body?.path ?? error.url ?? '',
    correlationId: body?.correlationId ?? error.headers.get('X-Correlation-Id'),
    details: body?.details ?? []
  };
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return Boolean(value && typeof value === 'object' && 'code' in value && 'message' in value);
}

function shouldEndSession(code: string): boolean {
  return ['USER_BLOCKED', 'USER_NOT_ACTIVE', 'PARTICIPANT_NOT_ACTIVE'].includes(code);
}
