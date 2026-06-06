import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AccountsApiService } from '../../core/accounts/accounts-api.service';
import { AuthStore } from '../../core/auth/auth.store';
import { BudgetPersistedFilters, BudgetsStore } from '../../core/budgets/budgets.store';
import { CatalogsApiService } from '../../core/catalogs/catalogs-api.service';
import { AccountStore } from '../../core/state/account.store';
import {
  AccountMemberResponseDto,
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
  const adminMember: AccountMemberResponseDto = {
    participantId: 7,
    email: 'admin@example.com',
    displayName: 'Admin',
    role: 'ACCOUNT_ADMIN',
    status: 'ACTIVE',
    joinedAt: ''
  };
  const member: AccountMemberResponseDto = {
    participantId: 9,
    email: 'member@example.com',
    displayName: 'Member',
    role: 'ACCOUNT_MEMBER',
    status: 'ACTIVE',
    joinedAt: ''
  };
  const defaultPersistedFilters: BudgetPersistedFilters = {
    selectedYear: 2026,
    selectedMonth: 5,
    year: 2026,
    status: null,
    sort: 'month,desc'
  };

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

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
      members?: AccountMemberResponseDto[];
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
        { provide: AuthStore, useValue: { user: signal({ participantId: 7 }) } },
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
            createAnnualBudget: jasmine.createSpy('createAnnualBudget').and.callFake(() => of(selectedBudgetDetail() ?? detail)),
            duplicateBudget: jasmine.createSpy('duplicateBudget').and.callFake(() => of(selectedBudgetDetail() ?? detail)),
            createSubBudget: jasmine.createSpy('createSubBudget').and.callFake(() => of(selectedBudgetDetail())),
            updateSubBudget: jasmine.createSpy('updateSubBudget').and.callFake(() => of(selectedBudgetDetail())),
            deactivateSubBudget: jasmine.createSpy('deactivateSubBudget').and.callFake(() => of(selectedBudgetDetail()))
          }
        },
        {
          provide: AccountsApiService,
          useValue: {
            listMembers: jasmine.createSpy('listMembers').and.returnValue(of(options.members ?? [adminMember, member]))
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

  it('creates a global sub budget with null participant when no participant is selected', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    const store = TestBed.inject(BudgetsStore) as jasmine.SpyObj<BudgetsStore>;

    component.viewMode.set('monthlyDetail');
    component.changeDetailTab('subBudgets');
    component.startCreateSubBudget();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Participante');
    expect(fixture.nativeElement.textContent).toContain('Global');

    component.subBudgetForm.patchValue({
      categoryId: 3,
      name: 'Mercado global',
      plannedAmount: 500000,
      participantId: ''
    });
    component.saveSubBudget();

    expect(store.createSubBudget).toHaveBeenCalledWith(
      1,
      1,
      jasmine.objectContaining({
        categoryId: 3,
        name: 'Mercado global',
        plannedAmount: 500000,
        participantId: null
      })
    );
  });

  it('lets admin assign participant when creating a sub budget', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    const store = TestBed.inject(BudgetsStore) as jasmine.SpyObj<BudgetsStore>;

    component.viewMode.set('monthlyDetail');
    component.changeDetailTab('subBudgets');
    component.startCreateSubBudget();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Member (member@example.com)');

    component.subBudgetForm.patchValue({
      categoryId: 3,
      name: 'Mercado Member',
      plannedAmount: 250000,
      participantId: '9'
    });
    component.saveSubBudget();

    expect(store.createSubBudget).toHaveBeenCalledWith(
      1,
      1,
      jasmine.objectContaining({
        participantId: 9
      })
    );
  });

  it('prefills participant when editing a sub budget', () => {
    const subBudgetWithParticipant: SubBudgetResponseDto = { ...manualSubBudget, participantId: 9 };
    const fixture = configure({ selectedDetail: { ...detail, subBudgets: [subBudgetWithParticipant] } });
    const component = fixture.componentInstance;
    const store = TestBed.inject(BudgetsStore) as jasmine.SpyObj<BudgetsStore>;

    component.startEditSubBudget(subBudgetWithParticipant);

    expect(component.subBudgetForm.controls.participantId.value).toBe('9');

    component.subBudgetForm.patchValue({ name: 'Mercado editado' });
    component.saveSubBudget();

    expect(store.updateSubBudget).toHaveBeenCalledWith(
      1,
      1,
      2,
      jasmine.objectContaining({
        name: 'Mercado editado',
        participantId: 9
      })
    );
  });

  it('limits member participant assignment to themselves', () => {
    const fixture = configure({ role: 'ACCOUNT_MEMBER' });
    const component = fixture.componentInstance;

    expect(component.canAssignGlobalSubBudget()).toBeFalse();
    expect(component.assignableParticipants().map((item) => item.participantId)).toEqual([7]);
  });

  it('shows participant label on sub budget cards', () => {
    const subBudgetWithParticipant: SubBudgetResponseDto = { ...manualSubBudget, participantId: 9 };
    const fixture = configure({ selectedDetail: { ...detail, subBudgets: [subBudgetWithParticipant] } });
    const component = fixture.componentInstance;

    component.viewMode.set('monthlyDetail');
    component.changeDetailTab('subBudgets');
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.subbudget-card') as HTMLElement;
    expect(card.textContent).toContain('Member (member@example.com)');
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
    fixture.componentInstance.viewMode.set('monthlyDetail');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Duplicar presupuesto');
  });

  it('renders annual budget action for account admins', () => {
    const fixture = configure();
    expect(fixture.nativeElement.textContent).toContain('Crear presupuesto anual');
    expect(fixture.nativeElement.querySelector('.header-actions')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Crear/actualizar presupuesto');
  });

  it('opens annual form and validates planned amount as positive', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startAnnualBudget();
    component.annualSubBudgets.at(0).patchValue({ name: 'Mercado', plannedAmount: 0 });

    expect(component.showAnnualBudgetForm()).toBeTrue();
    expect(component.annualBudgetForm.valid).toBeFalse();
  });

  it('adds and removes annual sub budget base rows', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startAnnualBudget();
    component.addAnnualSubBudget();

    expect(component.annualSubBudgets.length).toBe(2);

    component.removeAnnualSubBudget(1);
    expect(component.annualSubBudgets.length).toBe(1);
  });

  it('submits annual budget request and reloads target year detail', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    const store = TestBed.inject(BudgetsStore) as jasmine.SpyObj<BudgetsStore>;

    component.startAnnualBudget();
    component.annualBudgetForm.patchValue({ year: 2027, name: 'Presupuesto 2027', status: 'ACTIVE' });
    component.annualSubBudgets.at(0).patchValue({ name: 'Mercado', categoryId: 3, plannedAmount: 800000 });
    component.saveAnnualBudget();

    expect(store.createAnnualBudget).toHaveBeenCalledWith(
      1,
      jasmine.objectContaining({
        year: 2027,
        name: 'Presupuesto 2027',
        status: 'ACTIVE',
        subBudgets: [{ name: 'Mercado', categoryId: 3, plannedAmount: 800000 }]
      })
    );
    expect(component.successMessage()).toBe('Presupuesto anual creado correctamente.');
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

  it('does not load budget detail automatically on init', () => {
    const currentPersisted: BudgetPersistedFilters = {
      selectedYear: currentYear,
      selectedMonth: currentMonth,
      year: currentYear,
      status: null,
      sort: 'month,desc'
    };
    const fixture = configure({ persistedFilters: currentPersisted });
    const store = TestBed.inject(BudgetsStore) as jasmine.SpyObj<BudgetsStore>;

    expect(store.getBudgetDetail).not.toHaveBeenCalled();
    expect(fixture.componentInstance.periodForm.getRawValue()).toEqual({ year: currentYear, month: currentMonth });
  });

  it('defaults list status filter to ACTIVE when persisted filters do not define one', () => {
    const fixture = configure({
      persistedFilters: {
        selectedYear: 2026,
        selectedMonth: 5,
        year: 2026,
        status: null,
        sort: 'month,desc'
      }
    });

    expect(fixture.componentInstance.listFilterForm.getRawValue()).toEqual({ year: 2026, status: 'ACTIVE' });
  });

  it('opens selected monthly detail from annual list', () => {
    const currentPersisted: BudgetPersistedFilters = {
      selectedYear: currentYear,
      selectedMonth: currentMonth,
      year: currentYear,
      status: null,
      sort: 'month,desc'
    };
    const futureBudget: BudgetResponseDto = {
      ...budget,
      id: 88,
      year: currentYear,
      month: Math.min(12, currentMonth === 12 ? 12 : currentMonth + 1),
      name: 'Futuro'
    };
    const fixture = configure({
      budgets: [futureBudget],
      selectedDetail: null,
      persistedFilters: currentPersisted
    });
    const component = fixture.componentInstance;
    const store = TestBed.inject(BudgetsStore) as jasmine.SpyObj<BudgetsStore>;

    component.openBudgetDetail(futureBudget);

    expect(store.getBudgetDetail).toHaveBeenCalledWith(1, currentYear, futureBudget.month, { persist: true });
    expect(component.viewMode()).toBe('monthlyDetail');
  });

  it('resets detail tab to category summary when opening another month detail', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.viewMode.set('monthlyDetail');
    component.changeDetailTab('subBudgets');
    component.openBudgetDetail(budget);

    expect(component.selectedDetailTab()).toBe('categorySummary');
  });

  it('shows annual list as initial view and hides monthly detail section', () => {
    const fixture = configure();

    expect(fixture.nativeElement.textContent).toContain('Presupuestos del año');
    expect(fixture.nativeElement.textContent).not.toContain('Volver al listado');
    expect(fixture.nativeElement.textContent).not.toContain('Detalle mensual');
  });

  it('returns to annual list when clicking back from detail view', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.viewMode.set('monthlyDetail');
    fixture.detectChanges();

    const backButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (button) => (button as HTMLButtonElement).textContent?.includes('Volver al listado')
    ) as HTMLButtonElement | undefined;

    expect(backButton).toBeTruthy();
    backButton?.click();
    fixture.detectChanges();

    expect(component.viewMode()).toBe('annualList');
    expect(fixture.nativeElement.textContent).toContain('Presupuestos del año');
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
    expect(component.listFilterForm.getRawValue()).toEqual({ year: 2026, status: 'ACTIVE' });
    expect(store.loadBudgets).toHaveBeenCalledWith(1, { year: 2026, status: 'ACTIVE', page: 0 }, { persist: true });
  });

  it('stays in annual list after saving a budget update', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    const store = TestBed.inject(BudgetsStore) as jasmine.SpyObj<BudgetsStore>;

    component.openBudgetDetail(budget);
    store.getBudgetDetail.calls.reset();
    component.startUpsertBudget(budget);
    component.budgetForm.patchValue({ name: 'Mayo actualizado', status: 'CLOSED' });

    component.saveBudget();
    fixture.detectChanges();

    expect(store.upsertBudget).toHaveBeenCalledWith(
      1,
      2026,
      5,
      jasmine.objectContaining({
        name: 'Mayo actualizado',
        status: 'CLOSED'
      })
    );
    expect(component.viewMode()).toBe('annualList');
    expect(component.successMessage()).toBe('Presupuesto mensual guardado.');
    expect(store.selectedBudgetDetail()).toBeNull();
  });

  it('highlights annual budget row when editing it from the list', () => {
    const fixture = configure({ selectedDetail: null });
    const component = fixture.componentInstance;

    component.startUpsertBudget(budget);
    fixture.detectChanges();

    const selectedCard = fixture.nativeElement.querySelector('.annual-budget-list .budget-card.selected');
    expect(selectedCard).not.toBeNull();
    expect((selectedCard as HTMLElement).textContent).toContain('Mayo');

    component.cancelBudgetForm();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.annual-budget-list .budget-card.selected')).toBeNull();
  });

  it('renders a single compact top filters block and keeps actions available', () => {
    const fixture = configure();
    const filtersPanels = fixture.nativeElement.querySelectorAll('.filters-panel');

    expect(filtersPanels.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Estado');
    expect(fixture.nativeElement.textContent).toContain('Filtrar');
    expect(fixture.nativeElement.textContent).toContain('Limpiar filtros');
  });

  it('shows compact month selector in monthly detail mode', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.viewMode.set('monthlyDetail');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Mes detalle');
    expect(fixture.nativeElement.textContent).toContain('Ver detalle');
    expect(fixture.nativeElement.querySelectorAll('.filters-panel').length).toBe(1);
  });

  it('shows detail tabs and defaults to category summary tab', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.viewMode.set('monthlyDetail');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Presupuesto por categoria');
    expect(fixture.nativeElement.textContent).toContain('Subpresupuestos');
    expect(component.selectedDetailTab()).toBe('categorySummary');
    expect(fixture.nativeElement.querySelector('.category-budget-section')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.subbudget-section')).toBeNull();
  });

  it('switches to sub budgets tab in monthly detail', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.viewMode.set('monthlyDetail');
    component.changeDetailTab('subBudgets');
    fixture.detectChanges();

    expect(component.selectedDetailTab()).toBe('subBudgets');
    expect(fixture.nativeElement.querySelector('.subbudget-section')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.category-budget-section')).toBeNull();
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

  it('shows annual budget existing month error message', () => {
    const fixture = configure({
      error: {
        code: 'ANNUAL_BUDGET_MONTH_ALREADY_EXISTS',
        message: 'target exists'
      }
    });

    expect(fixture.nativeElement.textContent).toContain('Ya existe al menos un presupuesto para este año.');
  });

  it('does not show edit or deactivate actions for derived sub budgets', () => {
    const fixture = configure({ budgets: [], selectedDetail: { ...detail, subBudgets: [derivedSubBudget], impacts: [] } });
    fixture.componentInstance.viewMode.set('monthlyDetail');
    fixture.componentInstance.changeDetailTab('subBudgets');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Laptop cuotas');
    expect(fixture.nativeElement.textContent).not.toContain('Editar');
    expect(fixture.nativeElement.textContent).not.toContain('Desactivar');
  });

  it('renders top-level totals from budget summary', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    component.viewMode.set('monthlyDetail');
    fixture.detectChanges();

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
    fixture.componentInstance.viewMode.set('monthlyDetail');
    fixture.detectChanges();
    const section = fixture.nativeElement.querySelector('.category-budget-section') as HTMLElement;

    expect(section.textContent).toContain('Presupuesto por categoria');
    expect(section.textContent).toContain('Mercado');
    expect(section.textContent).toContain('Total presupuestado');
    expect(section.textContent).toContain('$500,000');
    expect(section.textContent).toContain('1 subpresupuesto');
    expect(section.textContent).toContain('Ver subpresupuestos');
  });

  it('shows category sub budgets when clicking "Ver subpresupuestos"', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    component.viewMode.set('monthlyDetail');
    fixture.detectChanges();

    const toggleButton = Array.from(fixture.nativeElement.querySelectorAll('.category-budget-section button')).find(
      (button) => (button as HTMLButtonElement).textContent?.includes('Ver subpresupuestos')
    ) as HTMLButtonElement | undefined;

    expect(toggleButton).toBeTruthy();
    toggleButton?.click();
    fixture.detectChanges();

    const section = fixture.nativeElement.querySelector('.category-budget-section') as HTMLElement;
    expect(section.textContent).toContain('Ocultar subpresupuestos');
    expect(section.textContent).toContain('Mercado');
    expect(section.textContent).toContain('Presupuestado');
    expect(section.textContent).toContain('$500,000');
  });

  it('highlights selected category card when showing its sub budgets', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    component.viewMode.set('monthlyDetail');
    fixture.detectChanges();

    const toggleButton = Array.from(fixture.nativeElement.querySelectorAll('.category-budget-section button')).find(
      (button) => (button as HTMLButtonElement).textContent?.includes('Ver subpresupuestos')
    ) as HTMLButtonElement | undefined;

    toggleButton?.click();
    fixture.detectChanges();

    const selectedCard = fixture.nativeElement.querySelector('.category-budget-list .budget-card.selected');
    expect(selectedCard).not.toBeNull();
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
    fixture.componentInstance.viewMode.set('monthlyDetail');
    fixture.detectChanges();
    const section = fixture.nativeElement.querySelector('.category-budget-section') as HTMLElement;

    expect(section.textContent).toContain('Mercado');
    expect(section.textContent).toContain('$1,000,000');
    expect(section.textContent).toContain('3 subpresupuestos');
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
    fixture.componentInstance.viewMode.set('monthlyDetail');
    fixture.detectChanges();
    const section = fixture.nativeElement.querySelector('.category-budget-section') as HTMLElement;

    expect(section.textContent).toContain('$500,000');
    expect(section.textContent).toContain('1 subpresupuesto');
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
    fixture.componentInstance.viewMode.set('monthlyDetail');
    fixture.detectChanges();
    const section = fixture.nativeElement.querySelector('.category-budget-section') as HTMLElement;

    expect(section.textContent).toContain('No hay categorias con presupuesto para este mes.');
  });

  it('shows only base sub budget information without individual execution values', () => {
    const fixture = configure();
    fixture.componentInstance.viewMode.set('monthlyDetail');
    fixture.componentInstance.changeDetailTab('subBudgets');
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.subbudget-card') as HTMLElement;

    expect(card.textContent).toContain('Mercado');
    expect(card.textContent).toContain('Presupuestado');
    expect(card.textContent).toContain('$500,000');
    expect(card.textContent).not.toContain('$250,000');
    expect(card.textContent).not.toContain('Restante');
    expect(card.textContent).not.toContain('Sobre-ejecucion');
    expect(fixture.nativeElement.textContent).not.toContain('Spent / planned');
    expect(fixture.nativeElement.querySelector('.subbudget-card .progress-track')).toBeNull();
  });

  it('highlights sub budget card when editing it', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    component.viewMode.set('monthlyDetail');
    component.changeDetailTab('subBudgets');
    fixture.detectChanges();

    const editButton = fixture.nativeElement.querySelector('.subbudget-card .actions button') as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();

    const selectedCard = fixture.nativeElement.querySelector('.subbudget-list .subbudget-card.selected');
    expect(selectedCard).not.toBeNull();
    expect((selectedCard as HTMLElement).textContent).toContain('Mercado');
  });

  it('filters sub budgets by search text and category', () => {
    const fixture = configure({
      selectedDetail: {
        ...detail,
        subBudgets: [
          manualSubBudget,
          { ...manualSubBudget, id: 5, name: 'Gasolina', categoryId: 9, plannedAmount: 400000 }
        ]
      },
      categories: [
        category,
        { ...category, id: 9, name: 'Carro' }
      ]
    });
    const component = fixture.componentInstance;
    component.viewMode.set('monthlyDetail');
    component.changeDetailTab('subBudgets');
    fixture.detectChanges();

    component.setSubBudgetSearch('gas');
    fixture.detectChanges();

    let cards = fixture.nativeElement.querySelectorAll('.subbudget-list .subbudget-card');
    expect(cards.length).toBe(1);
    expect((cards[0] as HTMLElement).textContent).toContain('Gasolina');

    component.setSubBudgetSearch('');
    component.setSubBudgetCategory('3');
    fixture.detectChanges();

    cards = fixture.nativeElement.querySelectorAll('.subbudget-list .subbudget-card');
    expect(cards.length).toBe(1);
    expect((cards[0] as HTMLElement).textContent).toContain('Mercado');
  });

  it('does not show over execution inside sub budget cards', () => {
    const fixture = configure({
      selectedDetail: {
        ...detail,
        subBudgets: [{ ...manualSubBudget, plannedAmount: 100000, spentAmount: 150000 }]
      },
      budgetSummary: { ...summary, expectedAmount: 100000, paidAmount: 150000, pendingAmount: -50000 }
    });
    fixture.componentInstance.viewMode.set('monthlyDetail');
    fixture.componentInstance.changeDetailTab('subBudgets');
    fixture.detectChanges();
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
    fixture.componentInstance.viewMode.set('monthlyDetail');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No hay presupuesto para este mes');
    expect(fixture.nativeElement.querySelector('.error-panel')).toBeNull();
  });
});
