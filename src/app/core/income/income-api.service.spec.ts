import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiClient } from '../http/api-client';
import { IncomeApiService } from './income-api.service';

describe('IncomeApiService', () => {
  let service: IncomeApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [IncomeApiService, ApiClient, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(IncomeApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('builds list endpoint with query params', () => {
    service
      .listIncomes(3, {
        from: '2026-05-01',
        to: '2026-05-31',
        search: '  salary  ',
        categoryId: 1,
        participantId: 7,
        status: 'ACTIVE',
        page: 1,
        size: 10,
        sort: 'incomeDate,desc'
      })
      .subscribe();

    const request = httpTesting.expectOne(
      'http://localhost:8080/api/v1/accounts/3/incomes?from=2026-05-01&to=2026-05-31&search=salary&categoryId=1&participantId=7&status=ACTIVE&page=1&size=10&sort=incomeDate,desc'
    );
    expect(request.request.method).toBe('GET');
    request.flush({ content: [], page: 1, size: 10, totalElements: 0, totalPages: 0 });
  });

  it('ignores blank search when building list query params', () => {
    service.listIncomes(3, { search: '   ' }).subscribe();

    const request = httpTesting.expectOne(
      'http://localhost:8080/api/v1/accounts/3/incomes?status=ACTIVE&page=0&size=20&sort=incomeDate,desc'
    );

    expect(request.request.method).toBe('GET');
    request.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
  });

  it('builds mutation endpoints', () => {
    service.createIncome(4, { categoryId: 1, description: 'Salary', amount: 1000000, incomeDate: '2026-05-12' }).subscribe();
    service.getIncome(4, 9).subscribe();
    service.updateIncome(4, 9, { categoryId: 1, description: 'Salary updated', amount: 1200000, incomeDate: '2026-05-13' }).subscribe();
    service.cancelIncome(4, 9).subscribe();

    expect(httpTesting.expectOne('http://localhost:8080/api/v1/accounts/4/incomes').request.method).toBe('POST');

    const requests = httpTesting.match('http://localhost:8080/api/v1/accounts/4/incomes/9');
    expect(requests.map((request) => request.request.method)).toEqual(['GET', 'PUT']);
    requests[0].flush({});
    requests[1].flush({});

    expect(httpTesting.expectOne('http://localhost:8080/api/v1/accounts/4/incomes/9/cancel').request.method).toBe('PATCH');
  });

  it('builds duplicate income endpoint', () => {
    service
      .duplicateIncome(4, 9, {
        incomeDate: '2026-06-30',
        amount: 5200000,
        description: 'Nomina junio'
      })
      .subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/4/incomes/9/duplicate');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      incomeDate: '2026-06-30',
      amount: 5200000,
      description: 'Nomina junio'
    });
    request.flush({});
  });
});
