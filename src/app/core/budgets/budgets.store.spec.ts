import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BudgetDetailResponseDto, BudgetResponseDto, BudgetSummaryResponseDto, SubBudgetResponseDto } from '../../shared/models';
import { AnalyticsApiService } from '../analytics/analytics-api.service';
import { BudgetsApiService } from './budgets-api.service';
import { BudgetsStore } from './budgets.store';

describe('BudgetsStore', () => {
  const budget: BudgetResponseDto = {
    id: 1,
    accountId: 10,
    year: 2026,
    month: 5,
    name: 'Mayo',
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: ''
  };
  const subBudget: SubBudgetResponseDto = {
    id: 2,
    accountId: 10,
    budgetId: 1,
    categoryId: 3,
    debtId: null,
    name: 'Mercado',
    plannedAmount: 500000,
    plannedCurrency: 'COP',
    spentAmount: 125000,
    spentCurrency: 'COP',
    status: 'ACTIVE',
    sourceType: 'MANUAL',
    createdAt: '',
    updatedAt: ''
  };
  const detail: BudgetDetailResponseDto = {
    budget,
    subBudgets: [subBudget],
    impacts: []
  };
  const summary: BudgetSummaryResponseDto = {
    accountId: 10,
    year: 2026,
    month: 5,
    budgetId: 1,
    expectedAmount: 500000,
    paidAmount: 125000,
    pendingAmount: 375000,
    impactsCount: 0,
    paidImpactsCount: 0,
    activeImpactsCount: 0,
    subBudgetsCount: 1
  };

  let service: jasmine.SpyObj<BudgetsApiService>;
  let analyticsApi: jasmine.SpyObj<AnalyticsApiService>;
  let store: BudgetsStore;

  beforeEach(() => {
    localStorage.clear();
    service = jasmine.createSpyObj<BudgetsApiService>('BudgetsApiService', [
      'listBudgets',
      'upsertBudget',
      'duplicateBudget',
      'getBudgetDetail',
      'createSubBudget',
      'updateSubBudget',
      'deactivateSubBudget'
    ]);
    service.listBudgets.and.returnValue(of({ content: [budget], page: 0, size: 20, totalElements: 1, totalPages: 1 }));
    service.upsertBudget.and.returnValue(of(budget));
    service.duplicateBudget.and.returnValue(of(detail));
    service.getBudgetDetail.and.returnValue(of(detail));
    service.createSubBudget.and.returnValue(of(subBudget));
    service.updateSubBudget.and.returnValue(of(subBudget));
    service.deactivateSubBudget.and.returnValue(of(undefined));
    analyticsApi = jasmine.createSpyObj<AnalyticsApiService>('AnalyticsApiService', ['getBudgetSummary']);
    analyticsApi.getBudgetSummary.and.returnValue(of(summary));

    TestBed.configureTestingModule({
      providers: [
        BudgetsStore,
        { provide: BudgetsApiService, useValue: service },
        { provide: AnalyticsApiService, useValue: analyticsApi }
      ]
    });

    store = TestBed.inject(BudgetsStore);
  });

  afterEach(() => localStorage.clear());

  it('loads budgets and clears stale data when account changes', (done) => {
    store.getBudgetDetail(10, 2026, 5).subscribe(() => {
      expect(store.selectedBudgetDetail()).toEqual(detail);
      service.listBudgets.and.returnValue(of({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));

      store.loadBudgets(11).subscribe(() => {
        expect(store.budgets()).toEqual([]);
        expect(store.selectedBudgetDetail()).toBeNull();
        done();
      });
    });
  });

  it('loads selected budget detail', (done) => {
    store.getBudgetDetail(10, 2026, 5).subscribe(() => {
      expect(service.getBudgetDetail).toHaveBeenCalledWith(10, 2026, 5);
      expect(store.selectedBudgetDetail()).toEqual(detail);
      expect(analyticsApi.getBudgetSummary).toHaveBeenCalledWith(10, 2026, 5);
      expect(store.budgetSummary()).toEqual(summary);
      done();
    });
  });

  it('upserts a budget and refreshes list and detail', (done) => {
    store.upsertBudget(10, 2026, 5, { name: 'Mayo', status: 'ACTIVE' }).subscribe(() => {
      expect(service.upsertBudget).toHaveBeenCalledWith(10, 2026, 5, { name: 'Mayo', status: 'ACTIVE' });
      expect(service.listBudgets).toHaveBeenCalledWith(10, jasmine.objectContaining({ year: 2026 }));
      expect(service.getBudgetDetail).toHaveBeenCalledWith(10, 2026, 5);
      done();
    });
  });

  it('duplicates a budget and refreshes target year list and detail', (done) => {
    store.duplicateBudget(10, 2026, 5, { targetYear: 2026, targetMonth: 6, name: 'Junio' }).subscribe(() => {
      expect(service.duplicateBudget).toHaveBeenCalledWith(10, 2026, 5, {
        targetYear: 2026,
        targetMonth: 6,
        name: 'Junio'
      });
      expect(service.listBudgets).toHaveBeenCalledWith(10, jasmine.objectContaining({ year: 2026 }));
      expect(service.getBudgetDetail).toHaveBeenCalledWith(10, 2026, 6);
      done();
    });
  });

  it('refreshes detail after sub budget changes', (done) => {
    store.getBudgetDetail(10, 2026, 5).subscribe(() => {
      service.getBudgetDetail.calls.reset();

      store.createSubBudget(10, 1, { categoryId: 3, name: 'Mercado', plannedAmount: 500000 }).subscribe(() => {
        expect(service.createSubBudget).toHaveBeenCalledWith(10, 1, {
          categoryId: 3,
          name: 'Mercado',
          plannedAmount: 500000
        });
        expect(service.getBudgetDetail).toHaveBeenCalledWith(10, 2026, 5);
        done();
      });
    });
  });

  it('loads persisted period and list filters per account', () => {
    localStorage.setItem(
      'easyFinance.filters.budgets.10',
      JSON.stringify({ selectedYear: 2026, selectedMonth: 6, year: 2026, status: 'ACTIVE', sort: 'year,asc' })
    );
    localStorage.setItem(
      'easyFinance.filters.budgets.11',
      JSON.stringify({ selectedYear: 2027, selectedMonth: 1, year: 2027, status: 'CLOSED' })
    );

    expect(store.loadPersistedFilters(10)).toEqual({
      selectedYear: 2026,
      selectedMonth: 6,
      year: 2026,
      status: 'ACTIVE',
      sort: 'year,asc'
    });
    expect(store.loadPersistedFilters(11)).toEqual(jasmine.objectContaining({ selectedYear: 2027, selectedMonth: 1 }));
  });

  it('updates period sort while preserving existing list filters', (done) => {
    store.loadBudgets(10, { year: 2026, status: 'ACTIVE', page: 2 }).subscribe(() => {
      service.listBudgets.calls.reset();

      store.loadBudgets(10, { sort: 'month,asc', page: 0 }, { persist: true }).subscribe(() => {
        expect(service.listBudgets).toHaveBeenCalledWith(
          10,
          jasmine.objectContaining({ year: 2026, status: 'ACTIVE', page: 0, sort: 'month,asc' })
        );
        expect(JSON.parse(localStorage.getItem('easyFinance.filters.budgets.10') ?? '{}')).toEqual(
          jasmine.objectContaining({ year: 2026, status: 'ACTIVE', sort: 'month,asc' })
        );
        done();
      });
    });
  });

  it('persists selected period and clears back to defaults', (done) => {
    store.getBudgetDetail(10, 2026, 5, { persist: true }).subscribe(() => {
      expect(JSON.parse(localStorage.getItem('easyFinance.filters.budgets.10') ?? '{}')).toEqual(jasmine.objectContaining({
        selectedYear: 2026,
        selectedMonth: 5
      }));

      const defaults = store.clearPersistedFilters(10);

      expect(localStorage.getItem('easyFinance.filters.budgets.10')).toBeNull();
      expect(defaults.selectedMonth).toBeGreaterThanOrEqual(1);
      expect(store.filters().status).toBeNull();
      done();
    });
  });
});
