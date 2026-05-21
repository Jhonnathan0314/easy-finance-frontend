import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiClient } from '../http/api-client';
import { DebtsApiService } from './debts-api.service';

describe('DebtsApiService', () => {
  let service: DebtsApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DebtsApiService, ApiClient, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(DebtsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('builds debts list endpoint with query params', () => {
    service
      .listDebts(3, {
        state: 'ACTIVE',
        sourceType: 'MANUAL',
        participantId: 7,
        from: '2026-05-01',
        to: '2026-05-31',
        page: 1,
        size: 10,
        sort: 'startDate,desc'
      })
      .subscribe();

    const request = httpTesting.expectOne(
      'http://localhost:8080/api/v1/accounts/3/debts?state=ACTIVE&sourceType=MANUAL&participantId=7&from=2026-05-01&to=2026-05-31&page=1&size=10&sort=startDate,desc'
    );
    expect(request.request.method).toBe('GET');
    request.flush({ content: [], page: 1, size: 10, totalElements: 0, totalPages: 0 });
  });

  it('builds debt mutation endpoints', () => {
    service
      .createManualDebt(4, {
        name: 'Laptop',
        description: null,
        totalAmount: 1200000,
        startDate: '2026-05-12'
      })
      .subscribe();
    service.getDebt(4, 9).subscribe();
    service.cancelDebt(4, 9).subscribe();

    expect(httpTesting.expectOne('http://localhost:8080/api/v1/accounts/4/debts').request.method).toBe('POST');
    expect(httpTesting.expectOne('http://localhost:8080/api/v1/accounts/4/debts/9').request.method).toBe('GET');
    expect(httpTesting.expectOne('http://localhost:8080/api/v1/accounts/4/debts/9/cancel').request.method).toBe('PATCH');
  });

  it('builds payment endpoints with query params', () => {
    service
      .listPayments(5, 8, {
        from: '2026-05-01',
        to: '2026-05-31',
        paymentType: 'INSTALLMENT',
        status: 'ACTIVE',
        page: 2,
        size: 5,
        sort: 'paymentDate,desc'
      })
      .subscribe();
    service
      .registerPayment(5, 8, {
        paymentType: 'CAPITAL_PAYMENT',
        amount: 50000,
        paymentDate: '2026-05-12',
        createExpense: true,
        categoryId: 3,
        paymentMethodId: 4,
        expenseDescription: 'Pago deuda laptop'
      })
      .subscribe();
    service.getPayment(5, 8, 13).subscribe();

    const listRequest = httpTesting.expectOne(
      'http://localhost:8080/api/v1/accounts/5/debts/8/payments?from=2026-05-01&to=2026-05-31&paymentType=INSTALLMENT&status=ACTIVE&page=2&size=5&sort=paymentDate,desc'
    );
    expect(listRequest.request.method).toBe('GET');
    listRequest.flush({ content: [], page: 2, size: 5, totalElements: 0, totalPages: 0 });

    const registerRequest = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/5/debts/8/payments');
    expect(registerRequest.request.method).toBe('POST');
    expect(registerRequest.request.body).toEqual({
      paymentType: 'CAPITAL_PAYMENT',
      amount: 50000,
      paymentDate: '2026-05-12',
      createExpense: true,
      categoryId: 3,
      paymentMethodId: 4,
      expenseDescription: 'Pago deuda laptop'
    });
    expect(httpTesting.expectOne('http://localhost:8080/api/v1/accounts/5/debts/8/payments/13').request.method).toBe('GET');
  });
});
