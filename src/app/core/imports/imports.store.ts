import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, tap, throwError } from 'rxjs';

import {
  AnnualBudgetImportResponseDto,
  ApiErrorResponse,
  CategoryImportResponseDto,
  ExpenseImportBatchResponseDto,
  IncomeImportResponseDto,
  PaymentMethodImportResponseDto
} from '../../shared/models';
import { ImportsApiService } from './imports-api.service';

@Injectable({ providedIn: 'root' })
export class ImportsStore {
  private readonly importsApi = inject(ImportsApiService);
  private readonly currentAccountId = signal<number | null>(null);

  readonly currentBatch = signal<ExpenseImportBatchResponseDto | null>(null);
  readonly currentIncomeImportPreview = signal<IncomeImportResponseDto | null>(null);
  readonly currentCategoryImportPreview = signal<CategoryImportResponseDto | null>(null);
  readonly currentPaymentMethodImportPreview = signal<PaymentMethodImportResponseDto | null>(null);
  readonly currentAnnualBudgetImportPreview = signal<AnnualBudgetImportResponseDto | null>(null);
  readonly currentIncomeImportResult = signal<IncomeImportResponseDto | null>(null);
  readonly currentCategoryImportResult = signal<CategoryImportResponseDto | null>(null);
  readonly currentPaymentMethodImportResult = signal<PaymentMethodImportResponseDto | null>(null);
  readonly currentAnnualBudgetImportResult = signal<AnnualBudgetImportResponseDto | null>(null);
  readonly isPreviewing = signal(false);
  readonly isConfirming = signal(false);
  readonly isLoading = signal(false);
  readonly isDownloadingTemplate = signal(false);
  readonly isImportingIncome = signal(false);
  readonly isImportingCategory = signal(false);
  readonly isImportingPaymentMethod = signal(false);
  readonly isImportingAnnualBudget = signal(false);
  readonly isPreviewingIncome = signal(false);
  readonly isPreviewingCategory = signal(false);
  readonly isPreviewingPaymentMethod = signal(false);
  readonly isPreviewingAnnualBudget = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly templateDownloadError = signal<string | null>(null);
  readonly selectedFile = signal<File | null>(null);
  readonly selectedIncomeFile = signal<File | null>(null);
  readonly selectedCategoryFile = signal<File | null>(null);
  readonly selectedPaymentMethodFile = signal<File | null>(null);
  readonly selectedAnnualBudgetFile = signal<File | null>(null);
  readonly incomeError = signal<ApiErrorResponse | null>(null);
  readonly categoryError = signal<ApiErrorResponse | null>(null);
  readonly paymentMethodError = signal<ApiErrorResponse | null>(null);
  readonly annualBudgetError = signal<ApiErrorResponse | null>(null);
  readonly incomeTemplateDownloadError = signal<string | null>(null);
  readonly categoryTemplateDownloadError = signal<string | null>(null);
  readonly paymentMethodTemplateDownloadError = signal<string | null>(null);
  readonly annualBudgetTemplateDownloadError = signal<string | null>(null);

  selectFile(file: File): void {
    this.selectedFile.set(file);
    this.error.set(null);
  }

  clearFile(): void {
    this.selectedFile.set(null);
  }

  selectIncomeFile(file: File): void {
    this.selectedIncomeFile.set(file);
    this.currentIncomeImportPreview.set(null);
    this.currentIncomeImportResult.set(null);
    this.incomeError.set(null);
  }

  clearIncomeFile(): void {
    this.selectedIncomeFile.set(null);
  }

  selectCategoryFile(file: File): void {
    this.selectedCategoryFile.set(file);
    this.currentCategoryImportPreview.set(null);
    this.currentCategoryImportResult.set(null);
    this.categoryError.set(null);
  }

  clearCategoryFile(): void {
    this.selectedCategoryFile.set(null);
  }

  selectPaymentMethodFile(file: File): void {
    this.selectedPaymentMethodFile.set(file);
    this.currentPaymentMethodImportPreview.set(null);
    this.currentPaymentMethodImportResult.set(null);
    this.paymentMethodError.set(null);
  }

  clearPaymentMethodFile(): void {
    this.selectedPaymentMethodFile.set(null);
  }

  selectAnnualBudgetFile(file: File): void {
    this.selectedAnnualBudgetFile.set(file);
    this.currentAnnualBudgetImportPreview.set(null);
    this.currentAnnualBudgetImportResult.set(null);
    this.annualBudgetError.set(null);
  }

  clearAnnualBudgetFile(): void {
    this.selectedAnnualBudgetFile.set(null);
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

  downloadIncomeTemplate(accountId: number): Observable<Blob> {
    this.ensureAccount(accountId);
    this.isDownloadingTemplate.set(true);
    this.incomeTemplateDownloadError.set(null);

    return this.importsApi.downloadIncomeImportTemplate(accountId).pipe(
      catchError((error: unknown) => {
        this.incomeTemplateDownloadError.set('No se pudo descargar la plantilla de ingresos. Intenta nuevamente.');
        return throwError(() => error);
      }),
      finalize(() => this.isDownloadingTemplate.set(false))
    );
  }

  previewIncomeFile(accountId: number): Observable<IncomeImportResponseDto> {
    this.ensureAccount(accountId);
    const file = this.selectedIncomeFile();

    if (!file) {
      const error = createLocalError('IMPORT_FILE_REQUIRED', 'Selecciona un archivo .xlsx para continuar.');
      this.incomeError.set(error);
      return throwError(() => error);
    }

    this.isPreviewingIncome.set(true);
    this.incomeError.set(null);

    return this.importsApi.previewIncomeImport(accountId, file).pipe(
      tap((result) => this.currentIncomeImportPreview.set(result)),
      catchError((error: unknown) => this.handleIncomeError(error)),
      finalize(() => this.isPreviewingIncome.set(false))
    );
  }

  importIncomeFile(accountId: number): Observable<IncomeImportResponseDto> {
    this.ensureAccount(accountId);
    const file = this.selectedIncomeFile();

    if (!file) {
      const error = createLocalError('IMPORT_FILE_REQUIRED', 'Selecciona un archivo .xlsx para continuar.');
      this.incomeError.set(error);
      return throwError(() => error);
    }

    this.isImportingIncome.set(true);
    this.incomeError.set(null);

    return this.importsApi.importIncomes(accountId, file).pipe(
      tap((result) => this.currentIncomeImportResult.set(result)),
      catchError((error: unknown) => this.handleIncomeError(error)),
      finalize(() => this.isImportingIncome.set(false))
    );
  }

  downloadCategoryTemplate(accountId: number): Observable<Blob> {
    this.ensureAccount(accountId);
    this.isDownloadingTemplate.set(true);
    this.categoryTemplateDownloadError.set(null);

    return this.importsApi.downloadCategoryImportTemplate(accountId).pipe(
      catchError((error: unknown) => {
        this.categoryTemplateDownloadError.set('No se pudo descargar la plantilla de categorias. Intenta nuevamente.');
        return throwError(() => error);
      }),
      finalize(() => this.isDownloadingTemplate.set(false))
    );
  }

  previewCategoryFile(accountId: number): Observable<CategoryImportResponseDto> {
    this.ensureAccount(accountId);
    const file = this.selectedCategoryFile();

    if (!file) {
      const error = createLocalError('IMPORT_FILE_REQUIRED', 'Selecciona un archivo .xlsx para continuar.');
      this.categoryError.set(error);
      return throwError(() => error);
    }

    this.isPreviewingCategory.set(true);
    this.categoryError.set(null);

    return this.importsApi.previewCategoryImport(accountId, file).pipe(
      tap((result) => this.currentCategoryImportPreview.set(result)),
      catchError((error: unknown) => this.handleCategoryError(error)),
      finalize(() => this.isPreviewingCategory.set(false))
    );
  }

  importCategoryFile(accountId: number): Observable<CategoryImportResponseDto> {
    this.ensureAccount(accountId);
    const file = this.selectedCategoryFile();

    if (!file) {
      const error = createLocalError('IMPORT_FILE_REQUIRED', 'Selecciona un archivo .xlsx para continuar.');
      this.categoryError.set(error);
      return throwError(() => error);
    }

    this.isImportingCategory.set(true);
    this.categoryError.set(null);

    return this.importsApi.importCategories(accountId, file).pipe(
      tap((result) => this.currentCategoryImportResult.set(result)),
      catchError((error: unknown) => this.handleCategoryError(error)),
      finalize(() => this.isImportingCategory.set(false))
    );
  }

  downloadPaymentMethodTemplate(accountId: number): Observable<Blob> {
    this.ensureAccount(accountId);
    this.isDownloadingTemplate.set(true);
    this.paymentMethodTemplateDownloadError.set(null);

    return this.importsApi.downloadPaymentMethodImportTemplate(accountId).pipe(
      catchError((error: unknown) => {
        this.paymentMethodTemplateDownloadError.set(
          'No se pudo descargar la plantilla de medios de pago. Intenta nuevamente.'
        );
        return throwError(() => error);
      }),
      finalize(() => this.isDownloadingTemplate.set(false))
    );
  }

  previewPaymentMethodFile(accountId: number): Observable<PaymentMethodImportResponseDto> {
    this.ensureAccount(accountId);
    const file = this.selectedPaymentMethodFile();

    if (!file) {
      const error = createLocalError('IMPORT_FILE_REQUIRED', 'Selecciona un archivo .xlsx para continuar.');
      this.paymentMethodError.set(error);
      return throwError(() => error);
    }

    this.isPreviewingPaymentMethod.set(true);
    this.paymentMethodError.set(null);

    return this.importsApi.previewPaymentMethodImport(accountId, file).pipe(
      tap((result) => this.currentPaymentMethodImportPreview.set(result)),
      catchError((error: unknown) => this.handlePaymentMethodError(error)),
      finalize(() => this.isPreviewingPaymentMethod.set(false))
    );
  }

  importPaymentMethodFile(accountId: number): Observable<PaymentMethodImportResponseDto> {
    this.ensureAccount(accountId);
    const file = this.selectedPaymentMethodFile();

    if (!file) {
      const error = createLocalError('IMPORT_FILE_REQUIRED', 'Selecciona un archivo .xlsx para continuar.');
      this.paymentMethodError.set(error);
      return throwError(() => error);
    }

    this.isImportingPaymentMethod.set(true);
    this.paymentMethodError.set(null);

    return this.importsApi.importPaymentMethods(accountId, file).pipe(
      tap((result) => this.currentPaymentMethodImportResult.set(result)),
      catchError((error: unknown) => this.handlePaymentMethodError(error)),
      finalize(() => this.isImportingPaymentMethod.set(false))
    );
  }

  downloadAnnualBudgetTemplate(accountId: number): Observable<Blob> {
    this.ensureAccount(accountId);
    this.isDownloadingTemplate.set(true);
    this.annualBudgetTemplateDownloadError.set(null);

    return this.importsApi.downloadAnnualBudgetImportTemplate(accountId).pipe(
      catchError((error: unknown) => {
        this.annualBudgetTemplateDownloadError.set(
          'No se pudo descargar la plantilla de presupuestos. Intenta nuevamente.'
        );
        return throwError(() => error);
      }),
      finalize(() => this.isDownloadingTemplate.set(false))
    );
  }

  previewAnnualBudgetFile(accountId: number): Observable<AnnualBudgetImportResponseDto> {
    this.ensureAccount(accountId);
    const file = this.selectedAnnualBudgetFile();

    if (!file) {
      const error = createLocalError('IMPORT_FILE_REQUIRED', 'Selecciona un archivo .xlsx para continuar.');
      this.annualBudgetError.set(error);
      return throwError(() => error);
    }

    this.isPreviewingAnnualBudget.set(true);
    this.annualBudgetError.set(null);

    return this.importsApi.previewAnnualBudgetImport(accountId, file).pipe(
      tap((result) => this.currentAnnualBudgetImportPreview.set(result)),
      catchError((error: unknown) => this.handleAnnualBudgetError(error)),
      finalize(() => this.isPreviewingAnnualBudget.set(false))
    );
  }

  importAnnualBudgetFile(accountId: number): Observable<AnnualBudgetImportResponseDto> {
    this.ensureAccount(accountId);
    const file = this.selectedAnnualBudgetFile();

    if (!file) {
      const error = createLocalError('IMPORT_FILE_REQUIRED', 'Selecciona un archivo .xlsx para continuar.');
      this.annualBudgetError.set(error);
      return throwError(() => error);
    }

    this.isImportingAnnualBudget.set(true);
    this.annualBudgetError.set(null);

    return this.importsApi.importAnnualBudget(accountId, file).pipe(
      tap((result) => this.currentAnnualBudgetImportResult.set(result)),
      catchError((error: unknown) => this.handleAnnualBudgetError(error)),
      finalize(() => this.isImportingAnnualBudget.set(false))
    );
  }

  clear(): void {
    this.currentAccountId.set(null);
    this.currentBatch.set(null);
    this.currentIncomeImportPreview.set(null);
    this.currentCategoryImportPreview.set(null);
    this.currentPaymentMethodImportPreview.set(null);
    this.currentAnnualBudgetImportPreview.set(null);
    this.currentIncomeImportResult.set(null);
    this.currentCategoryImportResult.set(null);
    this.currentPaymentMethodImportResult.set(null);
    this.currentAnnualBudgetImportResult.set(null);
    this.selectedFile.set(null);
    this.selectedIncomeFile.set(null);
    this.selectedCategoryFile.set(null);
    this.selectedPaymentMethodFile.set(null);
    this.selectedAnnualBudgetFile.set(null);
    this.isPreviewing.set(false);
    this.isConfirming.set(false);
    this.isLoading.set(false);
    this.isImportingIncome.set(false);
    this.isImportingCategory.set(false);
    this.isImportingPaymentMethod.set(false);
    this.isImportingAnnualBudget.set(false);
    this.isPreviewingIncome.set(false);
    this.isPreviewingCategory.set(false);
    this.isPreviewingPaymentMethod.set(false);
    this.isPreviewingAnnualBudget.set(false);
    this.error.set(null);
    this.incomeError.set(null);
    this.categoryError.set(null);
    this.paymentMethodError.set(null);
    this.annualBudgetError.set(null);
    this.templateDownloadError.set(null);
    this.incomeTemplateDownloadError.set(null);
    this.categoryTemplateDownloadError.set(null);
    this.paymentMethodTemplateDownloadError.set(null);
    this.annualBudgetTemplateDownloadError.set(null);
  }

  clearIncomeImportState(): void {
    this.currentIncomeImportPreview.set(null);
    this.currentIncomeImportResult.set(null);
    this.selectedIncomeFile.set(null);
    this.isPreviewingIncome.set(false);
    this.isImportingIncome.set(false);
    this.incomeError.set(null);
    this.incomeTemplateDownloadError.set(null);
  }

  clearCategoryImportState(): void {
    this.currentCategoryImportPreview.set(null);
    this.currentCategoryImportResult.set(null);
    this.selectedCategoryFile.set(null);
    this.isPreviewingCategory.set(false);
    this.isImportingCategory.set(false);
    this.categoryError.set(null);
    this.categoryTemplateDownloadError.set(null);
  }

  clearPaymentMethodImportState(): void {
    this.currentPaymentMethodImportPreview.set(null);
    this.currentPaymentMethodImportResult.set(null);
    this.selectedPaymentMethodFile.set(null);
    this.isPreviewingPaymentMethod.set(false);
    this.isImportingPaymentMethod.set(false);
    this.paymentMethodError.set(null);
    this.paymentMethodTemplateDownloadError.set(null);
  }

  clearAnnualBudgetImportState(): void {
    this.currentAnnualBudgetImportPreview.set(null);
    this.currentAnnualBudgetImportResult.set(null);
    this.selectedAnnualBudgetFile.set(null);
    this.isPreviewingAnnualBudget.set(false);
    this.isImportingAnnualBudget.set(false);
    this.annualBudgetError.set(null);
    this.annualBudgetTemplateDownloadError.set(null);
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
    this.currentIncomeImportPreview.set(null);
    this.currentCategoryImportPreview.set(null);
    this.currentPaymentMethodImportPreview.set(null);
    this.currentAnnualBudgetImportPreview.set(null);
    this.currentIncomeImportResult.set(null);
    this.currentCategoryImportResult.set(null);
    this.currentPaymentMethodImportResult.set(null);
    this.currentAnnualBudgetImportResult.set(null);
    this.selectedFile.set(null);
    this.selectedIncomeFile.set(null);
    this.selectedCategoryFile.set(null);
    this.selectedPaymentMethodFile.set(null);
    this.selectedAnnualBudgetFile.set(null);
    this.error.set(null);
    this.incomeError.set(null);
    this.categoryError.set(null);
    this.paymentMethodError.set(null);
    this.annualBudgetError.set(null);
    this.templateDownloadError.set(null);
    this.incomeTemplateDownloadError.set(null);
    this.categoryTemplateDownloadError.set(null);
    this.paymentMethodTemplateDownloadError.set(null);
    this.annualBudgetTemplateDownloadError.set(null);
  }

  private handleError(error: unknown): Observable<never> {
    this.error.set(toApiError(error));
    return throwError(() => error);
  }

  private handleIncomeError(error: unknown): Observable<never> {
    this.incomeError.set(toApiError(error));
    return throwError(() => error);
  }

  private handleCategoryError(error: unknown): Observable<never> {
    this.categoryError.set(toApiError(error));
    return throwError(() => error);
  }

  private handlePaymentMethodError(error: unknown): Observable<never> {
    this.paymentMethodError.set(toApiError(error));
    return throwError(() => error);
  }

  private handleAnnualBudgetError(error: unknown): Observable<never> {
    this.annualBudgetError.set(toApiError(error));
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
