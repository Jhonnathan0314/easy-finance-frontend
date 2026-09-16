import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, tap, throwError } from 'rxjs';

import { ApiErrorResponse, CreditCardClosingPreviewResponseDto, CreditCardClosingResultResponseDto } from '../../shared/models';
import { CreditCardClosingApiService } from './credit-card-closing-api.service';

@Injectable({ providedIn: 'root' })
export class CreditCardClosingStore {
  private readonly api = inject(CreditCardClosingApiService);

  readonly preview = signal<CreditCardClosingPreviewResponseDto | null>(null);
  readonly result = signal<CreditCardClosingResultResponseDto | null>(null);
  readonly isLoadingPreview = signal(false);
  readonly isConfirming = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);

  calculate(accountId: number, paymentMethodId: number, from: string, to: string): Observable<CreditCardClosingPreviewResponseDto> {
    this.isLoadingPreview.set(true);
    this.error.set(null);
    this.result.set(null);

    return this.api.preview(accountId, paymentMethodId, from, to).pipe(
      tap((preview) => this.preview.set(preview)),
      catchError((error: unknown) => {
        this.preview.set(null);
        this.error.set(toApiError(error));
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingPreview.set(false))
    );
  }

  confirm(accountId: number, paymentMethodId: number, from: string, to: string): Observable<CreditCardClosingResultResponseDto> {
    this.isConfirming.set(true);
    this.error.set(null);

    return this.api.confirm(accountId, { paymentMethodId, from, to }).pipe(
      tap((result) => {
        this.result.set(result);
        this.preview.set(null);
      }),
      catchError((error: unknown) => {
        this.error.set(toApiError(error));
        return throwError(() => error);
      }),
      finalize(() => this.isConfirming.set(false))
    );
  }

  reset(): void {
    this.preview.set(null);
    this.result.set(null);
    this.error.set(null);
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
