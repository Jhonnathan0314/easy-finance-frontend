import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { CatalogStore, CategoryFilters, PaymentMethodFilters } from '../../core/catalogs/catalog.store';
import { AccountStore } from '../../core/state/account.store';
import { CatalogsPageComponent } from './catalogs-page.component';

describe('CatalogsPageComponent', () => {
  const adminAccount = {
    id: 1,
    name: 'Casa',
    description: null,
    status: 'ACTIVE',
    currentUserRole: 'ACCOUNT_ADMIN',
    createdAt: '',
    updatedAt: ''
  };
  const defaultCategoryFilters: CategoryFilters = {
    search: null,
    type: null,
    status: 'ACTIVE',
    page: 0,
    size: 20,
    sort: 'name,asc'
  };
  const defaultPaymentMethodFilters: PaymentMethodFilters = {
    search: null,
    type: null,
    status: 'ACTIVE',
    page: 0,
    size: 20,
    sort: 'name,asc'
  };

  function configure(
    role: 'ACCOUNT_ADMIN' | 'ACCOUNT_MEMBER' = 'ACCOUNT_ADMIN',
    archived = false,
    options: {
      categorySearch?: string | null;
      paymentMethodSearch?: string | null;
      categoryFilters?: CategoryFilters;
      paymentMethodFilters?: PaymentMethodFilters;
    } = {}
  ): ComponentFixture<CatalogsPageComponent> {
    const account = { ...adminAccount, currentUserRole: role, status: archived ? 'ARCHIVED' : 'ACTIVE' };

    TestBed.configureTestingModule({
      imports: [CatalogsPageComponent],
      providers: [
        {
          provide: AccountStore,
          useValue: {
            selectedAccountId: signal(1),
            selectedAccount: signal(account),
            selectedAccountArchived: signal(archived)
          }
        },
        {
          provide: CatalogStore,
          useValue: {
            categories: signal([]),
            paymentMethods: signal([]),
            isLoadingCategories: signal(false),
            isLoadingPaymentMethods: signal(false),
            categoryFilters: signal(options.categoryFilters ?? { ...defaultCategoryFilters, search: options.categorySearch ?? null }),
            paymentMethodFilters: signal(
              options.paymentMethodFilters ?? { ...defaultPaymentMethodFilters, search: options.paymentMethodSearch ?? null }
            ),
            error: signal(null),
            loadPersistedCategoryFilters: jasmine
              .createSpy('loadPersistedCategoryFilters')
              .and.returnValue(options.categoryFilters ?? { ...defaultCategoryFilters, search: options.categorySearch ?? null }),
            loadPersistedPaymentMethodFilters: jasmine
              .createSpy('loadPersistedPaymentMethodFilters')
              .and.returnValue(options.paymentMethodFilters ?? { ...defaultPaymentMethodFilters, search: options.paymentMethodSearch ?? null }),
            clearPersistedCategoryFilters: jasmine.createSpy('clearPersistedCategoryFilters').and.returnValue(defaultCategoryFilters),
            clearPersistedPaymentMethodFilters: jasmine
              .createSpy('clearPersistedPaymentMethodFilters')
              .and.returnValue(defaultPaymentMethodFilters),
            refreshAll: jasmine.createSpy('refreshAll').and.returnValue(of([[], []])),
            loadCategories: jasmine.createSpy('loadCategories').and.returnValue(of([])),
            loadPaymentMethods: jasmine.createSpy('loadPaymentMethods').and.returnValue(of([])),
            createCategory: jasmine.createSpy('createCategory').and.returnValue(of([])),
            updateCategory: jasmine.createSpy('updateCategory').and.returnValue(of([])),
            deactivateCategory: jasmine.createSpy('deactivateCategory').and.returnValue(of([])),
            createPaymentMethod: jasmine.createSpy('createPaymentMethod').and.returnValue(of([])),
            updatePaymentMethod: jasmine.createSpy('updatePaymentMethod').and.returnValue(of([])),
            deactivatePaymentMethod: jasmine.createSpy('deactivatePaymentMethod').and.returnValue(of([]))
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(CatalogsPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('validates required category name', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startCreateCategory();
    component.categoryForm.patchValue({ name: '' });

    expect(component.categoryForm.valid).toBeFalse();
    expect(component.categoryForm.controls.name.hasError('required')).toBeTrue();
  });

  it('validates required payment method type', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startCreatePaymentMethod();
    component.paymentMethodForm.controls.type.setValue('' as never);

    expect(component.paymentMethodForm.valid).toBeFalse();
    expect(component.paymentMethodForm.controls.type.hasError('required')).toBeTrue();
  });

  it('hides admin actions for account members', () => {
    const fixture = configure('ACCOUNT_MEMBER');

    expect(fixture.nativeElement.textContent).toContain('Solo lectura');
    expect(fixture.nativeElement.textContent).not.toContain('Nueva categoria');
  });

  it('blocks write actions when account is archived', () => {
    const fixture = configure('ACCOUNT_ADMIN', true);

    expect(fixture.nativeElement.textContent).toContain('La cuenta esta archivada');
    expect(fixture.nativeElement.textContent).not.toContain('Nueva categoria');
  });

  it('renders search inputs', () => {
    const fixture = configure();
    const text = fixture.nativeElement.textContent;

    expect(fixture.nativeElement.querySelector('input[placeholder="Buscar categoría por nombre o descripción"]')).not.toBeNull();
    expect(text).toContain('Filtrar');

    fixture.componentInstance.activeTab.set('paymentMethods');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input[placeholder="Buscar medio por nombre o descripción"]')).not.toBeNull();
  });

  it('renders aligned filter actions for categories and payment methods', () => {
    const fixture = configure();
    let actions = fixture.nativeElement.querySelector('.filter-actions');

    expect(actions?.textContent).toContain('Filtrar');
    expect(actions?.textContent).toContain('Limpiar filtros');

    fixture.componentInstance.activeTab.set('paymentMethods');
    fixture.detectChanges();
    actions = fixture.nativeElement.querySelector('.filter-actions');

    expect(actions?.textContent).toContain('Filtrar');
    expect(actions?.textContent).toContain('Limpiar filtros');
  });

  it('applies category search on submit', () => {
    const fixture = configure();
    const store = TestBed.inject(CatalogStore) as jasmine.SpyObj<CatalogStore>;

    fixture.componentInstance.categoryFilterForm.patchValue({ search: ' food ', type: 'EXPENSE', status: 'ACTIVE' });
    fixture.componentInstance.applyCategoryFilters();

    expect(store.loadCategories).toHaveBeenCalledWith(1, { search: ' food ', type: 'EXPENSE', status: 'ACTIVE' }, { persist: true });
  });

  it('clears category search and reloads', () => {
    const fixture = configure();
    const store = TestBed.inject(CatalogStore) as jasmine.SpyObj<CatalogStore>;

    fixture.componentInstance.categoryFilterForm.patchValue({ search: 'food', type: 'EXPENSE', status: 'INACTIVE' });
    fixture.componentInstance.clearCategoryFilters();

    expect(fixture.componentInstance.categoryFilterForm.getRawValue()).toEqual({ search: '', type: '', status: 'ACTIVE' });
    expect(store.clearPersistedCategoryFilters).toHaveBeenCalledWith(1);
    expect(store.loadCategories).toHaveBeenCalledWith(1);
  });

  it('shows search empty state text when search is active', () => {
    const fixture = configure('ACCOUNT_ADMIN', false, { categorySearch: 'food' });

    expect(fixture.nativeElement.textContent).toContain('Sin resultados para la búsqueda');
  });
  it('loads persisted filters for categories and payment methods on init', () => {
    const fixture = configure('ACCOUNT_ADMIN', false, {
      categoryFilters: { ...defaultCategoryFilters, search: 'food', type: 'EXPENSE', status: 'INACTIVE' },
      paymentMethodFilters: { ...defaultPaymentMethodFilters, search: 'cash', type: 'CASH' }
    });
    const component = fixture.componentInstance;
    const store = TestBed.inject(CatalogStore) as jasmine.SpyObj<CatalogStore>;

    expect(store.loadPersistedCategoryFilters).toHaveBeenCalledWith(1);
    expect(store.loadPersistedPaymentMethodFilters).toHaveBeenCalledWith(1);
    expect(component.categoryFilterForm.getRawValue()).toEqual({ search: 'food', type: 'EXPENSE', status: 'INACTIVE' });
    expect(component.paymentMethodFilterForm.getRawValue()).toEqual({ search: 'cash', type: 'CASH', status: 'ACTIVE' });
  });

  it('persists payment method filters and clears them independently', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    const store = TestBed.inject(CatalogStore) as jasmine.SpyObj<CatalogStore>;

    component.activeTab.set('paymentMethods');
    component.paymentMethodFilterForm.patchValue({ search: ' cash ', type: 'CASH', status: 'ACTIVE' });
    component.applyPaymentMethodFilters();

    expect(store.loadPaymentMethods).toHaveBeenCalledWith(
      1,
      { search: ' cash ', type: 'CASH', status: 'ACTIVE' },
      { persist: true }
    );

    store.loadPaymentMethods.calls.reset();
    component.clearPaymentMethodFilters();

    expect(store.clearPersistedPaymentMethodFilters).toHaveBeenCalledWith(1);
    expect(component.paymentMethodFilterForm.getRawValue()).toEqual({ search: '', type: '', status: 'ACTIVE' });
    expect(store.loadPaymentMethods).toHaveBeenCalledWith(1);
  });
});
