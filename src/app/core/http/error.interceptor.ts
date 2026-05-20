import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

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
      if (error instanceof HttpErrorResponse) {
        const apiError = normalizeApiError(error);
        errorStore.set(apiError);

        if (error.status === 401) {
          authStore.clearSession();
          accountStore.clear();
          if (!request.url.includes('/auth/login') && !request.url.includes('/auth/register')) {
            void router.navigate(['/login']);
          }
        }

        if (error.status === 403 && shouldEndSession(apiError.code)) {
          authStore.clearSession();
          accountStore.clear();
          void router.navigate(['/login']);
        }
      }

      return throwError(() => error);
    })
  );
};

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
