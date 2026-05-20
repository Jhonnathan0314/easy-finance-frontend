import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthStore } from '../../core/auth/auth.store';
import { CatalogsApiService } from '../../core/catalogs/catalogs-api.service';
import { IncomeFilters, IncomeStore } from '../../core/income/income.store';
import { AccountStore } from '../../core/state/account.store';
import { AccountResponseDto, CategoryResponseDto, IncomeResponseDto } from '../../shared/models';
import { IncomePageComponent } from './income-page.component';

describe('IncomePageComponent', () => {
  const category: CategoryResponseDto = {
    id: 1,
    accountId: 1,
    name: 'Salary',
    description: null,
    type: 'INCOME',
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: ''
  };
  const income: IncomeResponseDto = {
    id: 1,
    accountId: 1,
    categoryId: 1,
    participantId: 7,
    description: 'Salary May',
    amount: 3000000,
    currency: 'COP',
    incomeDate: '2026-05-12',
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: ''
  };
  const defaultFilters: IncomeFilters = {
    from: null,
    to: null,
    search: null,
    categoryId: null,
    participantId: null,
    status: 'ACTIVE' as const,
    page: 0,
    size: 20,
    sort: 'incomeDate,desc'
  };

  function configure(
    options: {
      role?: 'ACCOUNT_ADMIN' | 'ACCOUNT_MEMBER';
      archived?: boolean;
      incomes?: IncomeResponseDto[];
      categories?: boolean;
      userParticipantId?: number;
      error?: { code: string; message: string };
      persistedFilters?: IncomeFilters;
      pagination?: { page: number; size: number; totalElements: number; totalPages: number };
    } = {}
  ): ComponentFixture<IncomePageComponent> {
    const account: AccountResponseDto = {
      id: 1,
      name: 'Casa',
      description: null,
      status: options.archived ? 'ARCHIVED' : 'ACTIVE',
      currentUserRole: options.role ?? 'ACCOUNT_ADMIN',
      createdAt: '',
      updatedAt: ''
    };
    const incomes = options.incomes ?? [income];
    const hasCategories = options.categories ?? true;

    TestBed.configureTestingModule({
      imports: [IncomePageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { user: signal({ participantId: options.userParticipantId ?? 7 }) } },
        {
          provide: AccountStore,
          useValue: {
            selectedAccountId: signal(1),
            selectedAccount: signal(account),
            selectedAccountArchived: signal(options.archived ?? false)
          }
        },
        {
          provide: CatalogsApiService,
          useValue: {
            listCategories: jasmine.createSpy('listCategories').and.returnValue(
              of({ content: hasCategories ? [category] : [], page: 0, size: 20, totalElements: hasCategories ? 1 : 0, totalPages: 1 })
            )
          }
        },
        {
          provide: IncomeStore,
          useValue: {
            incomes: signal(incomes),
            selectedIncome: signal(null),
            isLoading: signal(false),
            isSaving: signal(false),
            error: signal(options.error ?? null),
            filters: signal(options.persistedFilters ?? defaultFilters),
            pagination: signal(options.pagination ?? { page: 0, size: 20, totalElements: incomes.length, totalPages: incomes.length ? 1 : 0 }),
            loadPersistedFilters: jasmine.createSpy('loadPersistedFilters').and.returnValue(options.persistedFilters ?? defaultFilters),
            clearPersistedFilters: jasmine.createSpy('clearPersistedFilters').and.returnValue(defaultFilters),
            loadIncomes: jasmine.createSpy('loadIncomes').and.returnValue(of(incomes)),
            createIncome: jasmine.createSpy('createIncome').and.returnValue(of(incomes)),
            updateIncome: jasmine.createSpy('updateIncome').and.returnValue(of(incomes)),
            duplicateIncome: jasmine.createSpy('duplicateIncome').and.returnValue(of({ ...income, id: 2, incomeDate: '2026-06-12' })),
            cancelIncome: jasmine.createSpy('cancelIncome').and.returnValue(of([])),
            getIncome: jasmine.createSpy('getIncome').and.returnValue(of(income))
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(IncomePageComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('validates required fields and minimum amount', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startCreateIncome();
    component.incomeForm.patchValue({ categoryId: 0, description: '', amount: 0, incomeDate: '' });

    expect(component.incomeForm.valid).toBeFalse();
    expect(component.incomeForm.controls.categoryId.hasError('min')).toBeTrue();
    expect(component.incomeForm.controls.description.hasError('required')).toBeTrue();
    expect(component.incomeForm.controls.amount.hasError('min')).toBeTrue();
  });

  it('hides edit and cancel for member viewing another participant income', () => {
    const fixture = configure({ role: 'ACCOUNT_MEMBER', incomes: [{ ...income, participantId: 99 }] });

    expect(fixture.nativeElement.textContent).not.toContain('Editar');
    expect(fixture.nativeElement.textContent).not.toContain('Duplicar');
    expect(fixture.nativeElement.textContent).not.toContain('Cancelar');
  });

  it('does not render redundant detail action because cards already show the income data', () => {
    const fixture = configure();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Salary May');
    expect(text).toContain('2026-05-12');
    expect(text).toContain('Salary');
    expect(text).toContain('Participante 7');
    expect(text).toContain('ACTIVE');
    expect(text).not.toContain('Detalle');
  });

  it('blocks write actions for archived accounts', () => {
    const fixture = configure({ archived: true });

    expect(fixture.nativeElement.textContent).toContain('La cuenta esta archivada');
    expect(fixture.nativeElement.textContent).not.toContain('Crear ingreso');
    expect(fixture.nativeElement.textContent).not.toContain('Duplicar');
  });

  it('shows duplicate action for admin and owner', () => {
    const adminFixture = configure({ role: 'ACCOUNT_ADMIN', userParticipantId: 99 });

    expect(adminFixture.nativeElement.textContent).toContain('Duplicar');

    TestBed.resetTestingModule();

    const ownerFixture = configure({ role: 'ACCOUNT_MEMBER', userParticipantId: 7 });

    expect(ownerFixture.nativeElement.textContent).toContain('Duplicar');
  });

  it('does not allow create when income categories are missing', () => {
    const fixture = configure({ categories: false });

    expect(fixture.componentInstance.hasRequiredCatalogs()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Necesitas al menos una categoria INCOME activa');
  });

  it('creates income through the store', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    const store = TestBed.inject(IncomeStore) as jasmine.SpyObj<IncomeStore>;

    component.startCreateIncome();
    component.incomeForm.patchValue({ categoryId: 1, description: 'Bonus', amount: 100000, incomeDate: '2026-05-12' });
    component.saveIncome();

    expect(store.createIncome).toHaveBeenCalledWith(1, {
      categoryId: 1,
      description: 'Bonus',
      amount: 100000,
      incomeDate: '2026-05-12'
    });
  });

  it('loads persisted filters on init', () => {
    const fixture = configure({
      persistedFilters: {
        ...defaultFilters,
        from: '2026-05-01',
        to: '2026-05-31',
        search: 'salary',
        categoryId: 1,
        participantId: 7,
        status: 'CANCELLED'
      }
    });
    const component = fixture.componentInstance;
    const store = TestBed.inject(IncomeStore) as jasmine.SpyObj<IncomeStore>;

    expect(store.loadPersistedFilters).toHaveBeenCalledWith(1);
    expect(component.filterForm.getRawValue()).toEqual({
      search: 'salary',
      from: '2026-05-01',
      to: '2026-05-31',
      categoryId: '1'
    });
  });

  it('persists filters when applying and clears storage on reset', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    const store = TestBed.inject(IncomeStore) as jasmine.SpyObj<IncomeStore>;

    store.loadIncomes.calls.reset();
    component.filterForm.patchValue({ search: '  salary  ', from: '2026-05-01', to: '2026-05-31', categoryId: '1' });
    component.applyFilters();

    expect(store.loadIncomes).toHaveBeenCalledWith(
      1,
      jasmine.objectContaining({ search: 'salary', from: '2026-05-01', categoryId: 1, page: 0 }),
      { persist: true }
    );
    const appliedFilters = store.loadIncomes.calls.mostRecent().args[1] as Record<string, unknown>;
    expect('participantId' in appliedFilters).toBeFalse();
    expect('status' in appliedFilters).toBeFalse();

    store.loadIncomes.calls.reset();
    component.clearFilters();

    expect(store.clearPersistedFilters).toHaveBeenCalledWith(1);
    expect(component.filterForm.getRawValue()).toEqual({
      search: '',
      from: '',
      to: '',
      categoryId: ''
    });
    expect(store.loadIncomes).toHaveBeenCalledWith(1, {
      search: null,
      from: null,
      to: null,
      categoryId: null,
      page: 0,
      sort: 'incomeDate,desc'
    });
  });

  it('does not render confusing participant or status filter controls', () => {
    const fixture = configure();
    const filters = fixture.nativeElement.querySelector('.filters') as HTMLElement;

    expect(filters.textContent).not.toContain('Participante');
    expect(filters.textContent).not.toContain('Status');
    expect(filters.querySelector('input[formcontrolname="participantId"]')).toBeNull();
    expect(filters.querySelector('select[formcontrolname="status"]')).toBeNull();
  });

  it('renders description search input in filters', () => {
    const fixture = configure();
    const searchInput = fixture.nativeElement.querySelector('input[formcontrolname="search"]') as HTMLInputElement | null;

    expect(fixture.nativeElement.textContent).toContain('Buscar descripcion');
    expect(searchInput?.placeholder).toBe('Buscar ingreso por descripcion');
  });

  it('clears blank search when applying filters', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    const store = TestBed.inject(IncomeStore) as jasmine.SpyObj<IncomeStore>;

    store.loadIncomes.calls.reset();
    component.filterForm.patchValue({ search: '   ' });
    component.applyFilters();

    expect(store.loadIncomes).toHaveBeenCalledWith(
      1,
      jasmine.objectContaining({ search: null, page: 0 }),
      { persist: true }
    );
  });

  it('renders pagination metadata and disables previous on first page', () => {
    const fixture = configure({ pagination: { page: 0, size: 20, totalElements: 45, totalPages: 3 } });
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const previous = buttons.find((button) => button.textContent?.includes('Anterior'));
    const next = buttons.find((button) => button.textContent?.includes('Siguiente'));

    expect(fixture.nativeElement.textContent).toContain('Pagina 1 de 3');
    expect(fixture.nativeElement.textContent).toContain('45 registros');
    expect(previous?.disabled).toBeTrue();
    expect(next?.disabled).toBeFalse();
  });

  it('renders pagination controls above and below the income list', () => {
    const fixture = configure({ pagination: { page: 1, size: 20, totalElements: 45, totalPages: 3 } });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('nav[aria-label="Paginacion superior de ingresos"]')).toBeTruthy();
    expect(root.querySelector('nav[aria-label="Paginacion inferior de ingresos"]')).toBeTruthy();
    expect(root.querySelectorAll('.pagination-actions').length).toBe(2);
    expect(root.textContent).toContain('Tamano pagina');
  });

  it('renders page size selector with the current size selected', () => {
    const fixture = configure({ pagination: { page: 0, size: 50, totalElements: 75, totalPages: 2 } });
    const sizeSelect = fixture.nativeElement.querySelector(
      'nav[aria-label="Paginacion superior de ingresos"] select'
    ) as HTMLSelectElement | null;

    expect(Array.from(sizeSelect?.options ?? []).map((option) => option.value)).toEqual(['10', '20', '50', '100']);
    expect(sizeSelect?.value).toBe('50');
  });

  it('changes page size from the first page while keeping current filters in the store', () => {
    const fixture = configure({
      pagination: { page: 2, size: 20, totalElements: 80, totalPages: 4 },
      persistedFilters: {
        ...defaultFilters,
        from: '2026-05-01',
        to: '2026-05-31',
        search: 'salary',
        categoryId: 1,
        page: 2,
        size: 20,
        sort: 'incomeDate,asc'
      }
    });
    const store = TestBed.inject(IncomeStore) as jasmine.SpyObj<IncomeStore>;

    store.loadIncomes.calls.reset();
    fixture.componentInstance.changePageSize('50');

    expect(store.loadIncomes).toHaveBeenCalledWith(1, { size: 50, page: 0 });
  });

  it('keeps page size when applying filters and resets it when clearing filters', () => {
    const fixture = configure({ pagination: { page: 2, size: 50, totalElements: 80, totalPages: 2 } });
    const store = TestBed.inject(IncomeStore) as jasmine.SpyObj<IncomeStore>;

    store.loadIncomes.calls.reset();
    fixture.componentInstance.applyFilters();

    expect(store.loadIncomes).toHaveBeenCalledWith(
      1,
      jasmine.objectContaining({ page: 0 }),
      { persist: true }
    );
    expect(store.loadIncomes.calls.mostRecent().args[1]).not.toEqual(jasmine.objectContaining({ size: 20 }));

    store.loadIncomes.calls.reset();
    fixture.componentInstance.clearFilters();

    expect(store.loadIncomes).toHaveBeenCalledWith(1, jasmine.objectContaining({ page: 0, sort: 'incomeDate,desc' }));
    expect(store.loadIncomes.calls.mostRecent().args[1]).not.toEqual(jasmine.objectContaining({ participantId: jasmine.anything() }));
    expect(store.loadIncomes.calls.mostRecent().args[1]).not.toEqual(jasmine.objectContaining({ status: jasmine.anything() }));
  });

  it('loads previous and next pages while keeping current filters in the store', () => {
    const fixture = configure({ pagination: { page: 1, size: 20, totalElements: 45, totalPages: 3 } });
    const store = TestBed.inject(IncomeStore) as jasmine.SpyObj<IncomeStore>;

    store.loadIncomes.calls.reset();
    fixture.componentInstance.goToPreviousPage();

    expect(store.loadIncomes).toHaveBeenCalledWith(1, { page: 0 });

    store.loadIncomes.calls.reset();
    fixture.componentInstance.goToNextPage();

    expect(store.loadIncomes).toHaveBeenCalledWith(1, { page: 2 });
  });

  it('bottom pagination buttons load pages too', () => {
    const fixture = configure({ pagination: { page: 1, size: 20, totalElements: 45, totalPages: 3 } });
    const store = TestBed.inject(IncomeStore) as jasmine.SpyObj<IncomeStore>;
    const bottomButtons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('nav[aria-label="Paginacion inferior de ingresos"] button')
    ) as HTMLButtonElement[];

    store.loadIncomes.calls.reset();
    bottomButtons.find((button) => button.textContent?.includes('Anterior'))?.click();

    expect(store.loadIncomes).toHaveBeenCalledWith(1, { page: 0 });

    store.loadIncomes.calls.reset();
    bottomButtons.find((button) => button.textContent?.includes('Siguiente'))?.click();

    expect(store.loadIncomes).toHaveBeenCalledWith(1, { page: 2 });
  });

  it('disables next on the last page', () => {
    const fixture = configure({ pagination: { page: 2, size: 20, totalElements: 45, totalPages: 3 } });
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const previous = buttons.find((button) => button.textContent?.includes('Anterior'));
    const next = buttons.find((button) => button.textContent?.includes('Siguiente'));

    expect(previous?.disabled).toBeFalse();
    expect(next?.disabled).toBeTrue();
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
        ...defaultFilters,
        from: '2026-05-01',
        search: 'salary',
        categoryId: 1,
        page: 2,
        sort: 'incomeDate,desc'
      }
    });
    const store = TestBed.inject(IncomeStore) as jasmine.SpyObj<IncomeStore>;

    store.loadIncomes.calls.reset();
    fixture.componentInstance.changeDateSort('incomeDate,asc');

    expect(store.loadIncomes).toHaveBeenCalledWith(1, { sort: 'incomeDate,asc', page: 0 }, { persist: true });
  });

  it('asks for confirmation before cancelling', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const fixture = configure();
    const store = TestBed.inject(IncomeStore) as jasmine.SpyObj<IncomeStore>;

    fixture.componentInstance.cancelIncome(income);

    expect(window.confirm).toHaveBeenCalled();
    expect(store.cancelIncome).toHaveBeenCalledWith(1, 1);
  });

  it('does not show edit or cancel for cancelled income', () => {
    const fixture = configure({ incomes: [{ ...income, status: 'CANCELLED' }] });

    expect(fixture.nativeElement.textContent).not.toContain('Editar');
    expect(fixture.nativeElement.textContent).not.toContain('Duplicar');
    expect(fixture.nativeElement.textContent).not.toContain('Cancelar');
  });

  it('prefills duplicate form with next month date', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startDuplicateIncome(income);

    expect(component.duplicateIncomeForm.getRawValue()).toEqual({
      incomeDate: '2026-06-12',
      amount: 3000000,
      description: 'Salary May'
    });
  });

  it('validates duplicate amount when provided', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startDuplicateIncome(income);
    component.duplicateIncomeForm.patchValue({ amount: -1 });

    expect(component.duplicateIncomeForm.valid).toBeFalse();
    expect(component.duplicateIncomeForm.controls.amount.hasError('min')).toBeTrue();
  });

  it('duplicates income through the store', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    const store = TestBed.inject(IncomeStore) as jasmine.SpyObj<IncomeStore>;

    component.startDuplicateIncome(income);
    component.duplicateIncomeForm.patchValue({
      incomeDate: '2026-06-30',
      amount: 5200000,
      description: 'Nomina junio'
    });
    component.saveDuplicateIncome();

    expect(store.duplicateIncome).toHaveBeenCalledWith(1, 1, {
      incomeDate: '2026-06-30',
      amount: 5200000,
      description: 'Nomina junio'
    });
    expect(component.successMessage()).toBe('Ingreso duplicado correctamente.');
    expect(component.selectedDetail()?.id).toBe(2);
  });

  it('shows duplicate not allowed error', () => {
    const fixture = configure({
      error: {
        code: 'INCOME_DUPLICATE_NOT_ALLOWED',
        message: 'not allowed'
      }
    });

    expect(fixture.nativeElement.textContent).toContain('No se puede duplicar un ingreso cancelado.');
  });

  it('shows empty state', () => {
    const fixture = configure({ incomes: [] });

    expect(fixture.nativeElement.textContent).toContain('No hay ingresos para los filtros actuales');
  });
});
