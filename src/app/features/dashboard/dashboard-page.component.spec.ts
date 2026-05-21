import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AnalyticsStore } from '../../core/analytics/analytics.store';
import { AccountStore } from '../../core/state/account.store';
import {
  ApiErrorResponse,
  BudgetVsExpensesByCategoryItemDto,
  CashflowResponseDto,
  CashflowSummaryResponseDto,
  CategoryBreakdownResponseDto,
  ExpenseSummaryResponseDto,
  PaymentMethodBreakdownResponseDto
} from '../../shared/models';
import { DashboardPageComponent } from './dashboard-page.component';

describe('DashboardPageComponent', () => {
  const cashflowSummary: CashflowSummaryResponseDto = {
    accountId: 1,
    from: '2026-05-01',
    to: '2026-05-31',
    totalIncome: 3000000,
    totalSimpleExpenseOutflow: 600000,
    totalDebtPaymentOutflow: 200000,
    totalOutflow: 800000,
    netCashflow: 2200000,
    generatedAt: '2026-05-14T00:00:00Z'
  };
  const expenseSummary: ExpenseSummaryResponseDto = {
    accountId: 1,
    from: '2026-05-01',
    to: '2026-05-31',
    totalSimpleExpenses: 600000,
    totalInstallmentPurchases: 1200000,
    totalExpensesConceptual: 1800000,
    expensesCount: 4,
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
        totalIncome: 2000000,
        simpleExpenseOutflow: 300000,
        debtPaymentOutflow: 100000,
        totalOutflow: 400000,
        netCashflow: 1600000
      }
    ]
  };
  const expensesByCategory: CategoryBreakdownResponseDto = {
    accountId: 1,
    from: '2026-05-01',
    to: '2026-05-31',
    items: [
      { categoryId: 1, categoryName: 'Food', amount: 800000, count: 3 },
      { categoryId: 2, categoryName: 'Transport', amount: 400000, count: 2 }
    ]
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
      spentAmount: 650000,
      remainingAmount: 150000,
      executionPercentage: 81.25
    },
    {
      categoryId: 4,
      categoryName: 'Unexpected',
      budgetedAmount: 0,
      spentAmount: 120000,
      remainingAmount: -120000,
      executionPercentage: null
    }
  ];

  function configure(
    options: {
      cashflowSummary?: CashflowSummaryResponseDto | null;
      expenseSummary?: ExpenseSummaryResponseDto | null;
      cashflowTimeline?: CashflowResponseDto | null;
      expensesByCategory?: CategoryBreakdownResponseDto | null;
      expensesByPaymentMethod?: PaymentMethodBreakdownResponseDto | null;
      incomesByCategory?: CategoryBreakdownResponseDto | null;
      budgetVsExpensesByCategory?: BudgetVsExpensesByCategoryItemDto[] | null;
      error?: ApiErrorResponse | null;
      empty?: boolean;
      archived?: boolean;
      persistedFilters?: unknown;
    } = {}
  ): ComponentFixture<DashboardPageComponent> {
    const defaultFilters = { from: '2026-05-01', to: '2026-05-31', groupBy: 'WEEK' };

    TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [
        {
          provide: AccountStore,
          useValue: {
            selectedAccountId: signal(1),
            selectedAccountArchived: signal(options.archived ?? false)
          }
        },
        {
          provide: AnalyticsStore,
          useValue: {
            cashflowSummary: signal(
              Object.prototype.hasOwnProperty.call(options, 'cashflowSummary') ? options.cashflowSummary ?? null : cashflowSummary
            ),
            expenseSummary: signal(
              Object.prototype.hasOwnProperty.call(options, 'expenseSummary') ? options.expenseSummary ?? null : expenseSummary
            ),
            cashflowTimeline: signal(
              Object.prototype.hasOwnProperty.call(options, 'cashflowTimeline') ? options.cashflowTimeline ?? null : cashflowTimeline
            ),
            expensesByCategory: signal(
              Object.prototype.hasOwnProperty.call(options, 'expensesByCategory')
                ? options.expensesByCategory ?? null
                : expensesByCategory
            ),
            expensesByPaymentMethod: signal(
              Object.prototype.hasOwnProperty.call(options, 'expensesByPaymentMethod')
                ? options.expensesByPaymentMethod ?? null
                : expensesByPaymentMethod
            ),
            incomesByCategory: signal(
              Object.prototype.hasOwnProperty.call(options, 'incomesByCategory')
                ? options.incomesByCategory ?? null
                : incomesByCategory
            ),
            budgetVsExpensesByCategory: signal(
              Object.prototype.hasOwnProperty.call(options, 'budgetVsExpensesByCategory')
                ? options.budgetVsExpensesByCategory ?? null
                : budgetVsExpensesByCategory
            ),
            filters: signal(defaultFilters),
            loading: signal(false),
            error: signal(options.error ?? null),
            isEmpty: signal(options.empty ?? false),
            loadPersistedFilters: jasmine.createSpy('loadPersistedFilters').and.returnValue(options.persistedFilters ?? defaultFilters),
            clearPersistedFilters: jasmine.createSpy('clearPersistedFilters').and.returnValue(defaultFilters),
            applyFilters: jasmine.createSpy('applyFilters').and.returnValue(of({}))
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  function clickTab(fixture: ComponentFixture<DashboardPageComponent>, label: string): void {
    const button = Array.from(fixture.nativeElement.querySelectorAll('.dashboard-tabs button')).find((item) =>
      (item as HTMLElement).textContent?.includes(label)
    ) as HTMLButtonElement;

    button.click();
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('renders local tabs and shows summary by default', () => {
    const fixture = configure();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Resumen');
    expect(text).toContain('Cashflow');
    expect(text).toContain('Gastos');
    expect(text).toContain('Presupuesto');
    expect(fixture.nativeElement.querySelector('.dashboard-tabs button.active')?.textContent).toContain('Resumen');
    expect(text).toContain('Aplicar mes');
    expect(text).toContain('Marzo');
    expect(text).toContain('Desde');
    expect(text).toContain('Hasta');
    expect(text).toContain('Cashflow real');
    expect(text).toContain('Ingresos reales');
    expect(text).toContain('Gastos reales pagados');
    expect(text).toContain('Pagos deuda');
    expect(text).toContain('Compras cuotas');
    expect(text).toContain('Total conceptual');
  });

  it('validates invalid date ranges locally', () => {
    const fixture = configure();
    const store = TestBed.inject(AnalyticsStore) as jasmine.SpyObj<AnalyticsStore>;

    fixture.componentInstance.filtersForm.patchValue({ from: '2026-06-01', to: '2026-05-01' });
    fixture.componentInstance.loadDashboard();

    expect(fixture.componentInstance.localError()).toContain('fecha inicial');
    expect(store.applyFilters).toHaveBeenCalledTimes(1);
  });

  it('validates maximum 24 month range', () => {
    const fixture = configure();

    fixture.componentInstance.filtersForm.patchValue({ from: '2024-01-01', to: '2026-02-01' });
    fixture.componentInstance.loadDashboard();

    expect(fixture.componentInstance.localError()).toContain('24 meses');
  });

  it('applies quick presets', () => {
    const fixture = configure();

    fixture.componentInstance.applyPreset('THIS_YEAR', false);

    const raw = fixture.componentInstance.filtersForm.getRawValue();
    const currentYear = new Date().getFullYear();
    expect(raw.from).toBe(`${currentYear}-01-01`);
    expect(raw.to).toBe(`${currentYear}-12-31`);
  });

  it('applies a specific month range', () => {
    const fixture = configure();
    const store = TestBed.inject(AnalyticsStore) as jasmine.SpyObj<AnalyticsStore>;
    store.applyFilters.calls.reset();

    fixture.componentInstance.filtersForm.patchValue({ specificYear: '2026', specificMonth: '3' });
    fixture.componentInstance.applySpecificMonth();

    expect(fixture.componentInstance.filtersForm.getRawValue()).toEqual(jasmine.objectContaining({
      from: '2026-03-01',
      to: '2026-03-31',
      specificYear: '2026',
      specificMonth: '3'
    }));
    expect(store.applyFilters).toHaveBeenCalledWith(1, jasmine.objectContaining({
      from: '2026-03-01',
      to: '2026-03-31'
    }));
  });

  it('calculates leap year February for a specific month', () => {
    const fixture = configure();

    fixture.componentInstance.filtersForm.patchValue({ specificYear: '2024', specificMonth: '2' });
    fixture.componentInstance.applySpecificMonth();

    expect(fixture.componentInstance.filtersForm.getRawValue()).toEqual(jasmine.objectContaining({
      from: '2024-02-01',
      to: '2024-02-29'
    }));
  });

  it('syncs the specific month selector when from and to are an exact month', () => {
    const fixture = configure();

    fixture.componentInstance.filtersForm.patchValue({ from: '2026-07-01', to: '2026-07-31' });
    fixture.componentInstance.syncSpecificMonthFromRange();

    expect(fixture.componentInstance.filtersForm.getRawValue()).toEqual(jasmine.objectContaining({
      specificYear: '2026',
      specificMonth: '7'
    }));
  });

  it('clears the specific month selector when from and to are not an exact month', () => {
    const fixture = configure();

    fixture.componentInstance.filtersForm.patchValue({ from: '2026-07-02', to: '2026-07-31' });
    fixture.componentInstance.syncSpecificMonthFromRange();

    expect(fixture.componentInstance.filtersForm.getRawValue()).toEqual(jasmine.objectContaining({
      specificYear: '',
      specificMonth: ''
    }));
  });

  it('marks the matching quick preset as active', () => {
    const fixture = configure();
    const currentYear = new Date().getFullYear();

    fixture.componentInstance.applyPreset('THIS_YEAR', false);
    fixture.detectChanges();

    const activeButton = fixture.nativeElement.querySelector('.quick-preset-button.active');
    expect(activeButton?.textContent).toContain('Este anio');
    expect(activeButton?.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.componentInstance.filtersForm.getRawValue()).toEqual(jasmine.objectContaining({
      from: `${currentYear}-01-01`,
      to: `${currentYear}-12-31`
    }));
  });

  it('does not mark quick presets active when manual dates do not match', () => {
    const fixture = configure();

    fixture.componentInstance.filtersForm.patchValue({ from: '2026-02-03', to: '2026-04-05' });
    fixture.detectChanges();

    expect(fixture.componentInstance.activePreset()).toBeNull();
    expect(fixture.nativeElement.querySelector('.quick-preset-button.active')).toBeNull();
  });

  it('loads persisted filters on init', () => {
    const fixture = configure({
      persistedFilters: {
        from: '2026-04-01',
        to: '2026-04-30',
        participantId: 7,
        expenseCategoryId: 2,
        incomeCategoryId: 3,
        paymentMethodId: 4,
        expenseStatus: 'ACTIVE',
        expensePaymentState: 'PAID',
        incomeStatus: 'CANCELLED',
        expenseType: 'SIMPLE',
        groupBy: 'DAY'
      }
    });
    const raw = fixture.componentInstance.filtersForm.getRawValue();

    expect(raw.from).toBe('2026-04-01');
    expect(raw.to).toBe('2026-04-30');
    expect(raw.participantId).toBe('7');
    expect(raw.expenseCategoryId).toBe('2');
    expect(raw.incomeCategoryId).toBe('3');
    expect(raw.paymentMethodId).toBe('4');
    expect(raw.expenseStatus).toBe('ACTIVE');
    expect(raw.expensePaymentState).toBe('PAID');
    expect(raw.incomeStatus).toBe('CANCELLED');
    expect(raw.expenseType).toBe('SIMPLE');
    expect(raw.groupBy).toBe('DAY');
  });

  it('quick presets reload through the store so filters are persisted', () => {
    const fixture = configure();
    const store = TestBed.inject(AnalyticsStore) as jasmine.SpyObj<AnalyticsStore>;
    store.applyFilters.calls.reset();

    fixture.componentInstance.applyPreset('THIS_YEAR');

    expect(store.applyFilters).toHaveBeenCalledWith(1, jasmine.objectContaining({
      from: `${new Date().getFullYear()}-01-01`,
      to: `${new Date().getFullYear()}-12-31`
    }));
  });

  it('clears persisted filters and reloads defaults without persisting', () => {
    const fixture = configure();
    const store = TestBed.inject(AnalyticsStore) as jasmine.SpyObj<AnalyticsStore>;
    store.applyFilters.calls.reset();

    fixture.componentInstance.clearFilters();

    expect(store.clearPersistedFilters).toHaveBeenCalledWith(1);
    expect(store.applyFilters).toHaveBeenCalledWith(1, jasmine.objectContaining({ groupBy: 'WEEK' }), { persist: false });
  });

  it('shows cashflow timeline in the cashflow tab', () => {
    const fixture = configure();

    clickTab(fixture, 'Cashflow');

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Timeline cashflow');
    expect(text).toContain('2026-W18');
    expect(text).toContain('Ingreso');
    expect(text).toContain('Gasto real');
    expect(text).toContain('Deuda');
  });

  it('shows expense breakdowns in the expenses tab', () => {
    const fixture = configure();

    clickTab(fixture, 'Gastos');

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Gastos por categoria');
    expect(text).toContain('Food');
    expect(text).toContain('Gastos por medio de pago');
    expect(text).toContain('Cash');
    expect(text).toContain('Ingresos por categoria');
    expect(text).toContain('Salary');
  });

  it('shows monthly budget versus expenses comparison', () => {
    const fixture = configure();

    clickTab(fixture, 'Presupuesto');

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Presupuesto vs gastos por categoria');
    expect(text).toContain('Food');
    expect(text).toContain('Presupuestado');
    expect(text).toContain('Gastado');
    expect(text).toContain('Restante');
    expect(text).toContain('81.25%');
  });

  it('shows overrun and no-budget states in budget comparison', () => {
    const fixture = configure();

    clickTab(fixture, 'Presupuesto');

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Unexpected');
    expect(text).toContain('Sin presupuesto');
    expect(text).toContain('Sobre-ejecucion');
    expect(fixture.nativeElement.querySelector('.comparison-row.overrun')).not.toBeNull();
  });

  it('shows monthly-only message for non-monthly ranges', () => {
    const fixture = configure();

    fixture.componentInstance.filtersForm.patchValue({ from: '2026-05-10', to: '2026-05-31' });
    clickTab(fixture, 'Presupuesto');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('La comparacion contra presupuesto esta disponible para un mes especifico');
  });

  it('shows budget comparison empty state', () => {
    const fixture = configure({ budgetVsExpensesByCategory: [] });

    clickTab(fixture, 'Presupuesto');

    expect(fixture.nativeElement.textContent).toContain('No hay presupuesto ni gastos por categoria para este mes');
  });

  it('shows empty state', () => {
    const fixture = configure({
      cashflowSummary: { ...cashflowSummary, totalIncome: 0, totalOutflow: 0, netCashflow: 0 },
      expenseSummary: { ...expenseSummary, totalExpensesConceptual: 0, expensesCount: 0 },
      cashflowTimeline: { ...cashflowTimeline, items: [] },
      expensesByCategory: { ...expensesByCategory, items: [] },
      expensesByPaymentMethod: { ...expensesByPaymentMethod, items: [] },
      incomesByCategory: { ...incomesByCategory, items: [] },
      budgetVsExpensesByCategory: [],
      empty: true
    });

    expect(fixture.nativeElement.textContent).toContain('Sin movimientos para este rango');
  });

  it('shows backend error', () => {
    const fixture = configure({
      error: {
        timestamp: '',
        status: 400,
        error: 'Bad Request',
        code: 'ANALYTICS_DATE_RANGE_TOO_LARGE',
        message: 'Range too large',
        path: '',
        correlationId: null,
        details: []
      }
    });

    expect(fixture.nativeElement.textContent).toContain('El rango maximo permitido es de 24 meses');
    expect(fixture.nativeElement.textContent).toContain('Reintentar');
  });

  it('reflects positive and negative net cashflow', () => {
    const positiveFixture = configure();
    expect(positiveFixture.nativeElement.querySelector('.metric-card.positive')).not.toBeNull();

    TestBed.resetTestingModule();
    const negativeFixture = configure({ cashflowSummary: { ...cashflowSummary, netCashflow: -50000 } });
    expect(negativeFixture.nativeElement.querySelector('.metric-card.negative')).not.toBeNull();
  });

  it('calculates proportional bars', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    expect(component.categoryPercent(expensesByCategory.items[0], expensesByCategory.items)).toBe(100);
    expect(component.categoryPercent(expensesByCategory.items[1], expensesByCategory.items)).toBe(50);
    expect(component.paymentMethodPercent(expensesByPaymentMethod.items[0], expensesByPaymentMethod.items)).toBe(100);
  });
});
