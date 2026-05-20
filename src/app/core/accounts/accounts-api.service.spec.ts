import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiClient } from '../http/api-client';
import { AccountsApiService } from './accounts-api.service';

describe('AccountsApiService', () => {
  let service: AccountsApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AccountsApiService, ApiClient, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AccountsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('lists accounts with paging params', () => {
    service.listAccounts(1, 10).subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/accounts?page=1&size=10');
    expect(request.request.method).toBe('GET');
    request.flush({ content: [], page: 1, size: 10, totalElements: 0, totalPages: 0 });
  });

  it('creates an account at the accounts endpoint', () => {
    service.createAccount({ name: 'Casa', description: null }).subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/accounts');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'Casa', description: null });
    request.flush({});
  });

  it('loads account details and members by account id', () => {
    service.getAccount(7).subscribe();
    service.listMembers(7).subscribe();

    const detailRequest = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/7');
    expect(detailRequest.request.method).toBe('GET');
    detailRequest.flush({});

    const membersRequest = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/7/members');
    expect(membersRequest.request.method).toBe('GET');
    membersRequest.flush([]);
  });

  it('manages account members through relative account endpoints', () => {
    service.addMember(7, { email: 'user@example.com', role: 'ACCOUNT_MEMBER' }).subscribe();
    service.changeMemberRole(7, 11, { role: 'ACCOUNT_ADMIN' }).subscribe();
    service.removeMember(7, 11).subscribe();

    const addRequest = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/7/members');
    expect(addRequest.request.method).toBe('POST');
    expect(addRequest.request.body).toEqual({ email: 'user@example.com', role: 'ACCOUNT_MEMBER' });
    addRequest.flush({});

    const roleRequest = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/7/members/11/role');
    expect(roleRequest.request.method).toBe('PATCH');
    expect(roleRequest.request.body).toEqual({ role: 'ACCOUNT_ADMIN' });
    roleRequest.flush({});

    const removeRequest = httpTesting.expectOne('http://localhost:8080/api/v1/accounts/7/members/11');
    expect(removeRequest.request.method).toBe('DELETE');
    removeRequest.flush(null, { status: 204, statusText: 'No Content' });
  });
});
