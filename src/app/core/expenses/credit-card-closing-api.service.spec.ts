import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiClient } from '../http/api-client';
import { CreditCardClosingApiService } from './credit-card-closing-api.service';

describe('CreditCardClosingApiService', () => {
  let service: CreditCardClosingApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CreditCardClosingApiService, ApiClient, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(CreditCardClosingApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('builds preview endpoint with query params', () => {
    service.preview(3, 5, '2026-05-01', '2026-05-31').subscribe();

    const request = httpTesting.expectOne(
      'http://localhost:8080/api/v1/accounts/3/expenses/credit-card-closing/preview?paymentMethodId=5&from=2026-05-01&to=2026-05-31'
    );

    expect(request.request.method).toBe('GET');
    request.flush({
      paymentMethodId: 5,
      from: '2026-05-01',
      to: '2026-05-31',
      totalAmount: 0,
      totalCount: 0,
      byCategory: [],
      expenses: []
    });
  });

  it('builds confirm endpoint with request body', () => {
    service.confirm(3, { paymentMethodId: 5, from: '2026-05-01', to: '2026-05-31' }).subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/3/expenses/credit-card-closing/confirm');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ paymentMethodId: 5, from: '2026-05-01', to: '2026-05-31' });
    request.flush({ paymentMethodId: 5, from: '2026-05-01', to: '2026-05-31', totalAmount: 0, updatedCount: 0 });
  });
});
