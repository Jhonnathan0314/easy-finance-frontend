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
});
