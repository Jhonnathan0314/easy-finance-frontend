import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, switchMap, tap, throwError } from 'rxjs';

import {
  ApiErrorResponse,
  CreateExpenseRequest,
  CreateInstallmentExpenseRequest,
  DuplicateExpenseRequest,
  ExpenseListFilters,
  ExpensePaymentState,
  ExpenseResponseDto,
  ExpenseStatus,
  UpdateExpenseRequest
} from '../../shared/models';
import { FeatureFilterStorageService } from '../filters/feature-filter-storage.service';
import { ExpensesApiService } from './expenses-api.service';

export interface ExpenseFilters {
  from: string | null;
  to: string | null;
  search: string | null;
  categoryId: number | null;
  paymentMethodId: number | null;
  participantId: number | null;
  paymentState: ExpensePaymentState | null;
  status: ExpenseStatus;
  page: number;
  size: number;
  sort: string;
}

interface ExpensePagination {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

const DEFAULT_FILTERS: ExpenseFilters = {
  from: null,
  to: null,
  search: null,
  categoryId: null,
  paymentMethodId: null,
  participantId: null,
  paymentState: null,
  status: 'ACTIVE',
  page: 0,
  size: 20,
  sort: 'expenseDate,desc'
};
const EXPENSE_FILTERS_FEATURE = 'expenses';
const PAYMENT_STATES: Array<ExpensePaymentState | null> = [null, 'PENDING', 'PARTIAL', 'PAID'];
const EXPENSE_STATUSES: ExpenseStatus[] = ['ACTIVE', 'CANCELLED'];

@Injectable({ providedIn: 'root' })
export class ExpensesStore {
  private readonly expensesApi = inject(ExpensesApiService);
  private readonly filterStorage = inject(FeatureFilterStorageService);
  private readonly currentAccountId = signal<number | null>(null);

  readonly expenses = signal<ExpenseResponseDto[]>([]);
  readonly selectedExpense = signal<ExpenseResponseDto | null>(null);
  readonly filters = signal<ExpenseFilters>({ ...DEFAULT_FILTERS });
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly pagination = signal<ExpensePagination>({ page: 0, size: 20, totalElements: 0, totalPages: 0 });

  loadExpenses(
    accountId: number,
    filters?: Partial<ExpenseFilters>,
    options: { persist?: boolean } = {}
  ): Observable<ExpenseResponseDto[]> {
    this.ensureAccount(accountId);
    const nextFilters = normalizeExpenseFilters({ ...this.filters(), ...filters });
    this.filters.set(nextFilters);

    if (options.persist) {
      this.filterStorage.setFilters(EXPENSE_FILTERS_FEATURE, accountId, filtersForStorage(nextFilters));
    }

    this.isLoading.set(true);
    this.error.set(null);

    return this.expensesApi.listExpenses(accountId, nextFilters).pipe(
      tap((page) => this.pagination.set({
        page: page.page,
        size: page.size,
        totalElements: page.totalElements,
        totalPages: page.totalPages
      })),
      map((page) => page.content),
      tap((expenses) => this.expenses.set(expenses)),
      catchError((error: unknown) => {
        this.error.set(toApiError(error));
        return throwError(() => error);
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  createSimpleExpense(accountId: number, request: CreateExpenseRequest): Observable<ExpenseResponseDto[]> {
    return this.saveAndRefresh(accountId, this.expensesApi.createExpense(accountId, request));
  }

  updateExpense(accountId: number, expenseId: number, request: UpdateExpenseRequest): Observable<ExpenseResponseDto[]> {
    return this.saveAndRefresh(accountId, this.expensesApi.updateExpense(accountId, expenseId, request));
  }

  duplicateExpense(accountId: number, expenseId: number, request: DuplicateExpenseRequest): Observable<ExpenseResponseDto> {
    this.ensureAccount(accountId);
    this.isSaving.set(true);
    this.error.set(null);

    return this.expensesApi.duplicateExpense(accountId, expenseId, request).pipe(
      switchMap((expense) =>
        this.loadExpenses(accountId).pipe(
          tap(() => this.selectedExpense.set(expense)),
          map(() => expense)
        )
      ),
      catchError((error: unknown) => {
        this.error.set(toApiError(error));
        return throwError(() => error);
      }),
      finalize(() => this.isSaving.set(false))
    );
  }

  cancelExpense(accountId: number, expenseId: number): Observable<ExpenseResponseDto[]> {
    return this.saveAndRefresh(accountId, this.expensesApi.cancelExpense(accountId, expenseId));
  }

  createInstallmentExpense(accountId: number, request: CreateInstallmentExpenseRequest): Observable<ExpenseResponseDto[]> {
    return this.saveAndRefresh(accountId, this.expensesApi.createInstallmentExpense(accountId, request));
  }

  getExpense(accountId: number, expenseId: number): Observable<ExpenseResponseDto> {
    this.ensureAccount(accountId);
    this.isLoading.set(true);
    this.error.set(null);

    return this.expensesApi.getExpense(accountId, expenseId).pipe(
      tap((expense) => this.selectedExpense.set(expense)),
      catchError((error: unknown) => {
        this.error.set(toApiError(error));
        return throwError(() => error);
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  loadPersistedFilters(accountId: number): ExpenseFilters {
    this.ensureAccount(accountId);
    const saved = this.filterStorage.getFilters<Partial<ExpenseFilters>>(EXPENSE_FILTERS_FEATURE, accountId);
    const filters = saved ? normalizeExpenseFilters({ ...DEFAULT_FILTERS, ...saved }) : { ...DEFAULT_FILTERS };

    this.filters.set(filters);
    return filters;
  }

  clearPersistedFilters(accountId: number): ExpenseFilters {
    this.ensureAccount(accountId);
    this.filterStorage.clearFilters(EXPENSE_FILTERS_FEATURE, accountId);
    const filters = { ...DEFAULT_FILTERS };
    this.filters.set(filters);

    return filters;
  }

  clear(): void {
    this.currentAccountId.set(null);
    this.expenses.set([]);
    this.selectedExpense.set(null);
    this.filters.set({ ...DEFAULT_FILTERS });
    this.pagination.set({ page: 0, size: 20, totalElements: 0, totalPages: 0 });
    this.error.set(null);
  }

  private saveAndRefresh(accountId: number, request$: Observable<unknown>): Observable<ExpenseResponseDto[]> {
    this.ensureAccount(accountId);
    this.isSaving.set(true);
    this.error.set(null);

    return request$.pipe(
      switchMap(() => this.loadExpenses(accountId)),
      catchError((error: unknown) => {
        this.error.set(toApiError(error));
        return throwError(() => error);
      }),
      finalize(() => this.isSaving.set(false))
    );
  }

  private ensureAccount(accountId: number): void {
    if (this.currentAccountId() === accountId) {
      return;
    }

    this.currentAccountId.set(accountId);
    this.expenses.set([]);
    this.selectedExpense.set(null);
    this.filters.set({ ...DEFAULT_FILTERS });
    this.pagination.set({ page: 0, size: 20, totalElements: 0, totalPages: 0 });
    this.error.set(null);
  }
}

function normalizeExpenseFilters(filters: Partial<ExpenseFilters>): ExpenseFilters {
  return {
    from: stringOrNull(filters.from),
    to: stringOrNull(filters.to),
    search: stringOrNull(filters.search),
    categoryId: numberOrNull(filters.categoryId),
    paymentMethodId: numberOrNull(filters.paymentMethodId),
    participantId: numberOrNull(filters.participantId),
    paymentState: PAYMENT_STATES.includes(filters.paymentState ?? null) ? filters.paymentState ?? null : null,
    status: EXPENSE_STATUSES.includes(filters.status as ExpenseStatus) ? (filters.status as ExpenseStatus) : 'ACTIVE',
    page: numberOrDefault(filters.page, 0),
    size: numberOrDefault(filters.size, 20),
    sort: typeof filters.sort === 'string' && filters.sort ? filters.sort : 'expenseDate,desc'
  };
}

function filtersForStorage(filters: ExpenseFilters): Omit<ExpenseFilters, 'page' | 'size'> {
  return {
    from: filters.from,
    to: filters.to,
    search: filters.search,
    categoryId: filters.categoryId,
    paymentMethodId: filters.paymentMethodId,
    participantId: filters.participantId,
    paymentState: filters.paymentState,
    status: filters.status,
    sort: filters.sort
  };
}

function stringOrNull(value: unknown): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';

  return trimmed ? trimmed : null;
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
