import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BudgetPersistedFilters, BudgetsStore } from '../../core/budgets/budgets.store';
import { CatalogsApiService } from '../../core/catalogs/catalogs-api.service';
import { AccountStore } from '../../core/state/account.store';
import {
  AccountResponseDto,
  BudgetDetailResponseDto,
  BudgetResponseDto,
  BudgetSummaryResponseDto,
  CategoryResponseDto,
  SubBudgetResponseDto
} from '../../shared/models';
import { BudgetsPageComponent } from './budgets-page.component';

describe('BudgetsPageComponent', () => {
  const accountBase: AccountResponseDto = {
    id: 1,
    name: 'Casa',
    description: null,
    status: 'ACTIVE',
    currentUserRole: 'ACCOUNT_ADMIN',
    createdAt: '',
    updatedAt: ''
  };
  const budget: BudgetResponseDto = {
    id: 1,
    accountId: 1,
    year: 2026,
    month: 5,
    name: 'Mayo',
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: ''
  };
  const manualSubBudget: SubBudgetResponseDto = {
    id: 2,
    accountId: 1,
    budgetId: 1,
    categoryId: 3,
    debtId: null,
    name: 'Mercado',
    plannedAmount: 500000,
    plannedCurrency: 'COP',
    spentAmount: 250000,
    spentCurrency: 'COP',
    status: 'ACTIVE',
    sourceType: 'MANUAL',
    createdAt: '',
    updatedAt: ''
  };
  const derivedSubBudget: SubBudgetResponseDto = {
    ...manualSubBudget,
    id: 4,
    name: 'Laptop cuotas',
    sourceType: 'DEBT_DERIVED',
    debtId: 8
  };
  const detail: BudgetDetailResponseDto = {
    budget,
    subBudgets: [manualSubBudget],
    impacts: [
      {
        id: 3,
        accountId: 1,
        budgetId: 1,
        subBudgetId: 4,
        debtId: 8,
        expenseId: 9,
        periodYear: 2026,
        periodMonth: 5,
        expectedAmount: 300000,
        expectedCurrency: 'COP',
        paidAmount: 120000,
        paidCurrency: 'COP',
        status: 'ACTIVE',
        sourceType: 'DEBT_INSTALLMENT',
        createdAt: '',
        updatedAt: ''
      }
    ]
  };
  const summary: BudgetSummaryResponseDto = {
    accountId: 1,
    year: 2026,
    month: 5,
    budgetId: 1,
    expectedAmount: 800000,
    paidAmount: 370000,
    pendingAmount: 430000,
    impactsCount: 1,
    paidImpactsCount: 0,
    activeImpactsCount: 1,
    subBudgetsCount: 1
  };
  const category: CategoryResponseDto = {
    id: 3,
    accountId: 1,
    name: 'Mercado',
    description: null,
    type: 'EXPENSE',
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: ''
  };
  const defaultPersistedFilters: BudgetPersistedFilters = {
    selectedYear: 2026,
    selectedMonth: 5,
    year: 2026,
    status: null,
    sort: 'month,desc'
  };

  function configure(
    options: {
      role?: 'ACCOUNT_ADMIN' | 'ACCOUNT_MEMBER';
      archived?: boolean;
      budgets?: BudgetResponseDto[];
      selectedDetail?: BudgetDetailResponseDto | null;
      categories?: CategoryResponseDto[];
      error?: { code: string; message: string };
      persistedFilters?: BudgetPersistedFilters;
      budgetSummary?: BudgetSummaryResponseDto | null;
    } = {}
  ): ComponentFixture<BudgetsPageComponent> {
    const account = {
      ...accountBase,
      status: options.archived ? 'ARCHIVED' : 'ACTIVE',
      currentUserRole: options.role ?? 'ACCOUNT_ADMIN'
    };
    const budgets = options.budgets ?? [budget];
    const initialDetail = Object.prototype.hasOwnProperty.call(options, 'selectedDetail') ? options.selectedDetail ?? null : detail;
    const selectedBudgetDetail = signal<BudgetDetailResponseDto | null>(initialDetail);

    TestBed.configureTestingModule({
      imports: [BudgetsPageComponent],
      providers: [
        {
          provide: AccountStore,
          useValue: {
            selectedAccountId: signal(1),
            selectedAccount: signal(account),
            selectedAccountArchived: signal(options.archived ?? false)
          }
        },
        {
          provide: BudgetsStore,
          useValue: {
            budgets: signal(budgets),
            selectedBudgetDetail,
            budgetSummary: signal(Object.prototype.hasOwnProperty.call(options, 'budgetSummary') ? options.budgetSummary ?? null : summary),
            filters: signal({ year: 2026, status: null, page: 0, size: 20, sort: 'month,desc' }),
            isLoading: signal(false),
            isSaving: signal(false),
            error: signal(options.error ?? null),
            pagination: signal({ page: 0, size: 20, totalElements: budgets.length, totalPages: budgets.length ? 1 : 0 }),
            loadPersistedFilters: jasmine.createSpy('loadPersistedFilters').and.returnValue(options.persistedFilters ?? defaultPersistedFilters),
            clearPersistedFilters: jasmine.createSpy('clearPersistedFilters').and.returnValue(defaultPersistedFilters),
            loadBudgets: jasmine.createSpy('loadBudgets').and.returnValue(of(budgets)),
            getBudgetDetail: jasmine.createSpy('getBudgetDetail').and.callFake(() => of(selectedBudgetDetail())),
            upsertBudget: jasmine.createSpy('upsertBudget').and.callFake(() => of(selectedBudgetDetail())),
            duplicateBudget: jasmine.createSpy('duplicateBudget').and.callFake(() => of(selectedBudgetDetail() ?? detail)),
            createSubBudget: jasmine.createSpy('createSubBudget').and.callFake(() => of(selectedBudgetDetail())),
            updateSubBudget: jasmine.createSpy('updateSubBudget').and.callFake(() => of(selectedBudgetDetail())),
            deactivateSubBudget: jasmine.createSpy('deactivateSubBudget').and.callFake(() => of(selectedBudgetDetail()))
          }
        },
        {
          provide: CatalogsApiService,
          useValue: {
            listCategories: jasmine
              .createSpy('listCategories')
              .and.returnValue(of({ content: options.categories ?? [category], page: 0, size: 20, totalElements: 1, totalPages: 1 }))
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(BudgetsPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('validates required name and planned amount for sub budgets', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startCreateSubBudget();
    component.subBudgetForm.patchValue({ name: '', plannedAmount: -1 });

    expect(component.subBudgetForm.valid).toBeFalse();
    expect(component.subBudgetForm.controls.name.hasError('required')).toBeTrue();
    expect(component.subBudgetForm.controls.plannedAmount.hasError('min')).toBeTrue();
  });

  it('hides write actions for account members', () => {
    const fixture = configure({ role: 'ACCOUNT_MEMBER' });

    expect(fixture.nativeElement.textContent).toContain('Solo lectura');
    expect(fixture.nativeElement.textContent).not.toContain('Nuevo subpresupuesto');
    expect(fixture.nativeElement.textContent).not.toContain('Crear/actualizar presupuesto');
    expect(fixture.nativeElement.textContent).not.toContain('Duplicar presupuesto');
  });

  it('blocks write actions when account is archived', () => {
    const fixture = configure({ archived: true });

    expect(fixture.nativeElement.textContent).toContain('La cuenta esta archivada');
    expect(fixture.nativeElement.textContent).not.toContain('Nuevo subpresupuesto');
    expect(fixture.nativeElement.textContent).not.toContain('Duplicar presupuesto');
  });

  it('shows duplicate action for account admins', () => {
    const fixture = configure();

    expect(fixture.nativeElement.textContent).toContain('Duplicar presupuesto');
  });

  it('prefills duplicate form with next month', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startDuplicateBudget();

    expect(component.duplicateBudgetForm.getRawValue()).toEqual({
      targetYear: 2026,
      targetMonth: 6,
      name: 'Mayo'
    });
  });

  it('does not duplicate to the same month', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    const store = TestBed.inject(BudgetsStore) as jasmine.SpyObj<BudgetsStore>;

    component.startDuplicateBudget();
    component.duplicateBudgetForm.patchValue({ targetYear: 2026, targetMonth: 5 });
    component.saveDuplicateBudget();

    expect(component.duplicateBudgetError()).toContain('mes destino debe ser diferente');
    expect(store.duplicateBudget).not.toHaveBeenCalled();
  });

  it('submits duplicate budget request', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    const store = TestBed.inject(BudgetsStore) as jasmine.SpyObj<BudgetsStore>;
    spyOn(globalThis, 'confirm').and.returnValue(true);

    component.startDuplicateBudget();
    component.duplicateBudgetForm.patchValue({ targetYear: 2026, targetMonth: 6, name: 'Casa Franco Moreno' });
    component.saveDuplicateBudget();

    expect(store.duplicateBudget).toHaveBeenCalledWith(1, 2026, 5, {
      targetYear: 2026,
      targetMonth: 6,
      name: 'Casa Franco Moreno'
    });
    expect(component.successMessage()).toBe('Presupuesto duplicado correctamente.');
  });

  it('loads persisted period and filters on init', () => {
    const fixture = configure({
      persistedFilters: {
        selectedYear: 2026,
        selectedMonth: 6,
        year: 2026,
        status: 'ACTIVE',
        sort: 'month,desc'
      }
    });
    const component = fixture.componentInstance;
    const store = TestBed.inject(BudgetsStore) as jasmine.SpyObj<BudgetsStore>;

    expect(store.loadPersistedFilters).toHaveBeenCalledWith(1);
    expect(component.periodForm.getRawValue()).toEqual({ year: 2026, month: 6 });
    expect(component.listFilterForm.getRawValue()).toEqual({ year: 2026, status: 'ACTIVE' });
  });

  it('persists filters and clears period back to defaults', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    const store = TestBed.inject(BudgetsStore) as jasmine.SpyObj<BudgetsStore>;

    store.loadBudgets.calls.reset();
    component.listFilterForm.patchValue({ year: 2027, status: 'CLOSED' });
    component.loadBudgets();

    expect(store.loadBudgets).toHaveBeenCalledWith(1, { year: 2027, status: 'CLOSED', page: 0 }, { persist: true });

    store.loadBudgets.calls.reset();
    component.clearFilters();

    expect(store.clearPersistedFilters).toHaveBeenCalledWith(1);
    expect(component.periodForm.getRawValue()).toEqual({ year: 2026, month: 5 });
    expect(component.listFilterForm.getRawValue()).toEqual({ year: 2026, status: '' });
    expect(store.loadBudgets).toHaveBeenCalledWith(1);
  });

  it('shows clearer budget filter sections and keeps filter actions available', () => {
    const fixture = configure();

    expect(fixture.nativeElement.textContent).toContain('Lista anual');
    expect(fixture.nativeElement.textContent).toContain('Detalle mensual');
    expect(fixture.nativeElement.textContent).toContain('Estado');
    expect(fixture.nativeElement.textContent).toContain('Filtrar');
    expect(fixture.nativeElement.textContent).toContain('Limpiar filtros');
  });

  it('shows current period sort and changes it preserving filters in store', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    const store = TestBed.inject(BudgetsStore) as jasmine.SpyObj<BudgetsStore>;
    const activeSortButton = fixture.nativeElement.querySelector('.sort-actions button.active') as HTMLButtonElement;

    expect(fixture.nativeElement.textContent).toContain('Orden por periodo');
    expect(fixture.nativeElement.textContent).toContain('Mas recientes primero');
    expect(fixture.nativeElement.textContent).toContain('Mas antiguos primero');
    expect(activeSortButton.textContent).toContain('Mas recientes primero');

    store.loadBudgets.calls.reset();
    component.changePeriodSort('month,asc');

    expect(store.loadBudgets).toHaveBeenCalledWith(1, { sort: 'month,asc', page: 0 }, { persist: true });
  });

  it('shows target existing duplicate error', () => {
    const fixture = configure({
      error: {
        code: 'BUDGET_TARGET_ALREADY_EXISTS',
        message: 'target exists'
      }
    });

    expect(fixture.nativeElement.textContent).toContain('Ya existe un presupuesto para el mes destino.');
  });

  it('does not show edit or deactivate actions for derived sub budgets', () => {
    const fixture = configure({ budgets: [], selectedDetail: { ...detail, subBudgets: [derivedSubBudget], impacts: [] } });

    expect(fixture.nativeElement.textContent).toContain('DEBT_DERIVED');
    expect(fixture.nativeElement.textContent).not.toContain('Editar');
    expect(fixture.nativeElement.textContent).not.toContain('Desactivar');
  });

  it('renders top-level totals from budget summary', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    expect(component.impactTotals()).toEqual({ expected: 800000, paid: 370000, pending: 430000 });
    expect(component.impactProgress()).toBe(46);
    expect(fixture.nativeElement.textContent).toContain('$800,000');
    expect(fixture.nativeElement.textContent).toContain('$370,000');
    expect(fixture.nativeElement.textContent).toContain('$430,000');
    expect(fixture.nativeElement.textContent).toContain('Paid / expected total');
    expect(fixture.nativeElement.querySelector('.detail-panel .progress-track')).not.toBeNull();
  });

  it('renders budget by category summary', () => {
    const fixture = configure();
    const section = fixture.nativeElement.querySelector('.category-budget-section') as HTMLElement;

    expect(section.textContent).toContain('Presupuesto por categoria');
    expect(section.textContent).toContain('Mercado');
    expect(section.textContent).toContain('Total presupuestado');
    expect(section.textContent).toContain('$500,000');
    expect(section.textContent).toContain('1 subpresupuesto incluido');
  });

  it('groups manual and debt-derived sub budgets by category', () => {
    const fixture = configure({
      selectedDetail: {
        ...detail,
        subBudgets: [
          manualSubBudget,
          { ...manualSubBudget, id: 5, name: 'Supermercado', plannedAmount: 200000 },
          { ...derivedSubBudget, id: 6, plannedAmount: 300000 }
        ]
      }
    });
    const section = fixture.nativeElement.querySelector('.category-budget-section') as HTMLElement;

    expect(section.textContent).toContain('Mercado');
    expect(section.textContent).toContain('$1,000,000');
    expect(section.textContent).toContain('3 subpresupuestos incluidos');
  });

  it('excludes inactive and uncategorized sub budgets from category summary', () => {
    const fixture = configure({
      selectedDetail: {
        ...detail,
        subBudgets: [
          manualSubBudget,
          { ...manualSubBudget, id: 5, name: 'Inactivo', plannedAmount: 900000, status: 'INACTIVE' },
          { ...manualSubBudget, id: 6, name: 'Sin categoria', categoryId: null, plannedAmount: 300000 }
        ]
      }
    });
    const section = fixture.nativeElement.querySelector('.category-budget-section') as HTMLElement;

    expect(section.textContent).toContain('$500,000');
    expect(section.textContent).toContain('1 subpresupuesto incluido');
    expect(section.textContent).not.toContain('$900,000');
    expect(section.textContent).not.toContain('$300,000');
  });

  it('shows empty category summary when no active categorized sub budgets exist', () => {
    const fixture = configure({
      selectedDetail: {
        ...detail,
        subBudgets: [
          { ...manualSubBudget, status: 'INACTIVE' },
          { ...manualSubBudget, id: 5, categoryId: null }
        ]
      }
    });
    const section = fixture.nativeElement.querySelector('.category-budget-section') as HTMLElement;

    expect(section.textContent).toContain('No hay categorias con presupuesto para este mes.');
  });

  it('shows only base sub budget information without individual execution values', () => {
    const fixture = configure();
    const card = fixture.nativeElement.querySelector('.subbudget-card') as HTMLElement;

    expect(card.textContent).toContain('Mercado');
    expect(card.textContent).toContain('MANUAL');
    expect(card.textContent).toContain('Presupuestado');
    expect(card.textContent).toContain('$500,000');
    expect(card.textContent).not.toContain('$250,000');
    expect(card.textContent).not.toContain('Restante');
    expect(card.textContent).not.toContain('Sobre-ejecucion');
    expect(fixture.nativeElement.textContent).not.toContain('Spent / planned');
    expect(fixture.nativeElement.querySelector('.subbudget-card .progress-track')).toBeNull();
  });

  it('does not show over execution inside sub budget cards', () => {
    const fixture = configure({
      selectedDetail: {
        ...detail,
        subBudgets: [{ ...manualSubBudget, plannedAmount: 100000, spentAmount: 150000 }]
      },
      budgetSummary: { ...summary, expectedAmount: 100000, paidAmount: 150000, pendingAmount: -50000 }
    });
    const card = fixture.nativeElement.querySelector('.subbudget-card') as HTMLElement;

    expect(card.textContent).toContain('Presupuestado');
    expect(card.textContent).toContain('$100,000');
    expect(card.textContent).not.toContain('Sobre-ejecucion');
    expect(card.textContent).not.toContain('$150,000');
    expect(card.textContent).not.toContain('-$50,000');
    expect(fixture.nativeElement.textContent).toContain('-$50,000');
  });

  it('falls back to impact totals when budget summary is not loaded', () => {
    const fixture = configure({ budgetSummary: null });
    const component = fixture.componentInstance;

    expect(component.impactTotals()).toEqual({ expected: 300000, paid: 120000, pending: 180000 });
    expect(component.impactProgress()).toBe(40);
  });

  it('shows empty state when no budget detail is selected', () => {
    const fixture = configure({ budgets: [], selectedDetail: null });

    expect(fixture.nativeElement.textContent).toContain('No hay presupuesto para este mes');
  });
});
