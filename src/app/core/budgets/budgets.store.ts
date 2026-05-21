import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, switchMap, tap, throwError } from 'rxjs';

import {
  ApiErrorResponse,
  BudgetDetailResponseDto,
  BudgetListFilters,
  BudgetResponseDto,
  BudgetSummaryResponseDto,
  BudgetStatus,
  CreateSubBudgetRequest,
  DuplicateBudgetRequest,
  UpdateSubBudgetRequest,
  UpsertBudgetRequest
} from '../../shared/models';
import { AnalyticsApiService } from '../analytics/analytics-api.service';
import { FeatureFilterStorageService } from '../filters/feature-filter-storage.service';
import { BudgetsApiService } from './budgets-api.service';

export interface BudgetFilters {
  year: number | null;
  status: BudgetStatus | null;
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

const DEFAULT_FILTERS: BudgetFilters = {
  year: null,
  status: null,
  page: 0,
  size: 20,
  sort: 'month,desc'
};
const BUDGETS_FILTERS_FEATURE = 'budgets';
const BUDGET_STATUSES: Array<BudgetStatus | null> = [null, 'ACTIVE', 'CLOSED', 'ARCHIVED'];

export interface BudgetPersistedFilters {
  selectedYear: number;
  selectedMonth: number;
  year: number | null;
  status: BudgetStatus | null;
  sort: string;
}

@Injectable({ providedIn: 'root' })
export class BudgetsStore {
  private readonly budgetsApi = inject(BudgetsApiService);
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly filterStorage = inject(FeatureFilterStorageService);
  private readonly currentAccountId = signal<number | null>(null);
  private readonly selectedPeriod = signal<{ year: number; month: number } | null>(null);

  readonly budgets = signal<BudgetResponseDto[]>([]);
  readonly selectedBudgetDetail = signal<BudgetDetailResponseDto | null>(null);
  readonly budgetSummary = signal<BudgetSummaryResponseDto | null>(null);
  readonly filters = signal<BudgetFilters>({ ...DEFAULT_FILTERS });
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly pagination = signal<Pagination>({ page: 0, size: 20, totalElements: 0, totalPages: 0 });

  loadBudgets(
    accountId: number,
    filters?: Partial<BudgetFilters>,
    options: { persist?: boolean } = {}
  ): Observable<BudgetResponseDto[]> {
    this.ensureAccount(accountId);
    const nextFilters = normalizeBudgetFilters({ ...this.filters(), ...filters });
    this.filters.set(nextFilters);

    if (options.persist) {
      this.persistFilters(accountId);
    }

    this.isLoading.set(true);
    this.error.set(null);

    return this.budgetsApi.listBudgets(accountId, nextFilters).pipe(
      tap((page) =>
        this.pagination.set({
          page: page.page,
          size: page.size,
          totalElements: page.totalElements,
          totalPages: page.totalPages
        })
      ),
      map((page) => page.content),
      tap((budgets) => this.budgets.set(budgets)),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isLoading.set(false))
    );
  }

  getBudgetDetail(
    accountId: number,
    year: number,
    month: number,
    options: { persist?: boolean } = {}
  ): Observable<BudgetDetailResponseDto> {
    this.ensureAccount(accountId);
    this.selectedPeriod.set({ year, month });

    if (options.persist) {
      this.persistFilters(accountId);
    }

    this.isLoading.set(true);
    this.error.set(null);

    return this.budgetsApi.getBudgetDetail(accountId, year, month).pipe(
      tap((detail) => this.selectedBudgetDetail.set(detail)),
      switchMap((detail) =>
        this.analyticsApi.getBudgetSummary(accountId, year, month).pipe(
          tap((summary) => this.budgetSummary.set(summary)),
          map(() => detail)
        )
      ),
      catchError((error: unknown) => {
        this.selectedBudgetDetail.set(null);
        this.budgetSummary.set(null);
        return this.handleError(error);
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  upsertBudget(
    accountId: number,
    year: number,
    month: number,
    request: UpsertBudgetRequest
  ): Observable<BudgetDetailResponseDto> {
    this.ensureAccount(accountId);
    this.selectedPeriod.set({ year, month });
    this.isSaving.set(true);
    this.error.set(null);

    return this.budgetsApi.upsertBudget(accountId, year, month, request).pipe(
      switchMap(() => this.loadBudgets(accountId, { year })),
      switchMap(() => this.getBudgetDetail(accountId, year, month)),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isSaving.set(false))
    );
  }

  duplicateBudget(
    accountId: number,
    sourceYear: number,
    sourceMonth: number,
    request: DuplicateBudgetRequest
  ): Observable<BudgetDetailResponseDto> {
    this.ensureAccount(accountId);
    this.selectedPeriod.set({ year: request.targetYear, month: request.targetMonth });
    this.isSaving.set(true);
    this.error.set(null);

    return this.budgetsApi.duplicateBudget(accountId, sourceYear, sourceMonth, request).pipe(
      switchMap(() => this.loadBudgets(accountId, { year: request.targetYear })),
      switchMap(() => this.getBudgetDetail(accountId, request.targetYear, request.targetMonth)),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isSaving.set(false))
    );
  }

  createSubBudget(
    accountId: number,
    budgetId: number,
    request: CreateSubBudgetRequest
  ): Observable<BudgetDetailResponseDto> {
    this.ensureAccount(accountId);
    this.isSaving.set(true);
    this.error.set(null);

    return this.budgetsApi.createSubBudget(accountId, budgetId, request).pipe(
      switchMap(() => this.refreshSelectedDetail(accountId)),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isSaving.set(false))
    );
  }

  updateSubBudget(
    accountId: number,
    budgetId: number,
    subBudgetId: number,
    request: UpdateSubBudgetRequest
  ): Observable<BudgetDetailResponseDto> {
    this.ensureAccount(accountId);
    this.isSaving.set(true);
    this.error.set(null);

    return this.budgetsApi.updateSubBudget(accountId, budgetId, subBudgetId, request).pipe(
      switchMap(() => this.refreshSelectedDetail(accountId)),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isSaving.set(false))
    );
  }

  deactivateSubBudget(accountId: number, budgetId: number, subBudgetId: number): Observable<BudgetDetailResponseDto> {
    this.ensureAccount(accountId);
    this.isSaving.set(true);
    this.error.set(null);

    return this.budgetsApi.deactivateSubBudget(accountId, budgetId, subBudgetId).pipe(
      switchMap(() => this.refreshSelectedDetail(accountId)),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.isSaving.set(false))
    );
  }

  loadPersistedFilters(accountId: number): BudgetPersistedFilters {
    this.ensureAccount(accountId);
    const saved = this.filterStorage.getFilters<Partial<BudgetPersistedFilters>>(BUDGETS_FILTERS_FEATURE, accountId);
    const fallback = this.defaultPersistedFilters();
    const persisted = normalizeBudgetPersistedFilters(saved ?? {}, fallback);

    this.filters.set(normalizeBudgetFilters({ ...DEFAULT_FILTERS, year: persisted.year, status: persisted.status, sort: persisted.sort }));
    this.selectedPeriod.set({ year: persisted.selectedYear, month: persisted.selectedMonth });

    return persisted;
  }

  clearPersistedFilters(accountId: number): BudgetPersistedFilters {
    this.ensureAccount(accountId);
    this.filterStorage.clearFilters(BUDGETS_FILTERS_FEATURE, accountId);
    const defaults = this.defaultPersistedFilters();

    this.filters.set(normalizeBudgetFilters({ ...DEFAULT_FILTERS, year: defaults.year, status: defaults.status, sort: defaults.sort }));
    this.selectedPeriod.set({ year: defaults.selectedYear, month: defaults.selectedMonth });

    return defaults;
  }

  clear(): void {
    this.currentAccountId.set(null);
    this.selectedPeriod.set(null);
    this.budgets.set([]);
    this.selectedBudgetDetail.set(null);
    this.budgetSummary.set(null);
    this.filters.set({ ...DEFAULT_FILTERS });
    this.pagination.set({ page: 0, size: 20, totalElements: 0, totalPages: 0 });
    this.error.set(null);
  }

  private refreshSelectedDetail(accountId: number): Observable<BudgetDetailResponseDto> {
    const period = this.selectedPeriod();

    if (period) {
      return this.getBudgetDetail(accountId, period.year, period.month);
    }

    const detail = this.selectedBudgetDetail();

    if (detail) {
      return this.getBudgetDetail(accountId, detail.budget.year, detail.budget.month);
    }

    return throwError(() => new Error('No selected budget detail to refresh.'));
  }

  private ensureAccount(accountId: number): void {
    if (this.currentAccountId() === accountId) {
      return;
    }

    this.currentAccountId.set(accountId);
    this.selectedPeriod.set(null);
    this.budgets.set([]);
    this.selectedBudgetDetail.set(null);
    this.budgetSummary.set(null);
    this.filters.set({ ...DEFAULT_FILTERS });
    this.pagination.set({ page: 0, size: 20, totalElements: 0, totalPages: 0 });
    this.error.set(null);
  }

  private persistFilters(accountId: number): void {
    const period = this.selectedPeriod() ?? this.defaultPeriod();
    const filters = this.filters();

    this.filterStorage.setFilters<BudgetPersistedFilters>(BUDGETS_FILTERS_FEATURE, accountId, {
      selectedYear: period.year,
      selectedMonth: period.month,
      year: filters.year,
      status: filters.status,
      sort: filters.sort
    });
  }

  private defaultPersistedFilters(): BudgetPersistedFilters {
    const period = this.defaultPeriod();

    return {
      selectedYear: period.year,
      selectedMonth: period.month,
      year: period.year,
      status: null,
      sort: 'month,desc'
    };
  }

  private defaultPeriod(): { year: number; month: number } {
    const now = new Date();

    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1
    };
  }

  private handleError(error: unknown): Observable<never> {
    this.error.set(toApiError(error));
    return throwError(() => error);
  }
}

function normalizeBudgetFilters(filters: Partial<BudgetFilters>): BudgetFilters {
  return {
    year: yearOrNull(filters.year),
    status: BUDGET_STATUSES.includes(filters.status ?? null) ? filters.status ?? null : null,
    page: numberOrDefault(filters.page, 0),
    size: numberOrDefault(filters.size, 20),
    sort: typeof filters.sort === 'string' && filters.sort ? filters.sort : 'month,desc'
  };
}

function normalizeBudgetPersistedFilters(
  filters: Partial<BudgetPersistedFilters>,
  fallback: BudgetPersistedFilters
): BudgetPersistedFilters {
  return {
    selectedYear: yearOrNull(filters.selectedYear) ?? fallback.selectedYear,
    selectedMonth: monthOrDefault(filters.selectedMonth, fallback.selectedMonth),
    year: yearOrNull(filters.year),
    status: BUDGET_STATUSES.includes(filters.status ?? null) ? filters.status ?? null : null,
    sort: typeof filters.sort === 'string' && filters.sort ? filters.sort : fallback.sort
  };
}

function yearOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 2000 && numeric <= 2100 ? numeric : null;
}

function monthOrDefault(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 1 && numeric <= 12 ? numeric : fallback;
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
