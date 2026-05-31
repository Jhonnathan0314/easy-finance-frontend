import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiClient } from '../http/api-client';
import { ImportsApiService } from './imports-api.service';

describe('ImportsApiService', () => {
  let service: ImportsApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ImportsApiService, ApiClient, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(ImportsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('builds preview multipart request without explicit content type', () => {
    const file = new File(['excel'], 'expenses.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    service.previewExpenseImport(3, file).subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/3/imports/expenses/preview');
    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBeTrue();
    expect(request.request.body.get('file')).toBe(file);
    expect(request.request.headers.has('Content-Type')).toBeFalse();
    request.flush({ batchId: 1, rows: [] });
  });

  it('builds confirm and get batch endpoints', () => {
    service.confirmExpenseImport(4, 9).subscribe();
    service.getExpenseImportBatch(4, 9).subscribe();

    const requests = httpTesting.match('http://localhost:8080/api/v1/accounts/4/imports/expenses/9/confirm');
    expect(requests.length).toBe(1);
    expect(requests[0].request.method).toBe('POST');
    requests[0].flush({});

    const getRequest = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/4/imports/expenses/9');
    expect(getRequest.request.method).toBe('GET');
    getRequest.flush({});
  });

  it('downloads the expense import template as a blob', () => {
    service.downloadExpenseImportTemplate(5).subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/5/imports/expenses/template');
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['template']));
  });

  it('downloads the income import template as a blob', () => {
    service.downloadIncomeImportTemplate(6).subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/6/imports/incomes/template');
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['template']));
  });

  it('builds direct income import multipart request', () => {
    const file = new File(['excel'], 'incomes.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    service.importIncomes(7, file).subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/7/imports/incomes');
    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBeTrue();
    expect(request.request.body.get('file')).toBe(file);
    expect(request.request.headers.has('Content-Type')).toBeFalse();
    request.flush({ createdCount: 0, rows: [] });
  });

  it('downloads the category import template as a blob', () => {
    service.downloadCategoryImportTemplate(8).subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/8/imports/categories/template');
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['template']));
  });

  it('builds direct category import multipart request', () => {
    const file = new File(['excel'], 'categories.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    service.importCategories(9, file).subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/9/imports/categories');
    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBeTrue();
    expect(request.request.body.get('file')).toBe(file);
    expect(request.request.headers.has('Content-Type')).toBeFalse();
    request.flush({ createdCount: 0, rows: [] });
  });

  it('downloads the payment method import template as a blob', () => {
    service.downloadPaymentMethodImportTemplate(10).subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/10/imports/payment-methods/template');
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['template']));
  });

  it('builds direct payment method import multipart request', () => {
    const file = new File(['excel'], 'payment-methods.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    service.importPaymentMethods(11, file).subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/11/imports/payment-methods');
    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBeTrue();
    expect(request.request.body.get('file')).toBe(file);
    expect(request.request.headers.has('Content-Type')).toBeFalse();
    request.flush({ createdCount: 0, rows: [] });
  });
});
