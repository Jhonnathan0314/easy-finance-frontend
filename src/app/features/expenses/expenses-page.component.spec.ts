import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthStore } from '../../core/auth/auth.store';
import { CatalogsApiService } from '../../core/catalogs/catalogs-api.service';
import { ExpensesStore } from '../../core/expenses/expenses.store';
import { AccountStore } from '../../core/state/account.store';
import { ExpenseResponseDto } from '../../shared/models';
import { ExpensesPageComponent } from './expenses-page.component';

describe('ExpensesPageComponent', () => {
  const category = { id: 1, accountId: 1, name: 'Food', description: null, type: 'EXPENSE', status: 'ACTIVE', createdAt: '', updatedAt: '' };
  const method = { id: 2, accountId: 1, name: 'Cash', description: null, type: 'CASH', status: 'ACTIVE', createdAt: '', updatedAt: '' };
  const ownExpense: ExpenseResponseDto = {
    id: 1,
    accountId: 1,
    categoryId: 1,
    paymentMethodId: 2,
    participantId: 7,
    description: 'Lunch',
    amount: 10000,
    currency: 'COP',
    expenseDate: '2026-05-12',
    paymentState: 'PAID',
    status: 'ACTIVE',
    expenseType: 'SIMPLE',
    createdAt: '',
    updatedAt: ''
  };

  function configure(
    options: {
      role?: 'ACCOUNT_ADMIN' | 'ACCOUNT_MEMBER';
      archived?: boolean;
      expenses?: ExpenseResponseDto[];
      catalogs?: boolean;
      categories?: boolean;
      paymentMethods?: boolean;
      userParticipantId?: number;
      error?: { code: string; message: string };
      saving?: boolean;
      persistedFilters?: unknown;
      pagination?: { page: number; size: number; totalElements: number; totalPages: number };
    } = {}
  ) {
    const role = options.role ?? 'ACCOUNT_ADMIN';
    const archived = options.archived ?? false;
    const expenses = options.expenses ?? [ownExpense];
    const hasCategories = options.categories ?? options.catalogs ?? true;
    const hasPaymentMethods = options.paymentMethods ?? options.catalogs ?? true;
    const account = {
      id: 1,
      name: 'Casa',
      description: null,
      status: archived ? 'ARCHIVED' : 'ACTIVE',
      currentUserRole: role,
      createdAt: '',
      updatedAt: ''
    };
    const defaultFilters = {
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
    const initialFilters = options.persistedFilters ?? defaultFilters;

    TestBed.configureTestingModule({
      imports: [ExpensesPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { user: signal({ participantId: options.userParticipantId ?? 7 }) } },
        {
          provide: AccountStore,
          useValue: {
            selectedAccountId: signal(1),
            selectedAccount: signal(account),
            selectedAccountArchived: signal(archived)
          }
        },
        {
          provide: CatalogsApiService,
          useValue: {
            listCategories: jasmine.createSpy('listCategories').and.returnValue(
              of({ content: hasCategories ? [category] : [], page: 0, size: 20, totalElements: hasCategories ? 1 : 0, totalPages: 1 })
            ),
            listPaymentMethods: jasmine.createSpy('listPaymentMethods').and.returnValue(
              of({ content: hasPaymentMethods ? [method] : [], page: 0, size: 20, totalElements: hasPaymentMethods ? 1 : 0, totalPages: 1 })
            )
          }
        },
        {
          provide: ExpensesStore,
          useValue: {
            expenses: signal(expenses),
            selectedExpense: signal(null),
            isLoading: signal(false),
            isSaving: signal(options.saving ?? false),
            error: signal(options.error ?? null),
            filters: signal(initialFilters),
            pagination: signal(options.pagination ?? { page: 0, size: 20, totalElements: expenses.length, totalPages: expenses.length ? 1 : 0 }),
            loadExpenses: jasmine.createSpy('loadExpenses').and.returnValue(of(expenses)),
            loadPersistedFilters: jasmine.createSpy('loadPersistedFilters').and.returnValue(initialFilters),
            clearPersistedFilters: jasmine.createSpy('clearPersistedFilters').and.returnValue(defaultFilters),
            createSimpleExpense: jasmine.createSpy('createSimpleExpense').and.returnValue(of(expenses)),
            updateExpense: jasmine.createSpy('updateExpense').and.returnValue(of(expenses)),
            duplicateExpense: jasmine.createSpy('duplicateExpense').and.returnValue(of({ ...ownExpense, id: 2, expenseDate: '2026-06-12' })),
            cancelExpense: jasmine.createSpy('cancelExpense').and.returnValue(of([])),
            createInstallmentExpense: jasmine.createSpy('createInstallmentExpense').and.returnValue(of(expenses))
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(ExpensesPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  function findButton(fixture: ComponentFixture<ExpensesPageComponent>, label: string): HTMLButtonElement | undefined {
    const root = fixture.nativeElement as HTMLElement;

    return Array.from(root.querySelectorAll('button')).find((button) => button.textContent?.includes(label));
  }

  it('validates required fields and minimum amount for simple expenses', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startCreateSimple();
    component.simpleForm.patchValue({ categoryId: 0, paymentMethodId: 0, description: '', amount: 0 });

    expect(component.simpleForm.valid).toBeFalse();
    expect(component.simpleForm.controls.amount.hasError('min')).toBeTrue();
  });

  it('validates installment total equals count times amount', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startCreateInstallment();
    component.installmentForm.patchValue({ totalAmount: 100, installmentCount: 3, installmentAmount: 20 });

    expect(component.installmentForm.hasError('installmentTotalMismatch')).toBeTrue();
  });

  it('hides edit and cancel for member viewing another participant expense', () => {
    const fixture = configure({ role: 'ACCOUNT_MEMBER', expenses: [{ ...ownExpense, participantId: 99 }] });

    expect(fixture.nativeElement.textContent).not.toContain('Editar');
    expect(fixture.nativeElement.textContent).not.toContain('Duplicar');
    expect(fixture.nativeElement.textContent).not.toContain('Cancelar');
  });

  it('blocks write actions for archived accounts', () => {
    const fixture = configure({ archived: true });

    expect(fixture.nativeElement.textContent).toContain('La cuenta esta archivada');
    expect(fixture.nativeElement.textContent).not.toContain('+ Gasto rápido');
    expect(fixture.nativeElement.textContent).not.toContain('Gasto simple');
    expect(fixture.nativeElement.textContent).not.toContain('Duplicar');
  });

  it('shows quick expense button for active accounts', () => {
    const fixture = configure();
    const button = findButton(fixture, '+ Gasto rápido');

    expect(button).toBeTruthy();
    expect(button?.disabled).toBeFalse();
  });

  it('does not render redundant detail actions because cards already show the expense data', () => {
    const fixture = configure();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Lunch');
    expect(text).toContain('2026-05-12');
    expect(text).toContain('Food');
    expect(text).toContain('Cash');
    expect(text).toContain('PAID');
    expect(text).toContain('ACTIVE');
    expect(text).toContain('SIMPLE');
    expect(findButton(fixture, 'Detalle')).toBeUndefined();
  });

  it('disables quick expense when categories are missing', () => {
    const fixture = configure({ categories: false });
    const button = findButton(fixture, '+ Gasto rápido');

    expect(button).toBeTruthy();
    expect(button?.disabled).toBeTrue();
  });

  it('disables quick expense when payment methods are missing', () => {
    const fixture = configure({ paymentMethods: false });
    const button = findButton(fixture, '+ Gasto rápido');

    expect(button).toBeTruthy();
    expect(button?.disabled).toBeTrue();
  });

  it('loads persisted filters on init', () => {
    const fixture = configure({
      persistedFilters: {
        from: '2026-05-01',
        to: '2026-05-31',
        search: 'lunch',
        categoryId: 1,
        paymentMethodId: 2,
        participantId: null,
        paymentState: 'PAID',
        status: 'CANCELLED',
        page: 0,
        size: 20,
        sort: 'expenseDate,desc'
      }
    });
    const raw = fixture.componentInstance.filterForm.getRawValue();

    expect(raw.from).toBe('2026-05-01');
    expect(raw.to).toBe('2026-05-31');
    expect(raw.search).toBe('lunch');
    expect(raw.categoryId).toBe('1');
    expect(raw.paymentMethodId).toBe('2');
    expect(raw.paymentState).toBe('PAID');
    expect(raw.status).toBe('CANCELLED');
  });

  it('opens quick expense panel and focuses amount', fakeAsync(() => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startQuickExpense();
    fixture.detectChanges();
    tick();

    expect(component.showQuickForm()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Gasto rápido');
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('input[formcontrolname="amount"]'));
  }));

  it('validates quick expense amount and required catalogs', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startQuickExpense();
    component.quickExpenseForm.patchValue({ amount: 0, categoryId: 0, paymentMethodId: 0 });

    expect(component.quickExpenseForm.valid).toBeFalse();
    expect(component.quickExpenseForm.controls.amount.hasError('min')).toBeTrue();
    expect(component.quickExpenseForm.controls.categoryId.hasError('min')).toBeTrue();
    expect(component.quickExpenseForm.controls.paymentMethodId.hasError('min')).toBeTrue();
  });

  it('sets quick expense defaults', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startQuickExpense();
    const raw = component.quickExpenseForm.getRawValue();

    expect(raw.categoryId).toBe(1);
    expect(raw.paymentMethodId).toBe(2);
    expect(raw.paymentState).toBe('PAID');
    expect(raw.expenseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('creates quick expense through the existing store endpoint', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    const store = TestBed.inject(ExpensesStore) as jasmine.SpyObj<ExpensesStore>;

    component.startQuickExpense();
    component.quickExpenseForm.patchValue({ amount: 25000 });
    component.saveQuickExpense();

    expect(store.createSimpleExpense).toHaveBeenCalledWith(1, jasmine.objectContaining({
      amount: 25000,
      categoryId: 1,
      paymentMethodId: 2,
      description: 'Gasto rápido',
      paymentState: 'PAID'
    }));
  });

  it('closes and resets quick expense after success', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startQuickExpense();
    component.quickExpenseForm.patchValue({ amount: 25000, description: 'Cafe' });
    component.saveQuickExpense();

    expect(component.showQuickForm()).toBeFalse();
    expect(component.successMessage()).toBe('Gasto registrado correctamente.');
    expect(component.quickExpenseForm.getRawValue().amount).toBe(0);
    expect(component.quickExpenseForm.getRawValue().description).toBe('');
  });

  it('shows quick expense errors from the store', () => {
    const fixture = configure({
      error: {
        code: 'EXPENSE_AMOUNT_INVALID',
        message: 'amount invalid'
      }
    });

    expect(fixture.nativeElement.textContent).toContain('El monto debe ser mayor que cero.');
  });

  it('does not double submit quick expense while saving', () => {
    const fixture = configure({ saving: true });
    const component = fixture.componentInstance;
    const store = TestBed.inject(ExpensesStore) as jasmine.SpyObj<ExpensesStore>;

    component.startQuickExpense();
    component.quickExpenseForm.patchValue({ amount: 25000 });
    component.saveQuickExpense();

    expect(store.createSimpleExpense).not.toHaveBeenCalled();
    fixture.detectChanges();
    expect(findButton(fixture, 'Guardando')?.disabled).toBeTrue();
  });

  it('shows duplicate action for admin and owner', () => {
    const adminFixture = configure({ role: 'ACCOUNT_ADMIN', userParticipantId: 99 });

    expect(adminFixture.nativeElement.textContent).toContain('Duplicar');

    TestBed.resetTestingModule();

    const ownerFixture = configure({ role: 'ACCOUNT_MEMBER', userParticipantId: 7 });

    expect(ownerFixture.nativeElement.textContent).toContain('Duplicar');
  });

  it('does not allow create when required catalogs are missing', () => {
    const fixture = configure({ catalogs: false });

    expect(fixture.componentInstance.hasRequiredCatalogs()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Necesitas al menos una categoria');
  });

  it('clears persisted filters and reloads defaults', () => {
    const fixture = configure();
    const store = TestBed.inject(ExpensesStore) as jasmine.SpyObj<ExpensesStore>;

    fixture.componentInstance.filterForm.patchValue({ search: 'lunch', from: '2026-05-01', status: 'CANCELLED' });
    fixture.componentInstance.clearFilters();

    expect(store.clearPersistedFilters).toHaveBeenCalledWith(1);
    expect(store.loadExpenses).toHaveBeenCalledWith(1, jasmine.objectContaining({ status: 'ACTIVE' }));
    expect(fixture.componentInstance.filterForm.getRawValue().status).toBe('ACTIVE');
    expect(fixture.componentInstance.filterForm.getRawValue().search).toBe('');
    expect(fixture.componentInstance.filterForm.getRawValue().from).toBe('');
  });

  it('applies filters from the first page', () => {
    const fixture = configure({ pagination: { page: 2, size: 20, totalElements: 60, totalPages: 3 } });
    const store = TestBed.inject(ExpensesStore) as jasmine.SpyObj<ExpensesStore>;

    store.loadExpenses.calls.reset();
    fixture.componentInstance.filterForm.patchValue({ search: '  lunch  ', from: '2026-05-01', status: 'CANCELLED' });
    fixture.componentInstance.applyFilters();

    expect(store.loadExpenses).toHaveBeenCalledWith(
      1,
      jasmine.objectContaining({ search: 'lunch', from: '2026-05-01', status: 'CANCELLED', page: 0 }),
      { persist: true }
    );
  });

  it('renders description search input in filters', () => {
    const fixture = configure();
    const searchInput = fixture.nativeElement.querySelector('input[formcontrolname="search"]') as HTMLInputElement | null;

    expect(fixture.nativeElement.textContent).toContain('Buscar descripcion');
    expect(searchInput?.placeholder).toBe('Buscar gasto por descripcion');
  });

  it('clears blank search when applying filters', () => {
    const fixture = configure();
    const store = TestBed.inject(ExpensesStore) as jasmine.SpyObj<ExpensesStore>;

    store.loadExpenses.calls.reset();
    fixture.componentInstance.filterForm.patchValue({ search: '   ' });
    fixture.componentInstance.applyFilters();

    expect(store.loadExpenses).toHaveBeenCalledWith(
      1,
      jasmine.objectContaining({ search: null, page: 0 }),
      { persist: true }
    );
  });

  it('renders pagination metadata and disables previous on first page', () => {
    const fixture = configure({ pagination: { page: 0, size: 20, totalElements: 45, totalPages: 3 } });

    expect(fixture.nativeElement.textContent).toContain('Pagina 1 de 3');
    expect(fixture.nativeElement.textContent).toContain('45 registros');
    expect(findButton(fixture, 'Anterior')?.disabled).toBeTrue();
    expect(findButton(fixture, 'Siguiente')?.disabled).toBeFalse();
  });

  it('loads previous and next pages while keeping current filters in the store', () => {
    const fixture = configure({ pagination: { page: 1, size: 20, totalElements: 45, totalPages: 3 } });
    const store = TestBed.inject(ExpensesStore) as jasmine.SpyObj<ExpensesStore>;

    store.loadExpenses.calls.reset();
    fixture.componentInstance.goToPreviousPage();

    expect(store.loadExpenses).toHaveBeenCalledWith(1, { page: 0 });

    store.loadExpenses.calls.reset();
    fixture.componentInstance.goToNextPage();

    expect(store.loadExpenses).toHaveBeenCalledWith(1, { page: 2 });
  });

  it('renders date sort controls with the active order selected', () => {
    const fixture = configure();
    const activeSortButton = fixture.nativeElement.querySelector('.sort-actions button.active') as HTMLButtonElement | null;

    expect(fixture.nativeElement.textContent).toContain('Ordenar por fecha');
    expect(fixture.nativeElement.textContent).toContain('Fecha ascendente');
    expect(fixture.nativeElement.textContent).toContain('Fecha descendente');
    expect(activeSortButton?.textContent).toContain('Fecha descendente');
    expect(activeSortButton?.getAttribute('aria-pressed')).toBe('true');
  });

  it('changes date sort from the first page while preserving current filters in the store', () => {
    const fixture = configure({
      pagination: { page: 2, size: 20, totalElements: 60, totalPages: 3 },
      persistedFilters: {
        from: '2026-05-01',
        to: null,
        search: 'lunch',
        categoryId: 1,
        paymentMethodId: null,
        participantId: null,
        paymentState: null,
        status: 'ACTIVE',
        page: 2,
        size: 20,
        sort: 'expenseDate,desc'
      }
    });
    const store = TestBed.inject(ExpensesStore) as jasmine.SpyObj<ExpensesStore>;

    store.loadExpenses.calls.reset();
    fixture.componentInstance.changeDateSort('expenseDate,asc');

    expect(store.loadExpenses).toHaveBeenCalledWith(1, { sort: 'expenseDate,asc', page: 0 }, { persist: true });
  });

  it('disables next on the last page', () => {
    const fixture = configure({ pagination: { page: 2, size: 20, totalElements: 45, totalPages: 3 } });

    expect(findButton(fixture, 'Anterior')?.disabled).toBeFalse();
    expect(findButton(fixture, 'Siguiente')?.disabled).toBeTrue();
  });

  it('does not show update or cancel actions for installment expenses', () => {
    const fixture = configure({ expenses: [{ ...ownExpense, expenseType: 'INSTALLMENT' }] });

    expect(fixture.nativeElement.textContent).not.toContain('Editar');
    expect(fixture.nativeElement.textContent).not.toContain('Duplicar');
    expect(fixture.nativeElement.textContent).not.toContain('Cancelar');
  });

  it('does not show duplicate for cancelled expenses', () => {
    const fixture = configure({ expenses: [{ ...ownExpense, status: 'CANCELLED' }] });

    expect(fixture.nativeElement.textContent).not.toContain('Duplicar');
  });

  it('prefills duplicate form with next month data', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startDuplicateExpense(ownExpense);

    expect(component.duplicateExpenseForm.getRawValue()).toEqual({
      expenseDate: '2026-06-12',
      amount: 10000,
      description: 'Lunch',
      paymentState: 'PAID'
    });
  });

  it('validates duplicate amount when provided', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startDuplicateExpense(ownExpense);
    component.duplicateExpenseForm.patchValue({ amount: -1 });

    expect(component.duplicateExpenseForm.valid).toBeFalse();
    expect(component.duplicateExpenseForm.controls.amount.hasError('min')).toBeTrue();
  });

  it('duplicates expense through the store', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    const store = TestBed.inject(ExpensesStore) as jasmine.SpyObj<ExpensesStore>;

    component.startDuplicateExpense(ownExpense);
    component.duplicateExpenseForm.patchValue({
      expenseDate: '2026-06-15',
      amount: 85000,
      description: 'Mercado junio',
      paymentState: 'PAID'
    });
    component.saveDuplicateExpense();

    expect(store.duplicateExpense).toHaveBeenCalledWith(1, 1, {
      expenseDate: '2026-06-15',
      amount: 85000,
      description: 'Mercado junio',
      paymentState: 'PAID'
    });
    expect(component.successMessage()).toBe('Gasto duplicado correctamente.');
    expect(component.selectedDetail()?.id).toBe(2);
  });

  it('shows duplicate not allowed error', () => {
    const fixture = configure({
      error: {
        code: 'EXPENSE_DUPLICATE_NOT_ALLOWED',
        message: 'not allowed'
      }
    });

    expect(fixture.nativeElement.textContent).toContain('Solo se pueden duplicar gastos simples activos.');
  });

  it('asks for confirmation before cancelling', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const fixture = configure();
    const store = TestBed.inject(ExpensesStore) as jasmine.SpyObj<ExpensesStore>;

    fixture.componentInstance.cancelExpense(ownExpense);

    expect(window.confirm).toHaveBeenCalled();
    expect(store.cancelExpense).toHaveBeenCalledWith(1, 1);
  });
});
