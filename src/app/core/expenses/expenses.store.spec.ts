import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ExpenseResponseDto } from '../../shared/models';
import { ExpensesApiService } from './expenses-api.service';
import { ExpensesStore } from './expenses.store';

describe('ExpensesStore', () => {
  const expense: ExpenseResponseDto = {
    id: 1,
    accountId: 10,
    categoryId: 2,
    paymentMethodId: 3,
    participantId: 7,
    description: 'Lunch',
    amount: 12000,
    currency: 'COP',
    expenseDate: '2026-05-12',
    paymentState: 'PAID',
    status: 'ACTIVE',
    expenseType: 'SIMPLE',
    createdAt: '',
    updatedAt: ''
  };

  let service: jasmine.SpyObj<ExpensesApiService>;
  let store: ExpensesStore;

  beforeEach(() => {
    localStorage.clear();
    service = jasmine.createSpyObj<ExpensesApiService>('ExpensesApiService', [
      'listExpenses',
      'createExpense',
      'duplicateExpense',
      'cancelExpense',
      'getExpense'
    ]);
    service.listExpenses.and.returnValue(of({ content: [expense], page: 0, size: 20, totalElements: 1, totalPages: 1 }));
    service.createExpense.and.returnValue(of(expense));
    service.duplicateExpense.and.returnValue(of({ ...expense, id: 2, expenseDate: '2026-06-12' }));
    service.cancelExpense.and.returnValue(of(undefined));
    service.getExpense.and.returnValue(of(expense));

    TestBed.configureTestingModule({
      providers: [ExpensesStore, { provide: ExpensesApiService, useValue: service }]
    });

    store = TestBed.inject(ExpensesStore);
  });

  afterEach(() => localStorage.clear());

  it('loads expenses and resets when account changes', (done) => {
    store.loadExpenses(10).subscribe(() => {
      expect(store.expenses()).toEqual([expense]);
      service.listExpenses.and.returnValue(of({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));

      store.loadExpenses(11).subscribe(() => {
        expect(store.expenses()).toEqual([]);
        done();
      });
    });
  });

  it('loads persisted filters per account without mixing accounts', () => {
    localStorage.setItem(
      'easyFinance.filters.expenses.10',
      JSON.stringify({ from: '2026-05-01', search: 'lunch', status: 'CANCELLED', categoryId: 2, paymentState: 'PAID' })
    );
    localStorage.setItem('easyFinance.filters.expenses.11', JSON.stringify({ from: '2026-06-01', status: 'ACTIVE' }));

    expect(store.loadPersistedFilters(10)).toEqual(jasmine.objectContaining({
      from: '2026-05-01',
      search: 'lunch',
      status: 'CANCELLED',
      categoryId: 2,
      paymentState: 'PAID'
    }));
    expect(store.loadPersistedFilters(11)).toEqual(jasmine.objectContaining({
      from: '2026-06-01',
      status: 'ACTIVE'
    }));
  });

  it('persists filters only when requested and clears persisted filters', (done) => {
    store
      .loadExpenses(10, { from: '2026-05-01', search: '  lunch  ', status: 'CANCELLED', paymentMethodId: 3 }, { persist: true })
      .subscribe(() => {
        expect(service.listExpenses).toHaveBeenCalledWith(10, jasmine.objectContaining({ search: 'lunch' }));
        expect(JSON.parse(localStorage.getItem('easyFinance.filters.expenses.10') ?? '{}')).toEqual(jasmine.objectContaining({
          from: '2026-05-01',
          search: 'lunch',
          status: 'CANCELLED',
          paymentMethodId: 3
        }));

        store.clearPersistedFilters(10);

        expect(localStorage.getItem('easyFinance.filters.expenses.10')).toBeNull();
        expect(store.filters().status).toBe('ACTIVE');
        expect(store.filters().search).toBeNull();
        done();
      });
  });

  it('clears blank search values instead of sending them to the API', (done) => {
    store.loadExpenses(10, { search: '   ' }).subscribe(() => {
      expect(service.listExpenses).toHaveBeenCalledWith(10, jasmine.objectContaining({ search: null }));
      expect(store.filters().search).toBeNull();
      done();
    });
  });

  it('keeps search when changing page or sort', (done) => {
    store.loadExpenses(10, { search: 'lunch', page: 0 }).subscribe(() => {
      service.listExpenses.calls.reset();

      store.loadExpenses(10, { page: 2 }).subscribe(() => {
        expect(service.listExpenses).toHaveBeenCalledWith(10, jasmine.objectContaining({ search: 'lunch', page: 2 }));
        service.listExpenses.calls.reset();

        store.loadExpenses(10, { sort: 'expenseDate,asc', page: 0 }, { persist: true }).subscribe(() => {
          expect(service.listExpenses).toHaveBeenCalledWith(
            10,
            jasmine.objectContaining({ search: 'lunch', sort: 'expenseDate,asc', page: 0 })
          );
          done();
        });
      });
    });
  });

  it('creates a simple expense and refreshes the list', (done) => {
    store.createSimpleExpense(10, {
      categoryId: 2,
      paymentMethodId: 3,
      description: 'Lunch',
      amount: 12000,
      expenseDate: '2026-05-12',
      paymentState: 'PAID'
    }).subscribe(() => {
      expect(service.createExpense).toHaveBeenCalled();
      expect(service.listExpenses).toHaveBeenCalled();
      done();
    });
  });

  it('duplicates a simple expense, refreshes list and selects the new expense', (done) => {
    store
      .duplicateExpense(10, 1, {
        expenseDate: '2026-06-12',
        amount: 15000,
        description: 'Lunch June',
        paymentState: 'PAID'
      })
      .subscribe((created) => {
        expect(service.duplicateExpense).toHaveBeenCalledWith(10, 1, {
          expenseDate: '2026-06-12',
          amount: 15000,
          description: 'Lunch June',
          paymentState: 'PAID'
        });
        expect(service.listExpenses).toHaveBeenCalled();
        expect(created.id).toBe(2);
        expect(store.selectedExpense()).toEqual(created);
        done();
      });
  });

  it('cancels an expense and refreshes the list', (done) => {
    store.cancelExpense(10, 1).subscribe(() => {
      expect(service.cancelExpense).toHaveBeenCalledWith(10, 1);
      expect(service.listExpenses).toHaveBeenCalled();
      done();
    });
  });
});
