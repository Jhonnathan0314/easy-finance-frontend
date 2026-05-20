import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, switchMap, tap, throwError } from 'rxjs';

import {
  ApiErrorResponse,
  CreateIncomeRequest,
  DuplicateIncomeRequest,
  IncomeListFilters,
  IncomeResponseDto,
  IncomeStatus,
  UpdateIncomeRequest
} from '../../shared/models';
import { FeatureFilterStorageService } from '../filters/feature-filter-storage.service';
import { IncomeApiService } from './income-api.service';

export interface IncomeFilters {
  from: string | null;
  to: string | null;
  search: string | null;
  categoryId: number | null;
  participantId: number | null;
  status: IncomeStatus;
  page: number;
  size: number;
  sort: string;
}

interface IncomePagination {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

const DEFAULT_FILTERS: IncomeFilters = {
  from: null,
  to: null,
  search: null,
  categoryId: null,
  participantId: null,
  status: 'ACTIVE',
  page: 0,
  size: 20,
  sort: 'incomeDate,desc'
};
const INCOME_FILTERS_FEATURE = 'income';
const INCOME_STATUSES: IncomeStatus[] = ['ACTIVE', 'CANCELLED'];

@Injectable({ providedIn: 'root' })
export class IncomeStore {
  private readonly incomeApi = inject(IncomeApiService);
  private readonly filterStorage = inject(FeatureFilterStorageService);
  private readonly currentAccountId = signal<number | null>(null);

  readonly incomes = signal<IncomeResponseDto[]>([]);
  readonly selectedIncome = signal<IncomeResponseDto | null>(null);
  readonly filters = signal<IncomeFilters>({ ...DEFAULT_FILTERS });
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly pagination = signal<IncomePagination>({ page: 0, size: 20, totalElements: 0, totalPages: 0 });

  loadIncomes(
    accountId: number,
    filters?: Partial<IncomeFilters>,
    options: { persist?: boolean } = {}
  ): Observable<IncomeResponseDto[]> {
    this.ensureAccount(accountId);
    const nextFilters = normalizeIncomeFilters({ ...this.filters(), ...filters });
    this.filters.set(nextFilters);

    if (options.persist) {
      this.filterStorage.setFilters(INCOME_FILTERS_FEATURE, accountId, filtersForStorage(nextFilters));
    }

    this.isLoading.set(true);
    this.error.set(null);

    return this.incomeApi.listIncomes(accountId, nextFilters).pipe(
      tap((page) =>
        this.pagination.set({
          page: page.page,
          size: page.size,
          totalElements: page.totalElements,
          totalPages: page.totalPages
        })
      ),
      map((page) => page.content),
      tap((incomes) => this.incomes.set(incomes)),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isLoading.set(false))
    );
  }

  createIncome(accountId: number, request: CreateIncomeRequest): Observable<IncomeResponseDto[]> {
    return this.saveAndRefresh(accountId, this.incomeApi.createIncome(accountId, request));
  }

  updateIncome(accountId: number, incomeId: number, request: UpdateIncomeRequest): Observable<IncomeResponseDto[]> {
    return this.saveAndRefresh(accountId, this.incomeApi.updateIncome(accountId, incomeId, request));
  }

  duplicateIncome(accountId: number, incomeId: number, request: DuplicateIncomeRequest): Observable<IncomeResponseDto> {
    this.ensureAccount(accountId);
    this.isSaving.set(true);
    this.error.set(null);

    return this.incomeApi.duplicateIncome(accountId, incomeId, request).pipe(
      switchMap((income) =>
        this.loadIncomes(accountId).pipe(
          tap(() => this.selectedIncome.set(income)),
          map(() => income)
        )
      ),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isSaving.set(false))
    );
  }

  cancelIncome(accountId: number, incomeId: number): Observable<IncomeResponseDto[]> {
    return this.saveAndRefresh(accountId, this.incomeApi.cancelIncome(accountId, incomeId));
  }

  getIncome(accountId: number, incomeId: number): Observable<IncomeResponseDto> {
    this.ensureAccount(accountId);
    this.isLoading.set(true);
    this.error.set(null);

    return this.incomeApi.getIncome(accountId, incomeId).pipe(
      tap((income) => {
        this.selectedIncome.set(income);
        this.incomes.update((incomes) => incomes.map((item) => (item.id === income.id ? income : item)));
      }),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isLoading.set(false))
    );
  }

  loadPersistedFilters(accountId: number): IncomeFilters {
    this.ensureAccount(accountId);
    const saved = this.filterStorage.getFilters<Partial<IncomeFilters>>(INCOME_FILTERS_FEATURE, accountId);
    const filters = saved
      ? normalizeIncomeFilters({ ...DEFAULT_FILTERS, ...saved, participantId: null, status: DEFAULT_FILTERS.status })
      : { ...DEFAULT_FILTERS };

    this.filters.set(filters);
    return filters;
  }

  clearPersistedFilters(accountId: number): IncomeFilters {
    this.ensureAccount(accountId);
    this.filterStorage.clearFilters(INCOME_FILTERS_FEATURE, accountId);
    const filters = { ...DEFAULT_FILTERS };
    this.filters.set(filters);

    return filters;
  }

  clear(): void {
    this.currentAccountId.set(null);
    this.incomes.set([]);
    this.selectedIncome.set(null);
    this.filters.set({ ...DEFAULT_FILTERS });
    this.pagination.set({ page: 0, size: 20, totalElements: 0, totalPages: 0 });
    this.error.set(null);
  }

  private saveAndRefresh(accountId: number, request$: Observable<unknown>): Observable<IncomeResponseDto[]> {
    this.ensureAccount(accountId);
    this.isSaving.set(true);
    this.error.set(null);

    return request$.pipe(
      switchMap(() => this.loadIncomes(accountId)),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isSaving.set(false))
    );
  }

  private ensureAccount(accountId: number): void {
    if (this.currentAccountId() === accountId) {
      return;
    }

    this.currentAccountId.set(accountId);
    this.incomes.set([]);
    this.selectedIncome.set(null);
    this.filters.set({ ...DEFAULT_FILTERS });
    this.pagination.set({ page: 0, size: 20, totalElements: 0, totalPages: 0 });
    this.error.set(null);
  }

  private handleError(error: unknown): Observable<never> {
    this.error.set(toApiError(error));
    return throwError(() => error);
  }
}

function normalizeIncomeFilters(filters: Partial<IncomeFilters>): IncomeFilters {
  return {
    from: stringOrNull(filters.from),
    to: stringOrNull(filters.to),
    search: stringOrNull(filters.search),
    categoryId: numberOrNull(filters.categoryId),
    participantId: numberOrNull(filters.participantId),
    status: INCOME_STATUSES.includes(filters.status as IncomeStatus) ? (filters.status as IncomeStatus) : 'ACTIVE',
    page: numberOrDefault(filters.page, 0),
    size: numberOrDefault(filters.size, 20),
    sort: typeof filters.sort === 'string' && filters.sort ? filters.sort : 'incomeDate,desc'
  };
}

function filtersForStorage(filters: IncomeFilters): Omit<IncomeFilters, 'page' | 'size' | 'participantId' | 'status'> {
  return {
    from: filters.from,
    to: filters.to,
    search: filters.search,
    categoryId: filters.categoryId,
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
