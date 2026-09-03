import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthenticatedUserDto } from '../../shared/models';
import { ApiClient } from '../http/api-client';
import { AuthApiService } from './auth-api.service';

describe('AuthApiService', () => {
  let service: AuthApiService;
  let httpTesting: HttpTestingController;

  const user: AuthenticatedUserDto = {
    userId: 1,
    participantId: 2,
    email: 'demo@example.com',
    fullName: 'Demo User',
    globalRoles: ['USER']
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthApiService, ApiClient, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(AuthApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('calls PUT /auth/me with the updated full name', () => {
    service.updateProfile({ fullName: 'Jane Smith' }).subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/auth/me');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ fullName: 'Jane Smith' });
    request.flush({ ...user, fullName: 'Jane Smith' });
  });

  it('calls GET /auth/me', () => {
    service.me().subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/auth/me');
    expect(request.request.method).toBe('GET');
    request.flush(user);
  });

  it('calls POST /auth/refresh with credentials', () => {
    service.refresh().subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/auth/refresh');
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBeTrue();
    request.flush({ accessToken: 'new-token', tokenType: 'Bearer', expiresIn: 3600, user });
  });

  it('calls POST /auth/logout with credentials', () => {
    service.logout().subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/api/v1/auth/logout');
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBeTrue();
    request.flush(null);
  });
});
