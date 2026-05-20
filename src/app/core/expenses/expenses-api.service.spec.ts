import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiClient } from '../http/api-client';
import { ExpensesApiService } from './expenses-api.service';

describe('ExpensesApiService', () => {
  let service: ExpensesApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ExpensesApiService, ApiClient, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(ExpensesApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('builds list endpoint with query params', () => {
    service
      .listExpenses(3, {
        from: '2026-05-01',
        to: '2026-05-31',
        search: '  lunch  ',
        categoryId: 1,
        paymentMethodId: 2,
        paymentState: 'PAID',
        status: 'ACTIVE',
        page: 1,
        size: 10,
        sort: 'expenseDate,desc'
      })
      .subscribe();

    const request = httpTesting.expectOne(
      'http://localhost:8080/api/v1/accounts/3/expenses?from=2026-05-01&to=2026-05-31&search=lunch&categoryId=1&paymentMethodId=2&paymentState=PAID&status=ACTIVE&page=1&size=10&sort=expenseDate,desc'
    );
    expect(request.request.method).toBe('GET');
    request.flush({ content: [], page: 1, size: 10, totalElements: 0, totalPages: 0 });
  });

  it('ignores blank search when building list query params', () => {
    service.listExpenses(3, { search: '   ' }).subscribe();

    const request = httpTesting.expectOne(
      'http://localhost:8080/api/v1/accounts/3/expenses?status=ACTIVE&page=0&size=20&sort=expenseDate,desc'
    );

    expect(request.request.method).toBe('GET');
    request.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
  });

  it('builds mutation endpoints', () => {
    service.createExpense(4, {
      categoryId: 1,
      paymentMethodId: 2,
      description: 'Lunch',
      amount: 10000,
      expenseDate: '2026-05-12',
      paymentState: 'PAID'
    }).subscribe();
    service.cancelExpense(4, 9).subscribe();
    service.createInstallmentExpense(4, {
      categoryId: 1,
      paymentMethodId: 2,
      description: 'Laptop',
      totalAmount: 1200000,
      expenseDate: '2026-05-12',
      installmentCount: 12,
      installmentAmount: 100000,
      firstInstallmentDate: '2026-06-01'
    }).subscribe();

    expect(httpTesting.expectOne('http://localhost:8080/api/v1/accounts/4/expenses').request.method).toBe('POST');
    expect(httpTesting.expectOne('http://localhost:8080/api/v1/accounts/4/expenses/9/cancel').request.method).toBe('PATCH');
    expect(httpTesting.expectOne('http://localhost:8080/api/v1/accounts/4/expenses/installments').request.method).toBe('POST');
  });

  it('builds duplicate expense endpoint', () => {
    service
      .duplicateExpense(4, 9, {
        expenseDate: '2026-06-15',
        amount: 85000,
        description: 'Mercado junio',
        paymentState: 'PAID'
      })
      .subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/4/expenses/9/duplicate');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      expenseDate: '2026-06-15',
      amount: 85000,
      description: 'Mercado junio',
      paymentState: 'PAID'
    });
    request.flush({});
  });
});
