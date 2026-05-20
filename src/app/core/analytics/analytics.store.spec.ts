import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  AnalyticsDashboardFilters,
  BudgetVsExpensesByCategoryItemDto,
  CashflowResponseDto,
  CashflowSummaryResponseDto,
  CategoryBreakdownResponseDto,
  ExpenseSummaryResponseDto,
  PaymentMethodBreakdownResponseDto
} from '../../shared/models';
import { AnalyticsApiService } from './analytics-api.service';
import { AnalyticsStore, monthDateRange, monthPeriodFromRange } from './analytics.store';

describe('AnalyticsStore', () => {
  const filters: AnalyticsDashboardFilters = {
    from: '2026-05-01',
    to: '2026-05-31',
    participantId: 9,
    expenseCategoryId: 2,
    incomeCategoryId: 3,
    paymentMethodId: 4,
    expenseStatus: 'ACTIVE',
    expensePaymentState: 'PAID',
    incomeStatus: 'ACTIVE',
    expenseType: 'SIMPLE',
    groupBy: 'WEEK'
  };
  const cashflowSummary: CashflowSummaryResponseDto = {
    accountId: 1,
    from: '2026-05-01',
    to: '2026-05-31',
    totalIncome: 3000000,
    totalSimpleExpenseOutflow: 500000,
    totalDebtPaymentOutflow: 200000,
    totalOutflow: 700000,
    netCashflow: 2300000,
    generatedAt: '2026-05-14T00:00:00Z'
  };
  const expenseSummary: ExpenseSummaryResponseDto = {
    accountId: 1,
    from: '2026-05-01',
    to: '2026-05-31',
    totalSimpleExpenses: 500000,
    totalInstallmentPurchases: 1200000,
    totalExpensesConceptual: 1700000,
    expensesCount: 3,
    generatedAt: '2026-05-14T00:00:00Z'
  };
  const cashflowTimeline: CashflowResponseDto = {
    accountId: 1,
    from: '2026-05-01',
    to: '2026-05-31',
    groupBy: 'WEEK',
    items: [
      {
        period: '2026-W18',
        totalIncome: 1000000,
        simpleExpenseOutflow: 100000,
        debtPaymentOutflow: 50000,
        totalOutflow: 150000,
        netCashflow: 850000
      }
    ]
  };
  const expensesByCategory: CategoryBreakdownResponseDto = {
    accountId: 1,
    from: '2026-05-01',
    to: '2026-05-31',
    items: [{ categoryId: 1, categoryName: 'Food', amount: 500000, count: 2 }]
  };
  const expensesByPaymentMethod: PaymentMethodBreakdownResponseDto = {
    accountId: 1,
    from: '2026-05-01',
    to: '2026-05-31',
    items: [{ paymentMethodId: 1, paymentMethodName: 'Cash', amount: 500000, count: 2 }]
  };
  const incomesByCategory: CategoryBreakdownResponseDto = {
    accountId: 1,
    from: '2026-05-01',
    to: '2026-05-31',
    items: [{ categoryId: 3, categoryName: 'Salary', amount: 3000000, count: 1 }]
  };
  const budgetVsExpensesByCategory: BudgetVsExpensesByCategoryItemDto[] = [
    {
      categoryId: 1,
      categoryName: 'Food',
      budgetedAmount: 800000,
      spentAmount: 500000,
      remainingAmount: 300000,
      executionPercentage: 62.5
    }
  ];
  const budgetVsExpensesByCategoryResponse = {
    accountId: 1,
    year: 2026,
    month: 5,
    from: '2026-05-01',
    to: '2026-05-31',
    items: budgetVsExpensesByCategory
  };

  let service: jasmine.SpyObj<AnalyticsApiService>;
  let store: AnalyticsStore;

  beforeEach(() => {
    localStorage.clear();
    service = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', [
      'getCashflowSummary',
      'getExpenseSummary',
      'getCashflow',
      'getExpensesByCategory',
      'getExpensesByPaymentMethod',
      'getIncomesByCategory',
      'getBudgetVsExpensesByCategory'
    ]);
    service.getCashflowSummary.and.returnValue(of(cashflowSummary));
    service.getExpenseSummary.and.returnValue(of(expenseSummary));
    service.getCashflow.and.returnValue(of(cashflowTimeline));
    service.getExpensesByCategory.and.returnValue(of(expensesByCategory));
    service.getExpensesByPaymentMethod.and.returnValue(of(expensesByPaymentMethod));
    service.getIncomesByCategory.and.returnValue(of(incomesByCategory));
    service.getBudgetVsExpensesByCategory.and.returnValue(of(budgetVsExpensesByCategoryResponse));

    TestBed.configureTestingModule({
      providers: [AnalyticsStore, { provide: AnalyticsApiService, useValue: service }]
    });

    store = TestBed.inject(AnalyticsStore);
  });

  afterEach(() => localStorage.clear());

  it('loads dashboard data with centralized filters', (done) => {
    store.loadDashboard(1, filters).subscribe(() => {
      expect(store.cashflowSummary()).toEqual(cashflowSummary);
      expect(store.expenseSummary()).toEqual(expenseSummary);
      expect(store.cashflowTimeline()).toEqual(cashflowTimeline);
      expect(store.expensesByCategory()).toEqual(expensesByCategory);
      expect(store.expensesByPaymentMethod()).toEqual(expensesByPaymentMethod);
      expect(store.incomesByCategory()).toEqual(incomesByCategory);
      expect(store.budgetVsExpensesByCategory()).toEqual(budgetVsExpensesByCategory);
      expect(service.getCashflow).toHaveBeenCalledWith(1, '2026-05-01', '2026-05-31', 'WEEK', store.filters());
      expect(service.getBudgetVsExpensesByCategory).toHaveBeenCalledWith(1, 2026, 5);
      done();
    });
  });

  it('does not load budget comparison for non-monthly ranges', (done) => {
    store.loadDashboard(1, { ...filters, from: '2026-05-10', to: '2026-05-31' }).subscribe(() => {
      expect(service.getBudgetVsExpensesByCategory).not.toHaveBeenCalled();
      expect(store.budgetVsExpensesByCategory()).toBeNull();
      done();
    });
  });

  it('persists filters when applying dashboard filters', (done) => {
    store.applyFilters(1, filters).subscribe(() => {
      expect(JSON.parse(localStorage.getItem('easyFinance.filters.analytics.1') ?? '{}')).toEqual(jasmine.objectContaining({
        from: '2026-05-01',
        to: '2026-05-31',
        groupBy: 'WEEK',
        expensePaymentState: 'PAID'
      }));
      done();
    });
  });

  it('loads persisted analytics filters per account', () => {
    localStorage.setItem('easyFinance.filters.analytics.1', JSON.stringify(filters));
    localStorage.setItem(
      'easyFinance.filters.analytics.2',
      JSON.stringify({ from: '2026-06-01', to: '2026-06-30', groupBy: 'DAY' })
    );

    expect(store.loadPersistedFilters(1)).toEqual(jasmine.objectContaining({ from: '2026-05-01', groupBy: 'WEEK' }));
    expect(store.loadPersistedFilters(2)).toEqual(jasmine.objectContaining({ from: '2026-06-01', groupBy: 'DAY' }));
  });

  it('clears persisted analytics filters and returns defaults', () => {
    localStorage.setItem('easyFinance.filters.analytics.1', JSON.stringify(filters));

    const defaults = store.clearPersistedFilters(1);

    expect(localStorage.getItem('easyFinance.filters.analytics.1')).toBeNull();
    expect(defaults.groupBy).toBe('MONTH');
    expect(store.filters()).toEqual(defaults);
  });

  it('clears dashboard data when account changes', (done) => {
    store.loadDashboard(1, filters).subscribe(() => {
      service.getCashflowSummary.and.returnValue(of({ ...cashflowSummary, accountId: 2 }));

      store.loadDashboard(2, filters).subscribe(() => {
        expect(store.cashflowSummary()?.accountId).toBe(2);
        expect(store.error()).toBeNull();
        done();
      });
    });
  });

  it('calculates first and last day for selected month', () => {
    expect(monthDateRange(2026, 2)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthDateRange(2028, 2)).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthPeriodFromRange('2026-05-01', '2026-05-31')).toEqual({ year: 2026, month: 5 });
    expect(monthPeriodFromRange('2026-05-02', '2026-05-31')).toBeNull();
  });
});
