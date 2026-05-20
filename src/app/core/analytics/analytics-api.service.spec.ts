import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiClient } from '../http/api-client';
import { AnalyticsApiService } from './analytics-api.service';

describe('AnalyticsApiService', () => {
  let service: AnalyticsApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AnalyticsApiService, ApiClient, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AnalyticsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('builds cashflow summary endpoint with supported filters', () => {
    service
      .getCashflowSummary(3, '2026-05-01', '2026-05-31', {
        participantId: 9,
        expenseCategoryId: 2,
        paymentMethodId: 4
      })
      .subscribe();

    const request = httpTesting.expectOne(
      'http://localhost:8080/api/v1/accounts/3/analytics/cashflow-summary?from=2026-05-01&to=2026-05-31&participantId=9&categoryId=2&paymentMethodId=4'
    );
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it('builds expense summary and breakdown endpoints with expense filters', () => {
    const filters = {
      participantId: 9,
      expenseCategoryId: 2,
      paymentMethodId: 4,
      expenseStatus: 'ACTIVE',
      expensePaymentState: 'PAID',
      expenseType: 'SIMPLE'
    };
    service.getExpenseSummary(4, '2026-05-01', '2026-05-31', filters).subscribe();
    service.getExpensesByCategory(4, '2026-05-01', '2026-05-31', filters).subscribe();
    service.getExpensesByPaymentMethod(4, '2026-05-01', '2026-05-31', filters).subscribe();

    const expectedQuery =
      '?from=2026-05-01&to=2026-05-31&categoryId=2&paymentMethodId=4&participantId=9&status=ACTIVE&paymentState=PAID&expenseType=SIMPLE';

    for (const path of ['expense-summary', 'expenses-by-category', 'expenses-by-payment-method']) {
      const request = httpTesting.expectOne(`http://localhost:8080/api/v1/accounts/4/analytics/${path}${expectedQuery}`);
      expect(request.request.method).toBe('GET');
      request.flush({});
    }
  });

  it('builds cashflow timeline and income breakdown endpoints', () => {
    service.getCashflow(5, '2026-05-01', '2026-05-31', 'WEEK', { participantId: 7 }).subscribe();
    service.getIncomesByCategory(5, '2026-05-01', '2026-05-31', {
      participantId: 7,
      incomeCategoryId: 8,
      incomeStatus: 'ACTIVE'
    }).subscribe();

    const cashflow = httpTesting.expectOne(
      'http://localhost:8080/api/v1/accounts/5/analytics/cashflow?from=2026-05-01&to=2026-05-31&groupBy=WEEK&participantId=7'
    );
    expect(cashflow.request.method).toBe('GET');
    cashflow.flush({});

    const incomes = httpTesting.expectOne(
      'http://localhost:8080/api/v1/accounts/5/analytics/incomes-by-category?from=2026-05-01&to=2026-05-31&categoryId=8&participantId=7&status=ACTIVE'
    );
    expect(incomes.request.method).toBe('GET');
    incomes.flush({});
  });

  it('builds budget vs expenses by category endpoint with year and month', () => {
    service.getBudgetVsExpensesByCategory(7, 2026, 5).subscribe();

    const request = httpTesting.expectOne(
      'http://localhost:8080/api/v1/accounts/7/analytics/budget-vs-expenses-by-category?year=2026&month=5'
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      accountId: 7,
      year: 2026,
      month: 5,
      from: '2026-05-01',
      to: '2026-05-31',
      items: []
    });
  });
});
