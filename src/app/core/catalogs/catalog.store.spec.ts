import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { CatalogsApiService } from './catalogs-api.service';
import { CatalogStore } from './catalog.store';

describe('CatalogStore', () => {
  const category = {
    id: 1,
    accountId: 10,
    name: 'Food',
    description: null,
    type: 'EXPENSE' as const,
    status: 'ACTIVE' as const,
    createdAt: '',
    updatedAt: ''
  };

  const paymentMethod = {
    id: 2,
    accountId: 10,
    name: 'Cash',
    description: null,
    type: 'CASH' as const,
    status: 'ACTIVE' as const,
    createdAt: '',
    updatedAt: ''
  };

  let service: jasmine.SpyObj<CatalogsApiService>;
  let store: CatalogStore;

  beforeEach(() => {
    localStorage.clear();
    service = jasmine.createSpyObj<CatalogsApiService>('CatalogsApiService', [
      'listCategories',
      'listPaymentMethods',
      'deactivateCategory'
    ]);
    service.listCategories.and.returnValue(of({ content: [category], page: 0, size: 20, totalElements: 1, totalPages: 1 }));
    service.listPaymentMethods.and.returnValue(
      of({ content: [paymentMethod], page: 0, size: 20, totalElements: 1, totalPages: 1 })
    );
    service.deactivateCategory.and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [CatalogStore, { provide: CatalogsApiService, useValue: service }]
    });

    store = TestBed.inject(CatalogStore);
  });

  afterEach(() => localStorage.clear());

  it('loads categories and payment methods', (done) => {
    store.refreshAll(10).subscribe(() => {
      expect(store.categories()).toEqual([category]);
      expect(store.paymentMethods()).toEqual([paymentMethod]);
      done();
    });
  });

  it('deactivates a category and refreshes the list', (done) => {
    store.deactivateCategory(10, 1).subscribe(() => {
      expect(service.deactivateCategory).toHaveBeenCalledWith(10, 1);
      expect(service.listCategories).toHaveBeenCalled();
      done();
    });
  });

  it('clears previous catalog data when account changes', (done) => {
    store.loadCategories(10).subscribe(() => {
      expect(store.categories().length).toBe(1);

      service.listCategories.and.returnValue(of({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
      store.loadCategories(11).subscribe(() => {
        expect(store.categories()).toEqual([]);
        done();
      });
    });
  });

  it('applies and trims category search', (done) => {
    store.loadCategories(10, { search: ' food ', page: 2 }).subscribe(() => {
      expect(store.categoryFilters().search).toBe('food');
      expect(store.categoryFilters().page).toBe(0);
      expect(service.listCategories).toHaveBeenCalledWith(10, jasmine.objectContaining({ search: 'food' }));
      done();
    });
  });

  it('clears payment method search', (done) => {
    store.loadPaymentMethods(10, { search: 'cash' }).subscribe(() => {
      expect(store.paymentMethodFilters().search).toBe('cash');

      store.loadPaymentMethods(10, { search: '   ' }).subscribe(() => {
        expect(store.paymentMethodFilters().search).toBeNull();
        expect(service.listPaymentMethods).toHaveBeenCalledWith(10, jasmine.objectContaining({ search: null }));
        done();
      });
    });
  });

  it('loads persisted category and payment method filters per account', () => {
    localStorage.setItem(
      'easyFinance.filters.catalogs.categories.10',
      JSON.stringify({ search: ' food ', type: 'EXPENSE', status: 'INACTIVE', sort: 'name,desc' })
    );
    localStorage.setItem(
      'easyFinance.filters.catalogs.paymentMethods.10',
      JSON.stringify({ search: 'cash', type: 'CASH', status: 'ACTIVE' })
    );
    localStorage.setItem('easyFinance.filters.catalogs.categories.11', JSON.stringify({ search: 'salary', type: 'INCOME' }));

    expect(store.loadPersistedCategoryFilters(10)).toEqual(jasmine.objectContaining({
      search: 'food',
      type: 'EXPENSE',
      status: 'INACTIVE',
      sort: 'name,desc'
    }));
    expect(store.loadPersistedPaymentMethodFilters(10)).toEqual(jasmine.objectContaining({ search: 'cash', type: 'CASH' }));
    expect(store.loadPersistedCategoryFilters(11)).toEqual(jasmine.objectContaining({ search: 'salary', type: 'INCOME' }));
  });

  it('persists and clears category filters', (done) => {
    store.loadCategories(10, { search: 'food', type: 'EXPENSE' }, { persist: true }).subscribe(() => {
      expect(JSON.parse(localStorage.getItem('easyFinance.filters.catalogs.categories.10') ?? '{}')).toEqual(jasmine.objectContaining({
        search: 'food',
        type: 'EXPENSE'
      }));

      store.clearPersistedCategoryFilters(10);

      expect(localStorage.getItem('easyFinance.filters.catalogs.categories.10')).toBeNull();
      expect(store.categoryFilters()).toEqual(jasmine.objectContaining({ search: null, type: null, status: 'ACTIVE' }));
      done();
    });
  });

  it('persists and clears payment method filters', (done) => {
    store.loadPaymentMethods(10, { search: 'cash', type: 'CASH' }, { persist: true }).subscribe(() => {
      expect(JSON.parse(localStorage.getItem('easyFinance.filters.catalogs.paymentMethods.10') ?? '{}')).toEqual(
        jasmine.objectContaining({ search: 'cash', type: 'CASH' })
      );

      store.clearPersistedPaymentMethodFilters(10);

      expect(localStorage.getItem('easyFinance.filters.catalogs.paymentMethods.10')).toBeNull();
      expect(store.paymentMethodFilters()).toEqual(jasmine.objectContaining({ search: null, type: null, status: 'ACTIVE' }));
      done();
    });
  });
});
