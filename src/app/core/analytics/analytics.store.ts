import { Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY, Observable, catchError, finalize, forkJoin, of, tap, throwError } from 'rxjs';

import {
  AnalyticsDashboardFilters,
  ApiErrorResponse,
  BudgetVsExpensesByCategoryItemDto,
  BudgetVsExpensesByCategoryResponseDto,
  CashflowGroupBy,
  CashflowResponseDto,
  CashflowSummaryResponseDto,
  CategoryBreakdownResponseDto,
  ExpenseSummaryResponseDto,
  PaymentMethodBreakdownResponseDto
} from '../../shared/models';
import { FeatureFilterStorageService } from '../filters/feature-filter-storage.service';
import { AnalyticsApiService } from './analytics-api.service';

export interface MonthDateRange {
  from: string;
  to: string;
}

export interface AdvancedDashboardResponse {
  cashflowSummary: CashflowSummaryResponseDto;
  expenseSummary: ExpenseSummaryResponseDto;
  cashflowTimeline: CashflowResponseDto;
  expensesByCategory: CategoryBreakdownResponseDto;
  expensesByPaymentMethod: PaymentMethodBreakdownResponseDto;
  incomesByCategory: CategoryBreakdownResponseDto;
  budgetVsExpensesByCategory: BudgetVsExpensesByCategoryResponseDto | null;
}

const ANALYTICS_FILTERS_FEATURE = 'analytics';
const GROUP_BY_OPTIONS: CashflowGroupBy[] = ['DAY', 'WEEK', 'MONTH'];
const EXPENSE_PAYMENT_STATES = [null, 'PENDING', 'PARTIAL', 'PAID'];
const STATUSES = [null, 'ACTIVE', 'CANCELLED'];
const EXPENSE_TYPES = [null, 'SIMPLE', 'INSTALLMENT'];

@Injectable({ providedIn: 'root' })
export class AnalyticsStore {
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly filterStorage = inject(FeatureFilterStorageService);
  private readonly currentAccountId = signal<number | null>(null);
  private readonly activeRequestKey = signal<string | null>(null);
  private readonly today = new Date();

  readonly cashflowSummary = signal<CashflowSummaryResponseDto | null>(null);
  readonly expenseSummary = signal<ExpenseSummaryResponseDto | null>(null);
  readonly cashflowTimeline = signal<CashflowResponseDto | null>(null);
  readonly expensesByCategory = signal<CategoryBreakdownResponseDto | null>(null);
  readonly expensesByPaymentMethod = signal<PaymentMethodBreakdownResponseDto | null>(null);
  readonly incomesByCategory = signal<CategoryBreakdownResponseDto | null>(null);
  readonly budgetVsExpensesByCategory = signal<BudgetVsExpensesByCategoryItemDto[] | null>(null);
  readonly filters = signal<AnalyticsDashboardFilters>(this.defaultFilters());
  readonly loading = signal(false);
  readonly isLoading = this.loading;
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly isEmpty = computed(() => {
    const cashflow = this.cashflowSummary();
    const expenses = this.expenseSummary();
    const timeline = this.cashflowTimeline();
    const hasBreakdowns =
      Boolean(this.expensesByCategory()?.items.length) ||
      Boolean(this.expensesByPaymentMethod()?.items.length) ||
      Boolean(this.incomesByCategory()?.items.length) ||
      Boolean(this.budgetVsExpensesByCategory()?.length);

    if (!cashflow || !expenses || !timeline) {
      return false;
    }

    return (
      cashflow.totalIncome === 0 &&
      cashflow.totalOutflow === 0 &&
      cashflow.netCashflow === 0 &&
      expenses.totalExpensesConceptual === 0 &&
      expenses.expensesCount === 0 &&
      timeline.items.length === 0 &&
      !hasBreakdowns
    );
  });

  applyFilters(
    accountId: number,
    filters: AnalyticsDashboardFilters,
    options: { persist?: boolean } = { persist: true }
  ): Observable<AdvancedDashboardResponse> {
    const normalized = normalizeFilters(filters);

    if (options.persist !== false) {
      this.filterStorage.setFilters(ANALYTICS_FILTERS_FEATURE, accountId, normalized);
    }

    return this.loadDashboard(accountId, normalized);
  }

  loadDashboard(
    accountId: number,
    filters: AnalyticsDashboardFilters = this.filters()
  ): Observable<AdvancedDashboardResponse> {
    this.ensureAccount(accountId);
    const normalized = normalizeFilters(filters);
    const requestKey = JSON.stringify({ accountId, filters: normalized });

    if (this.loading() && this.activeRequestKey() === requestKey) {
      return EMPTY;
    }

    this.filters.set(normalized);
    this.loading.set(true);
    this.activeRequestKey.set(requestKey);
    this.error.set(null);
    const monthlyPeriod = monthPeriodFromRange(normalized.from, normalized.to);

    return forkJoin({
      cashflowSummary: this.analyticsApi.getCashflowSummary(accountId, normalized.from, normalized.to, normalized),
      expenseSummary: this.analyticsApi.getExpenseSummary(accountId, normalized.from, normalized.to, normalized),
      cashflowTimeline: this.analyticsApi.getCashflow(
        accountId,
        normalized.from,
        normalized.to,
        normalized.groupBy,
        normalized
      ),
      expensesByCategory: this.analyticsApi.getExpensesByCategory(accountId, normalized.from, normalized.to, normalized),
      expensesByPaymentMethod: this.analyticsApi.getExpensesByPaymentMethod(accountId, normalized.from, normalized.to, normalized),
      incomesByCategory: this.analyticsApi.getIncomesByCategory(accountId, normalized.from, normalized.to, normalized),
      budgetVsExpensesByCategory: monthlyPeriod
        ? this.analyticsApi.getBudgetVsExpensesByCategory(accountId, monthlyPeriod.year, monthlyPeriod.month)
        : of(null)
    }).pipe(
      tap((response) => this.setDashboard(response)),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => {
        if (this.activeRequestKey() === requestKey) {
          this.loading.set(false);
          this.activeRequestKey.set(null);
        }
      })
    );
  }

  setPeriod(from: string, to: string, groupBy: CashflowGroupBy = this.filters().groupBy): void {
    this.filters.update((filters) => normalizeFilters({ ...filters, from, to, groupBy }));
  }

  loadPersistedFilters(accountId: number): AnalyticsDashboardFilters {
    this.ensureAccount(accountId);
    const saved = this.filterStorage.getFilters<Partial<AnalyticsDashboardFilters>>(ANALYTICS_FILTERS_FEATURE, accountId);
    const filters = saved ? normalizeSavedAnalyticsFilters(saved, this.defaultFilters()) : this.defaultFilters();

    this.filters.set(filters);
    return filters;
  }

  clearPersistedFilters(accountId: number): AnalyticsDashboardFilters {
    this.ensureAccount(accountId);
    this.filterStorage.clearFilters(ANALYTICS_FILTERS_FEATURE, accountId);
    const filters = this.defaultFilters();
    this.filters.set(filters);

    return filters;
  }

  loadCashflowSummary(
    accountId: number,
    filters: AnalyticsDashboardFilters = this.filters()
  ): Observable<CashflowSummaryResponseDto> {
    this.ensureAccount(accountId);
    const normalized = normalizeFilters(filters);
    this.loading.set(true);
    this.error.set(null);

    return this.analyticsApi.getCashflowSummary(accountId, normalized.from, normalized.to, normalized).pipe(
      tap((summary) => this.cashflowSummary.set(summary)),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.loading.set(false))
    );
  }

  loadCategoryBreakdowns(accountId: number, filters: AnalyticsDashboardFilters = this.filters()): Observable<{
    expensesByCategory: CategoryBreakdownResponseDto;
    expensesByPaymentMethod: PaymentMethodBreakdownResponseDto;
    incomesByCategory: CategoryBreakdownResponseDto;
  }> {
    this.ensureAccount(accountId);
    const normalized = normalizeFilters(filters);
    this.loading.set(true);
    this.error.set(null);

    return forkJoin({
      expensesByCategory: this.analyticsApi.getExpensesByCategory(accountId, normalized.from, normalized.to, normalized),
      expensesByPaymentMethod: this.analyticsApi.getExpensesByPaymentMethod(accountId, normalized.from, normalized.to, normalized),
      incomesByCategory: this.analyticsApi.getIncomesByCategory(accountId, normalized.from, normalized.to, normalized)
    }).pipe(
      tap((response) => {
        this.expensesByCategory.set(response.expensesByCategory);
        this.expensesByPaymentMethod.set(response.expensesByPaymentMethod);
        this.incomesByCategory.set(response.incomesByCategory);
      }),
      catchError((error: unknown) => this.handleError(error)),
      finalize(() => this.loading.set(false))
    );
  }

  clear(): void {
    this.currentAccountId.set(null);
    this.clearDashboard();
  }

  private ensureAccount(accountId: number): void {
    if (this.currentAccountId() === accountId) {
      return;
    }

    this.clearDashboard();
    this.currentAccountId.set(accountId);
  }

  private setDashboard(response: AdvancedDashboardResponse): void {
    this.cashflowSummary.set(response.cashflowSummary);
    this.expenseSummary.set(response.expenseSummary);
    this.cashflowTimeline.set(response.cashflowTimeline);
    this.expensesByCategory.set(response.expensesByCategory);
    this.expensesByPaymentMethod.set(response.expensesByPaymentMethod);
    this.incomesByCategory.set(response.incomesByCategory);
    this.budgetVsExpensesByCategory.set(response.budgetVsExpensesByCategory?.items ?? null);
  }

  private clearDashboard(): void {
    this.cashflowSummary.set(null);
    this.expenseSummary.set(null);
    this.cashflowTimeline.set(null);
    this.expensesByCategory.set(null);
    this.expensesByPaymentMethod.set(null);
    this.incomesByCategory.set(null);
    this.budgetVsExpensesByCategory.set(null);
    this.loading.set(false);
    this.activeRequestKey.set(null);
    this.error.set(null);
  }

  private defaultFilters(): AnalyticsDashboardFilters {
    return {
      ...monthDateRange(this.today.getFullYear(), this.today.getMonth() + 1),
      groupBy: 'MONTH'
    };
  }

  private handleError(error: unknown): Observable<never> {
    this.error.set(toApiError(error));
    return throwError(() => error);
  }
}

export function monthDateRange(year: number, month: number): MonthDateRange {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0));

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10)
  };
}

export function monthPeriodFromRange(fromValue: string, toValue: string): { year: number; month: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromValue) || !/^\d{4}-\d{2}-\d{2}$/.test(toValue)) {
    return null;
  }

  const [fromYear, fromMonth, fromDay] = fromValue.split('-').map(Number);
  const [toYear, toMonth, toDay] = toValue.split('-').map(Number);

  if (fromYear !== toYear || fromMonth !== toMonth || fromDay !== 1) {
    return null;
  }

  const lastDay = new Date(Date.UTC(fromYear, fromMonth, 0)).getUTCDate();

  return toDay === lastDay ? { year: fromYear, month: fromMonth } : null;
}

export function normalizeFilters(filters: AnalyticsDashboardFilters): AnalyticsDashboardFilters {
  return {
    from: filters.from,
    to: filters.to,
    participantId: numberOrNull(filters.participantId),
    expenseCategoryId: numberOrNull(filters.expenseCategoryId),
    incomeCategoryId: numberOrNull(filters.incomeCategoryId),
    paymentMethodId: numberOrNull(filters.paymentMethodId),
    expenseStatus: filters.expenseStatus || null,
    expensePaymentState: filters.expensePaymentState || null,
    incomeStatus: filters.incomeStatus || null,
    expenseType: filters.expenseType || null,
    groupBy: filters.groupBy || 'MONTH'
  };
}

function normalizeSavedAnalyticsFilters(
  filters: Partial<AnalyticsDashboardFilters>,
  fallback: AnalyticsDashboardFilters
): AnalyticsDashboardFilters {
  const from = typeof filters.from === 'string' && filters.from ? filters.from : fallback.from;
  const to = typeof filters.to === 'string' && filters.to ? filters.to : fallback.to;
  const groupBy = GROUP_BY_OPTIONS.includes(filters.groupBy as CashflowGroupBy) ? (filters.groupBy as CashflowGroupBy) : fallback.groupBy;

  return normalizeFilters({
    from,
    to,
    participantId: filters.participantId,
    expenseCategoryId: filters.expenseCategoryId,
    incomeCategoryId: filters.incomeCategoryId,
    paymentMethodId: filters.paymentMethodId,
    expenseStatus: STATUSES.includes(filters.expenseStatus ?? null) ? filters.expenseStatus ?? null : null,
    expensePaymentState: EXPENSE_PAYMENT_STATES.includes(filters.expensePaymentState ?? null)
      ? filters.expensePaymentState ?? null
      : null,
    incomeStatus: STATUSES.includes(filters.incomeStatus ?? null) ? filters.incomeStatus ?? null : null,
    expenseType: EXPENSE_TYPES.includes(filters.expenseType ?? null) ? filters.expenseType ?? null : null,
    groupBy
  });
}

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
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
      message: 'No fue posible cargar el dashboard.',
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
    message: 'No fue posible cargar el dashboard.',
    path: '',
    correlationId: null,
    details: []
  };
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return Boolean(value && typeof value === 'object' && 'code' in value && 'message' in value);
}
