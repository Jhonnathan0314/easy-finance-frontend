import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { DebtPaymentResponseDto, DebtResponseDto } from '../../shared/models';
import { DebtsApiService } from './debts-api.service';
import { DebtsStore } from './debts.store';

describe('DebtsStore', () => {
  const debt: DebtResponseDto = {
    id: 1,
    accountId: 10,
    participantId: 7,
    originExpenseId: null,
    sourceType: 'MANUAL',
    name: 'Laptop',
    description: null,
    totalAmount: 1200000,
    totalCurrency: 'COP',
    remainingAmount: 800000,
    remainingCurrency: 'COP',
    installmentCount: 12,
    installmentAmount: 100000,
    installmentCurrency: 'COP',
    startDate: '2026-05-12',
    endDate: null,
    state: 'ACTIVE',
    notes: null,
    createdAt: '',
    updatedAt: ''
  };
  const payment: DebtPaymentResponseDto = {
    id: 2,
    accountId: 10,
    debtId: 1,
    participantId: 7,
    paymentType: 'INSTALLMENT',
    amount: 100000,
    currency: 'COP',
    paymentDate: '2026-05-12',
    notes: null,
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: ''
  };

  let service: jasmine.SpyObj<DebtsApiService>;
  let store: DebtsStore;

  beforeEach(() => {
    localStorage.clear();
    service = jasmine.createSpyObj<DebtsApiService>('DebtsApiService', [
      'listDebts',
      'createManualDebt',
      'getDebt',
      'cancelDebt',
      'listPayments',
      'registerPayment',
      'getPayment'
    ]);
    service.listDebts.and.returnValue(of({ content: [debt], page: 0, size: 20, totalElements: 1, totalPages: 1 }));
    service.createManualDebt.and.returnValue(of(debt));
    service.getDebt.and.returnValue(of(debt));
    service.cancelDebt.and.returnValue(of(undefined));
    service.listPayments.and.returnValue(of({ content: [payment], page: 0, size: 20, totalElements: 1, totalPages: 1 }));
    service.registerPayment.and.returnValue(of({ payment, debt: { ...debt, remainingAmount: 700000 }, createdExpenseId: 21 }));
    service.getPayment.and.returnValue(of(payment));

    TestBed.configureTestingModule({
      providers: [DebtsStore, { provide: DebtsApiService, useValue: service }]
    });

    store = TestBed.inject(DebtsStore);
  });

  afterEach(() => localStorage.clear());

  it('loads debts and clears stale data when account changes', (done) => {
    store.loadDebts(10).subscribe(() => {
      expect(store.debts()).toEqual([debt]);
      service.listDebts.and.returnValue(of({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));

      store.loadDebts(11).subscribe(() => {
        expect(store.debts()).toEqual([]);
        expect(store.selectedDebt()).toBeNull();
        done();
      });
    });
  });

  it('creates a manual debt and refreshes the list', (done) => {
    store
      .createManualDebt(10, {
        name: 'Laptop',
        description: null,
        totalAmount: 1200000,
        startDate: '2026-05-12'
      })
      .subscribe(() => {
        expect(service.createManualDebt).toHaveBeenCalled();
        expect(service.listDebts).toHaveBeenCalled();
        done();
      });
  });

  it('registers a payment and refreshes debt and payments', (done) => {
    store.debts.set([debt]);

    store
      .registerPayment(10, 1, { paymentType: 'INSTALLMENT', amount: 100000, paymentDate: '2026-05-12' })
      .subscribe((response) => {
        expect(service.registerPayment).toHaveBeenCalledWith(10, 1, {
          paymentType: 'INSTALLMENT',
          amount: 100000,
          paymentDate: '2026-05-12'
        });
        expect(service.listPayments).toHaveBeenCalledWith(10, 1, jasmine.objectContaining({ status: 'ACTIVE' }));
        expect(store.selectedDebt()?.remainingAmount).toBe(700000);
        expect(store.payments()).toEqual([payment]);
        expect(response.createdExpenseId).toBe(21);
        done();
      });
  });

  it('cancels a debt and refreshes the list', (done) => {
    store.cancelDebt(10, 1).subscribe(() => {
      expect(service.cancelDebt).toHaveBeenCalledWith(10, 1);
      expect(service.listDebts).toHaveBeenCalled();
      done();
    });
  });

  it('loads persisted debt and payment filters per account', () => {
    localStorage.setItem(
      'easyFinance.filters.debts.10',
      JSON.stringify({
        debtFilters: { state: 'PAID', sourceType: 'MANUAL', participantId: 7, from: '2026-05-01', sort: 'startDate,asc' },
        paymentFilters: { from: '2026-05-10', paymentType: 'INSTALLMENT', status: 'CANCELLED', sort: 'paymentDate,asc' }
      })
    );
    localStorage.setItem(
      'easyFinance.filters.debts.11',
      JSON.stringify({ debtFilters: { state: 'ACTIVE', sourceType: 'INSTALLMENT_EXPENSE' }, paymentFilters: { status: 'ACTIVE' } })
    );

    expect(store.loadPersistedFilters(10)).toEqual({
      debtFilters: jasmine.objectContaining({
        state: 'PAID',
        sourceType: 'MANUAL',
        participantId: 7,
        from: '2026-05-01',
        sort: 'startDate,asc'
      }),
      paymentFilters: jasmine.objectContaining({
        from: '2026-05-10',
        paymentType: 'INSTALLMENT',
        status: 'CANCELLED',
        sort: 'paymentDate,asc'
      })
    });
    expect(store.loadPersistedFilters(11).debtFilters.sourceType).toBe('INSTALLMENT_EXPENSE');
  });

  it('persists and clears filters without clearing selected debt', (done) => {
    store.loadDebts(10).subscribe(() => {
      store.selectedDebt.set(debt);

      store.loadDebts(10, { state: 'PAID' }, { persist: true }).subscribe(() => {
        expect(JSON.parse(localStorage.getItem('easyFinance.filters.debts.10') ?? '{}').debtFilters).toEqual(
          jasmine.objectContaining({ state: 'PAID' })
        );

        store.clearPersistedFilters(10);

        expect(localStorage.getItem('easyFinance.filters.debts.10')).toBeNull();
        expect(store.selectedDebt()).toEqual(debt);
        expect(store.debtFilters()).toEqual(jasmine.objectContaining({ state: 'ACTIVE' }));
        done();
      });
    });
  });
});
