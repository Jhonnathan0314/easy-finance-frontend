import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, tap, throwError } from 'rxjs';

import { ApiErrorResponse, ExpenseImportBatchResponseDto } from '../../shared/models';
import { ImportsApiService } from './imports-api.service';

@Injectable({ providedIn: 'root' })
export class ImportsStore {
  private readonly importsApi = inject(ImportsApiService);
  private readonly currentAccountId = signal<number | null>(null);

  readonly currentBatch = signal<ExpenseImportBatchResponseDto | null>(null);
  readonly isPreviewing = signal(false);
  readonly isConfirming = signal(false);
  readonly isLoading = signal(false);
  readonly isDownloadingTemplate = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly templateDownloadError = signal<string | null>(null);
  readonly selectedFile = signal<File | null>(null);

  selectFile(file: File): void {
    this.selectedFile.set(file);
    this.error.set(null);
  }

  clearFile(): void {
    this.selectedFile.set(null);
  }

  preview(accountId: number): Observable<ExpenseImportBatchResponseDto> {
    this.ensureAccount(accountId);
    const file = this.selectedFile();

    if (!file) {
      const error = createLocalError('IMPORT_FILE_REQUIRED', 'Selecciona un archivo .xlsx para continuar.');
      this.error.set(error);
      return throwError(() => error);
    }

    this.isPreviewing.set(true);
    this.error.set(null);

    return this.importsApi.previewExpenseImport(accountId, file).pipe(
      tap((batch) => this.currentBatch.set(batch)),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isPreviewing.set(false))
    );
  }

  confirm(accountId: number, batchId: number): Observable<ExpenseImportBatchResponseDto> {
    this.ensureAccount(accountId);
    const batch = this.currentBatch();

    if (this.isConfirming()) {
      return throwError(() => createLocalError('IMPORT_CONFIRM_IN_PROGRESS', 'La confirmacion ya esta en progreso.'));
    }

    if (!batch || batch.batchId !== batchId || batch.status !== 'PREVIEW') {
      const error = createLocalError('IMPORT_NOT_CONFIRMABLE', 'Este batch no se puede confirmar.');
      this.error.set(error);
      return throwError(() => error);
    }

    this.isConfirming.set(true);
    this.error.set(null);

    return this.importsApi.confirmExpenseImport(accountId, batchId).pipe(
      tap((confirmed) => this.currentBatch.set(confirmed)),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isConfirming.set(false))
    );
  }

  getBatch(accountId: number, batchId: number): Observable<ExpenseImportBatchResponseDto> {
    this.ensureAccount(accountId);
    this.isLoading.set(true);
    this.error.set(null);

    return this.importsApi.getExpenseImportBatch(accountId, batchId).pipe(
      tap((batch) => this.currentBatch.set(batch)),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isLoading.set(false))
    );
  }

  downloadTemplate(accountId: number): Observable<Blob> {
    this.ensureAccount(accountId);
    this.isDownloadingTemplate.set(true);
    this.templateDownloadError.set(null);

    return this.importsApi.downloadExpenseImportTemplate(accountId).pipe(
      catchError((error: unknown) => {
        this.templateDownloadError.set('No se pudo descargar la plantilla. Intenta nuevamente.');
        return throwError(() => error);
      }),
      finalize(() => this.isDownloadingTemplate.set(false))
    );
  }

  clear(): void {
    this.currentAccountId.set(null);
    this.currentBatch.set(null);
    this.selectedFile.set(null);
    this.isPreviewing.set(false);
    this.isConfirming.set(false);
    this.isLoading.set(false);
    this.error.set(null);
    this.templateDownloadError.set(null);
  }

  private ensureAccount(accountId: number): void {
    if (this.currentAccountId() === accountId) {
      return;
    }

    if (this.currentAccountId() === null) {
      this.currentAccountId.set(accountId);
      return;
    }

    this.currentAccountId.set(accountId);
    this.currentBatch.set(null);
    this.selectedFile.set(null);
    this.error.set(null);
    this.templateDownloadError.set(null);
  }

  private handleError(error: unknown): Observable<never> {
    this.error.set(toApiError(error));
    return throwError(() => error);
  }
}

function createLocalError(code: string, message: string): ApiErrorResponse {
  return {
    timestamp: new Date().toISOString(),
    status: 0,
    error: 'Validation Error',
    code,
    message,
    path: '',
    correlationId: null,
    details: []
  };
}

function toApiError(error: unknown): ApiErrorResponse {
  if (isApiErrorResponse(error)) {
    return error;
  }

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
      message: 'No fue posible completar la importacion.',
      path: maybeHttpError.url ?? '',
      correlationId: null,
      details: []
    };
  }

  return createLocalError('UNKNOWN_ERROR', 'No fue posible completar la importacion.');
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return Boolean(value && typeof value === 'object' && 'code' in value && 'message' in value);
}
