import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AnalyticsDashboardFilters,
  BudgetSummaryResponseDto,
  BudgetVsExpensesByCategoryResponseDto,
  CashflowGroupBy,
  CashflowResponseDto,
  CashflowSummaryResponseDto,
  CategoryBreakdownResponseDto,
  DebtSummaryResponseDto,
  ExpenseSummaryResponseDto,
  MonthlySummaryResponseDto,
  PaymentMethodBreakdownResponseDto
} from '../../shared/models';
import { ApiClient } from '../http/api-client';

type QueryParams = Record<string, string | number | boolean | null | undefined>;

@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
  private readonly api = inject(ApiClient);

  getMonthlySummary(accountId: number, year: number, month: number): Observable<MonthlySummaryResponseDto> {
    return this.api.get<MonthlySummaryResponseDto>(`/accounts/${accountId}/analytics/monthly-summary`, { year, month });
  }

  getCashflowSummary(
    accountId: number,
    from: string,
    to: string,
    filters: Partial<AnalyticsDashboardFilters> = {}
  ): Observable<CashflowSummaryResponseDto> {
    return this.api.get<CashflowSummaryResponseDto>(`/accounts/${accountId}/analytics/cashflow-summary`, {
      from,
      to,
      participantId: filters.participantId,
      categoryId: singleCategoryFilter(filters),
      paymentMethodId: filters.paymentMethodId
    });
  }

  getExpenseSummary(
    accountId: number,
    from: string,
    to: string,
    filters: Partial<AnalyticsDashboardFilters> = {}
  ): Observable<ExpenseSummaryResponseDto> {
    return this.api.get<ExpenseSummaryResponseDto>(`/accounts/${accountId}/analytics/expense-summary`, {
      from,
      to,
      ...expenseQuery(filters)
    });
  }

  getCashflow(
    accountId: number,
    from: string,
    to: string,
    groupBy: CashflowGroupBy,
    filters: Partial<AnalyticsDashboardFilters> = {}
  ): Observable<CashflowResponseDto> {
    return this.api.get<CashflowResponseDto>(`/accounts/${accountId}/analytics/cashflow`, {
      from,
      to,
      groupBy,
      participantId: filters.participantId
    });
  }

  getExpensesByCategory(
    accountId: number,
    from: string,
    to: string,
    filters: Partial<AnalyticsDashboardFilters> = {}
  ): Observable<CategoryBreakdownResponseDto> {
    return this.api.get<CategoryBreakdownResponseDto>(`/accounts/${accountId}/analytics/expenses-by-category`, {
      from,
      to,
      ...expenseQuery(filters)
    });
  }

  getExpensesByPaymentMethod(
    accountId: number,
    from: string,
    to: string,
    filters: Partial<AnalyticsDashboardFilters> = {}
  ): Observable<PaymentMethodBreakdownResponseDto> {
    return this.api.get<PaymentMethodBreakdownResponseDto>(`/accounts/${accountId}/analytics/expenses-by-payment-method`, {
      from,
      to,
      ...expenseQuery(filters)
    });
  }

  getIncomesByCategory(
    accountId: number,
    from: string,
    to: string,
    filters: Partial<AnalyticsDashboardFilters> = {}
  ): Observable<CategoryBreakdownResponseDto> {
    return this.api.get<CategoryBreakdownResponseDto>(`/accounts/${accountId}/analytics/incomes-by-category`, {
      from,
      to,
      categoryId: filters.incomeCategoryId,
      participantId: filters.participantId,
      status: filters.incomeStatus
    });
  }

  getDebtSummary(accountId: number): Observable<DebtSummaryResponseDto> {
    return this.api.get<DebtSummaryResponseDto>(`/accounts/${accountId}/analytics/debt-summary`);
  }

  getBudgetSummary(accountId: number, year: number, month: number): Observable<BudgetSummaryResponseDto> {
    return this.api.get<BudgetSummaryResponseDto>(`/accounts/${accountId}/analytics/budget-summary`, { year, month });
  }

  getBudgetVsExpensesByCategory(
    accountId: number,
    year: number,
    month: number
  ): Observable<BudgetVsExpensesByCategoryResponseDto> {
    return this.api.get<BudgetVsExpensesByCategoryResponseDto>(
      `/accounts/${accountId}/analytics/budget-vs-expenses-by-category`,
      { year, month }
    );
  }
}

function expenseQuery(filters: Partial<AnalyticsDashboardFilters>): QueryParams {
  return {
    categoryId: filters.expenseCategoryId,
    paymentMethodId: filters.paymentMethodId,
    participantId: filters.participantId,
    status: filters.expenseStatus,
    paymentState: filters.expensePaymentState,
    expenseType: filters.expenseType
  };
}

function singleCategoryFilter(filters: Partial<AnalyticsDashboardFilters>): number | null | undefined {
  if (filters.expenseCategoryId && filters.incomeCategoryId) {
    return undefined;
  }

  return filters.expenseCategoryId ?? filters.incomeCategoryId;
}
