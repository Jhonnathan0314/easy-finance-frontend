import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiClient } from '../http/api-client';
import { BudgetsApiService } from './budgets-api.service';

describe('BudgetsApiService', () => {
  let service: BudgetsApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BudgetsApiService, ApiClient, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(BudgetsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('builds budgets list endpoint with query params', () => {
    service
      .listBudgets(3, {
        year: 2026,
        status: 'ACTIVE',
        page: 1,
        size: 10,
        sort: 'month,asc'
      })
      .subscribe();

    const request = httpTesting.expectOne(
      'http://localhost:8080/api/v1/accounts/3/budgets?year=2026&status=ACTIVE&page=1&size=10&sort=month,asc'
    );
    expect(request.request.method).toBe('GET');
    request.flush({ content: [], page: 1, size: 10, totalElements: 0, totalPages: 0 });
  });

  it('uses month descending as default budget period sort', () => {
    service.listBudgets(3).subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/3/budgets?page=0&size=20&sort=month,desc');

    expect(request.request.method).toBe('GET');
    request.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
  });

  it('builds budget detail and mutation endpoints', () => {
    service.upsertBudget(4, 2026, 5, { name: 'Mayo', status: 'ACTIVE' }).subscribe();
    service.getBudgetDetail(4, 2026, 5).subscribe();

    const requests = httpTesting.match('http://localhost:8080/api/v1/accounts/4/budgets/2026/5');

    expect(requests.map((request) => request.request.method)).toEqual(['PUT', 'GET']);
    requests[0].flush({ id: 1, accountId: 4, year: 2026, month: 5, status: 'ACTIVE', createdAt: '', updatedAt: '' });
    requests[1].flush({ budget: {}, subBudgets: [], impacts: [] });
  });

  it('builds duplicate budget endpoint', () => {
    service.duplicateBudget(4, 2026, 5, { targetYear: 2026, targetMonth: 6, name: 'Junio' }).subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/4/budgets/2026/5/duplicate');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ targetYear: 2026, targetMonth: 6, name: 'Junio' });
    request.flush({ budget: {}, subBudgets: [], impacts: [] });
  });

  it('builds sub budget mutation endpoints', () => {
    service.createSubBudget(5, 9, { categoryId: 2, name: 'Mercado', plannedAmount: 500000 }).subscribe();
    service.updateSubBudget(5, 9, 12, { categoryId: null, name: 'Casa', plannedAmount: 800000 }).subscribe();
    service.deactivateSubBudget(5, 9, 12).subscribe();

    expect(httpTesting.expectOne('http://localhost:8080/api/v1/accounts/5/budgets/9/sub-budgets').request.method).toBe('POST');
    const requests = httpTesting.match('http://localhost:8080/api/v1/accounts/5/budgets/9/sub-budgets/12');

    expect(requests.map((request) => request.request.method)).toEqual(['PUT', 'DELETE']);
    requests[0].flush({});
    requests[1].flush({});
  });
});
