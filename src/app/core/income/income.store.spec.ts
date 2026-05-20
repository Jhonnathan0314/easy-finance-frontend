import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { IncomeResponseDto } from '../../shared/models';
import { IncomeApiService } from './income-api.service';
import { IncomeStore } from './income.store';

describe('IncomeStore', () => {
  const income: IncomeResponseDto = {
    id: 1,
    accountId: 10,
    categoryId: 2,
    participantId: 7,
    description: 'Salary',
    amount: 3000000,
    currency: 'COP',
    incomeDate: '2026-05-12',
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: ''
  };

  let service: jasmine.SpyObj<IncomeApiService>;
  let store: IncomeStore;

  beforeEach(() => {
    localStorage.clear();
    service = jasmine.createSpyObj<IncomeApiService>('IncomeApiService', [
      'listIncomes',
      'createIncome',
      'getIncome',
      'updateIncome',
      'duplicateIncome',
      'cancelIncome'
    ]);
    service.listIncomes.and.returnValue(of({ content: [income], page: 0, size: 20, totalElements: 1, totalPages: 1 }));
    service.createIncome.and.returnValue(of(income));
    service.getIncome.and.returnValue(of(income));
    service.updateIncome.and.returnValue(of({ ...income, amount: 3500000 }));
    service.duplicateIncome.and.returnValue(of({ ...income, id: 2, incomeDate: '2026-06-12' }));
    service.cancelIncome.and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [IncomeStore, { provide: IncomeApiService, useValue: service }]
    });

    store = TestBed.inject(IncomeStore);
  });

  afterEach(() => localStorage.clear());

  it('loads incomes and clears stale data when account changes', (done) => {
    store.getIncome(10, 1).subscribe(() => {
      expect(store.selectedIncome()).toEqual(income);
      service.listIncomes.and.returnValue(of({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));

      store.loadIncomes(11).subscribe(() => {
        expect(store.incomes()).toEqual([]);
        expect(store.selectedIncome()).toBeNull();
        done();
      });
    });
  });

  it('creates income and refreshes list', (done) => {
    store.createIncome(10, { categoryId: 2, description: 'Salary', amount: 3000000, incomeDate: '2026-05-12' }).subscribe(() => {
      expect(service.createIncome).toHaveBeenCalled();
      expect(service.listIncomes).toHaveBeenCalled();
      done();
    });
  });

  it('stores pagination metadata and preserves filters when changing page', (done) => {
    service.listIncomes.and.returnValue(of({ content: [income], page: 2, size: 20, totalElements: 45, totalPages: 3 }));

    store.loadIncomes(10, { from: '2026-05-01', search: 'salary', page: 2 }).subscribe(() => {
      expect(store.pagination()).toEqual({ page: 2, size: 20, totalElements: 45, totalPages: 3 });
      expect(service.listIncomes).toHaveBeenCalledWith(10, jasmine.objectContaining({ from: '2026-05-01', search: 'salary', page: 2 }));

      service.listIncomes.calls.reset();
      service.listIncomes.and.returnValue(of({ content: [income], page: 1, size: 20, totalElements: 45, totalPages: 3 }));

      store.loadIncomes(10, { page: 1 }).subscribe(() => {
        expect(service.listIncomes).toHaveBeenCalledWith(10, jasmine.objectContaining({ from: '2026-05-01', search: 'salary', page: 1 }));
        done();
      });
    });
  });

  it('preserves search when changing sort', (done) => {
    store.loadIncomes(10, { search: 'salary', page: 2 }).subscribe(() => {
      service.listIncomes.calls.reset();

      store.loadIncomes(10, { sort: 'incomeDate,asc', page: 0 }, { persist: true }).subscribe(() => {
        expect(service.listIncomes).toHaveBeenCalledWith(
          10,
          jasmine.objectContaining({ search: 'salary', sort: 'incomeDate,asc', page: 0 })
        );
        done();
      });
    });
  });

  it('updates income and refreshes list', (done) => {
    store.updateIncome(10, 1, { categoryId: 2, description: 'Salary', amount: 3500000, incomeDate: '2026-05-12' }).subscribe(() => {
      expect(service.updateIncome).toHaveBeenCalledWith(10, 1, {
        categoryId: 2,
        description: 'Salary',
        amount: 3500000,
        incomeDate: '2026-05-12'
      });
      expect(service.listIncomes).toHaveBeenCalled();
      done();
    });
  });

  it('duplicates income, refreshes list and selects the new income', (done) => {
    store.duplicateIncome(10, 1, { incomeDate: '2026-06-12', amount: 3200000, description: 'Salary June' }).subscribe((created) => {
      expect(service.duplicateIncome).toHaveBeenCalledWith(10, 1, {
        incomeDate: '2026-06-12',
        amount: 3200000,
        description: 'Salary June'
      });
      expect(service.listIncomes).toHaveBeenCalled();
      expect(created.id).toBe(2);
      expect(store.selectedIncome()).toEqual(created);
      done();
    });
  });

  it('cancels income and refreshes list', (done) => {
    store.cancelIncome(10, 1).subscribe(() => {
      expect(service.cancelIncome).toHaveBeenCalledWith(10, 1);
      expect(service.listIncomes).toHaveBeenCalled();
      done();
    });
  });

  it('loads persisted filters per account', () => {
    localStorage.setItem(
      'easyFinance.filters.income.10',
      JSON.stringify({ from: '2026-05-01', search: 'salary', categoryId: 2, participantId: 7, status: 'CANCELLED', sort: 'incomeDate,asc' })
    );
    localStorage.setItem('easyFinance.filters.income.11', JSON.stringify({ from: '2026-06-01', status: 'ACTIVE' }));

    expect(store.loadPersistedFilters(10)).toEqual(jasmine.objectContaining({
      from: '2026-05-01',
      search: 'salary',
      categoryId: 2,
      participantId: null,
      status: 'ACTIVE',
      sort: 'incomeDate,asc'
    }));
    expect(store.loadPersistedFilters(11)).toEqual(jasmine.objectContaining({ from: '2026-06-01', status: 'ACTIVE' }));
  });

  it('persists filters when requested and clears them', (done) => {
    store.loadIncomes(10, { from: '2026-05-01', search: '  salary  ', status: 'CANCELLED' }, { persist: true }).subscribe(() => {
      expect(service.listIncomes).toHaveBeenCalledWith(10, jasmine.objectContaining({ search: 'salary' }));
      expect(JSON.parse(localStorage.getItem('easyFinance.filters.income.10') ?? '{}')).toEqual(jasmine.objectContaining({
        from: '2026-05-01',
        search: 'salary'
      }));
      expect(JSON.parse(localStorage.getItem('easyFinance.filters.income.10') ?? '{}').participantId).toBeUndefined();
      expect(JSON.parse(localStorage.getItem('easyFinance.filters.income.10') ?? '{}').status).toBeUndefined();

      store.clearPersistedFilters(10);

      expect(localStorage.getItem('easyFinance.filters.income.10')).toBeNull();
      expect(store.filters()).toEqual(jasmine.objectContaining({ status: 'ACTIVE', from: null, search: null }));
      done();
    });
  });

  it('clears blank search values instead of sending them to the API', (done) => {
    store.loadIncomes(10, { search: '   ' }).subscribe(() => {
      expect(service.listIncomes).toHaveBeenCalledWith(10, jasmine.objectContaining({ search: null }));
      expect(store.filters().search).toBeNull();
      done();
    });
  });
});
