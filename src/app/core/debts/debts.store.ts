import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, switchMap, tap, throwError } from 'rxjs';

import {
  ApiErrorResponse,
  CreateManualDebtRequest,
  DebtListFilters,
  DebtPaymentListFilters,
  DebtPaymentResponseDto,
  DebtPaymentStatus,
  DebtPaymentType,
  DebtResponseDto,
  DebtSourceType,
  DebtState,
  RegisterDebtPaymentRequest
} from '../../shared/models';
import { FeatureFilterStorageService } from '../filters/feature-filter-storage.service';
import { DebtsApiService } from './debts-api.service';

export interface DebtFilters {
  state: DebtState;
  sourceType: DebtSourceType | null;
  participantId: number | null;
  from: string | null;
  to: string | null;
  page: number;
  size: number;
  sort: string;
}

export interface PaymentFilters {
  from: string | null;
  to: string | null;
  paymentType: DebtPaymentType | null;
  status: DebtPaymentStatus;
  page: number;
  size: number;
  sort: string;
}

interface Pagination {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

const DEFAULT_DEBT_FILTERS: DebtFilters = {
  state: 'ACTIVE',
  sourceType: null,
  participantId: null,
  from: null,
  to: null,
  page: 0,
  size: 20,
  sort: 'startDate,desc'
};

const DEFAULT_PAYMENT_FILTERS: PaymentFilters = {
  from: null,
  to: null,
  paymentType: null,
  status: 'ACTIVE',
  page: 0,
  size: 20,
  sort: 'paymentDate,desc'
};
const DEBTS_FILTERS_FEATURE = 'debts';
const DEBT_STATES: DebtState[] = ['ACTIVE', 'PAID', 'CANCELLED'];
const DEBT_SOURCE_TYPES: Array<DebtSourceType | null> = [null, 'MANUAL', 'INSTALLMENT_EXPENSE'];
const PAYMENT_TYPES: Array<DebtPaymentType | null> = [null, 'INSTALLMENT', 'CAPITAL_PAYMENT'];
const PAYMENT_STATUSES: DebtPaymentStatus[] = ['ACTIVE', 'CANCELLED'];

export interface DebtsPersistedFilters {
  debtFilters: Omit<DebtFilters, 'page' | 'size'>;
  paymentFilters: Omit<PaymentFilters, 'page' | 'size'>;
}

@Injectable({ providedIn: 'root' })
export class DebtsStore {
  private readonly debtsApi = inject(DebtsApiService);
  private readonly filterStorage = inject(FeatureFilterStorageService);
  private readonly currentAccountId = signal<number | null>(null);

  readonly debts = signal<DebtResponseDto[]>([]);
  readonly selectedDebt = signal<DebtResponseDto | null>(null);
  readonly payments = signal<DebtPaymentResponseDto[]>([]);
  readonly debtFilters = signal<DebtFilters>({ ...DEFAULT_DEBT_FILTERS });
  readonly paymentFilters = signal<PaymentFilters>({ ...DEFAULT_PAYMENT_FILTERS });
  readonly isLoadingDebts = signal(false);
  readonly isLoadingPayments = signal(false);
  readonly isSaving = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly pagination = signal<Pagination>({ page: 0, size: 20, totalElements: 0, totalPages: 0 });

  loadDebts(
    accountId: number,
    filters?: Partial<DebtFilters>,
    options: { persist?: boolean } = {}
  ): Observable<DebtResponseDto[]> {
    this.ensureAccount(accountId);
    const nextFilters = normalizeDebtFilters({ ...this.debtFilters(), ...filters });
    this.debtFilters.set(nextFilters);

    if (options.persist) {
      this.persistFilters(accountId);
    }

    this.isLoadingDebts.set(true);
    this.error.set(null);

    return this.debtsApi.listDebts(accountId, nextFilters).pipe(
      tap((page) => this.pagination.set({
        page: page.page,
        size: page.size,
        totalElements: page.totalElements,
        totalPages: page.totalPages
      })),
      map((page) => page.content),
      tap((debts) => this.debts.set(debts)),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isLoadingDebts.set(false))
    );
  }

  getDebt(accountId: number, debtId: number): Observable<DebtResponseDto> {
    this.ensureAccount(accountId);
    this.isLoadingDebts.set(true);
    this.error.set(null);

    return this.debtsApi.getDebt(accountId, debtId).pipe(
      tap((debt) => {
        this.selectedDebt.set(debt);
        this.debts.update((debts) => debts.map((item) => (item.id === debt.id ? debt : item)));
      }),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isLoadingDebts.set(false))
    );
  }

  createManualDebt(accountId: number, request: CreateManualDebtRequest): Observable<DebtResponseDto[]> {
    this.ensureAccount(accountId);
    this.isSaving.set(true);
    this.error.set(null);

    return this.debtsApi.createManualDebt(accountId, request).pipe(
      switchMap(() => this.loadDebts(accountId)),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isSaving.set(false))
    );
  }

  cancelDebt(accountId: number, debtId: number): Observable<DebtResponseDto[]> {
    this.ensureAccount(accountId);
    this.isSaving.set(true);
    this.error.set(null);

    return this.debtsApi.cancelDebt(accountId, debtId).pipe(
      switchMap(() => this.loadDebts(accountId)),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isSaving.set(false))
    );
  }

  loadPayments(
    accountId: number,
    debtId: number,
    filters?: Partial<PaymentFilters>,
    options: { persist?: boolean } = {}
  ): Observable<DebtPaymentResponseDto[]> {
    this.ensureAccount(accountId);
    const nextFilters = normalizePaymentFilters({ ...this.paymentFilters(), ...filters });
    this.paymentFilters.set(nextFilters);

    if (options.persist) {
      this.persistFilters(accountId);
    }

    this.isLoadingPayments.set(true);
    this.error.set(null);

    return this.debtsApi.listPayments(accountId, debtId, nextFilters).pipe(
      map((page) => page.content),
      tap((payments) => this.payments.set(payments)),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isLoadingPayments.set(false))
    );
  }

  registerPayment(accountId: number, debtId: number, request: RegisterDebtPaymentRequest): Observable<DebtPaymentResponseDto[]> {
    this.ensureAccount(accountId);
    this.isSaving.set(true);
    this.error.set(null);

    return this.debtsApi.registerPayment(accountId, debtId, request).pipe(
      tap((response) => {
        this.selectedDebt.set(response.debt);
        this.debts.update((debts) => debts.map((debt) => (debt.id === response.debt.id ? response.debt : debt)));
      }),
      switchMap(() => this.loadDebts(accountId)),
      switchMap(() => this.loadPayments(accountId, debtId)),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isSaving.set(false))
    );
  }

  loadPersistedFilters(accountId: number): DebtsPersistedFilters {
    this.ensureAccount(accountId);
    const saved = this.filterStorage.getFilters<Partial<DebtsPersistedFilters>>(DEBTS_FILTERS_FEATURE, accountId);
    const debtFilters = normalizeDebtFilters({ ...DEFAULT_DEBT_FILTERS, ...saved?.debtFilters });
    const paymentFilters = normalizePaymentFilters({ ...DEFAULT_PAYMENT_FILTERS, ...saved?.paymentFilters });

    this.debtFilters.set(debtFilters);
    this.paymentFilters.set(paymentFilters);

    return {
      debtFilters: debtFiltersForStorage(debtFilters),
      paymentFilters: paymentFiltersForStorage(paymentFilters)
    };
  }

  clearPersistedFilters(accountId: number): DebtsPersistedFilters {
    this.ensureAccount(accountId);
    this.filterStorage.clearFilters(DEBTS_FILTERS_FEATURE, accountId);
    const debtFilters = { ...DEFAULT_DEBT_FILTERS };
    const paymentFilters = { ...DEFAULT_PAYMENT_FILTERS };

    this.debtFilters.set(debtFilters);
    this.paymentFilters.set(paymentFilters);

    return {
      debtFilters: debtFiltersForStorage(debtFilters),
      paymentFilters: paymentFiltersForStorage(paymentFilters)
    };
  }

  clear(): void {
    this.currentAccountId.set(null);
    this.debts.set([]);
    this.selectedDebt.set(null);
    this.payments.set([]);
    this.debtFilters.set({ ...DEFAULT_DEBT_FILTERS });
    this.paymentFilters.set({ ...DEFAULT_PAYMENT_FILTERS });
    this.pagination.set({ page: 0, size: 20, totalElements: 0, totalPages: 0 });
    this.error.set(null);
  }

  private ensureAccount(accountId: number): void {
    if (this.currentAccountId() === accountId) {
      return;
    }

    this.currentAccountId.set(accountId);
    this.debts.set([]);
    this.selectedDebt.set(null);
    this.payments.set([]);
    this.debtFilters.set({ ...DEFAULT_DEBT_FILTERS });
    this.paymentFilters.set({ ...DEFAULT_PAYMENT_FILTERS });
    this.pagination.set({ page: 0, size: 20, totalElements: 0, totalPages: 0 });
    this.error.set(null);
  }

  private persistFilters(accountId: number): void {
    this.filterStorage.setFilters<DebtsPersistedFilters>(DEBTS_FILTERS_FEATURE, accountId, {
      debtFilters: debtFiltersForStorage(this.debtFilters()),
      paymentFilters: paymentFiltersForStorage(this.paymentFilters())
    });
  }

  private handleError(error: unknown): Observable<never> {
    this.error.set(toApiError(error));
    return throwError(() => error);
  }
}

function normalizeDebtFilters(filters: Partial<DebtFilters>): DebtFilters {
  return {
    state: DEBT_STATES.includes(filters.state as DebtState) ? (filters.state as DebtState) : 'ACTIVE',
    sourceType: DEBT_SOURCE_TYPES.includes(filters.sourceType ?? null) ? filters.sourceType ?? null : null,
    participantId: numberOrNull(filters.participantId),
    from: stringOrNull(filters.from),
    to: stringOrNull(filters.to),
    page: numberOrDefault(filters.page, 0),
    size: numberOrDefault(filters.size, 20),
    sort: typeof filters.sort === 'string' && filters.sort ? filters.sort : 'startDate,desc'
  };
}

function normalizePaymentFilters(filters: Partial<PaymentFilters>): PaymentFilters {
  return {
    from: stringOrNull(filters.from),
    to: stringOrNull(filters.to),
    paymentType: PAYMENT_TYPES.includes(filters.paymentType ?? null) ? filters.paymentType ?? null : null,
    status: PAYMENT_STATUSES.includes(filters.status as DebtPaymentStatus) ? (filters.status as DebtPaymentStatus) : 'ACTIVE',
    page: numberOrDefault(filters.page, 0),
    size: numberOrDefault(filters.size, 20),
    sort: typeof filters.sort === 'string' && filters.sort ? filters.sort : 'paymentDate,desc'
  };
}

function debtFiltersForStorage(filters: DebtFilters): Omit<DebtFilters, 'page' | 'size'> {
  return {
    state: filters.state,
    sourceType: filters.sourceType,
    participantId: filters.participantId,
    from: filters.from,
    to: filters.to,
    sort: filters.sort
  };
}

function paymentFiltersForStorage(filters: PaymentFilters): Omit<PaymentFilters, 'page' | 'size'> {
  return {
    from: filters.from,
    to: filters.to,
    paymentType: filters.paymentType,
    status: filters.status,
    sort: filters.sort
  };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function numberOrDefault(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : fallback;
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
