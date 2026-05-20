import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiClient } from '../http/api-client';
import { CatalogsApiService } from './catalogs-api.service';

describe('CatalogsApiService', () => {
  let service: CatalogsApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CatalogsApiService, ApiClient, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(CatalogsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('builds category list endpoint with query params', () => {
    service
      .listCategories(3, { search: ' food ', type: 'EXPENSE', status: 'ACTIVE', page: 1, size: 10, sort: 'name,asc' })
      .subscribe();

    const request = httpTesting.expectOne(
      'http://localhost:8080/api/v1/accounts/3/categories?search=food&type=EXPENSE&status=ACTIVE&page=1&size=10&sort=name,asc'
    );
    expect(request.request.method).toBe('GET');
    request.flush({ content: [], page: 1, size: 10, totalElements: 0, totalPages: 0 });
  });

  it('does not send blank search params', () => {
    service.listCategories(3, { search: '   ', status: 'ACTIVE' }).subscribe();
    service.listPaymentMethods(3, { search: '', status: 'ACTIVE' }).subscribe();

    const categoriesRequest = httpTesting.expectOne(
      'http://localhost:8080/api/v1/accounts/3/categories?status=ACTIVE&page=0&size=20'
    );
    expect(categoriesRequest.request.method).toBe('GET');
    categoriesRequest.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });

    const paymentMethodsRequest = httpTesting.expectOne(
      'http://localhost:8080/api/v1/accounts/3/payment-methods?status=ACTIVE&page=0&size=20'
    );
    expect(paymentMethodsRequest.request.method).toBe('GET');
    paymentMethodsRequest.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
  });

  it('builds payment method endpoints', () => {
    service.createPaymentMethod(4, { name: 'Cash', description: null, type: 'CASH' }).subscribe();
    service.updatePaymentMethod(4, 8, { name: 'Cash updated', description: 'Main' }).subscribe();
    service.deactivatePaymentMethod(4, 8).subscribe();

    const createRequest = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/4/payment-methods');
    expect(createRequest.request.method).toBe('POST');
    createRequest.flush({});

    const [updateRequest, deleteRequest] = httpTesting.match('http://localhost:8080/api/v1/accounts/4/payment-methods/8');
    expect(updateRequest.request.method).toBe('PUT');
    updateRequest.flush({});

    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);
  });
});
