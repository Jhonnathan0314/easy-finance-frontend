import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthStore } from '../auth/auth.store';
import { AccountStore } from '../state/account.store';
import { GlobalErrorStore } from '../state/global-error.store';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let authStore: jasmine.SpyObj<Pick<AuthStore, 'clearSession' | 'refreshAccessToken'>>;

  beforeEach(() => {
    authStore = jasmine.createSpyObj<Pick<AuthStore, 'clearSession' | 'refreshAccessToken'>>('AuthStore', ['clearSession', 'refreshAccessToken']);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: authStore },
        {
          provide: AccountStore,
          useValue: {
            clear: jasmine.createSpy('clear')
          }
        },
        {
          provide: GlobalErrorStore,
          useValue: {
            set: jasmine.createSpy('set')
          }
        }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('clears the session on 401 responses', () => {
    http.get('/api/v1/accounts').subscribe({ error: () => undefined });

    const request = httpTesting.expectOne('/api/v1/accounts');
    request.flush(
      {
        timestamp: '2026-05-12T17:00:00Z',
        status: 401,
        error: 'Unauthorized',
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token.',
        path: '/api/v1/accounts',
        correlationId: null,
        details: []
      },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(authStore.clearSession).toHaveBeenCalled();
    expect(authStore.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('refreshes the access token and retries the original request on TOKEN_EXPIRED', (done) => {
    authStore.refreshAccessToken.and.returnValue(
      of({
        accessToken: 'new-access-token',
        tokenType: 'Bearer' as const,
        expiresIn: 3600,
        user: { userId: 1, participantId: 2, email: 'demo@example.com', fullName: 'Demo User', globalRoles: ['USER' as const] }
      })
    );

    http.get('/api/v1/accounts').subscribe({
      next: (response) => {
        expect(response).toEqual({ ok: true });
        expect(authStore.clearSession).not.toHaveBeenCalled();
        done();
      },
      error: () => done.fail('expected the retried request to succeed')
    });

    const firstRequest = httpTesting.expectOne('/api/v1/accounts');
    firstRequest.flush(
      {
        timestamp: '2026-05-12T17:00:00Z',
        status: 401,
        error: 'Unauthorized',
        code: 'TOKEN_EXPIRED',
        message: 'Token has expired.',
        path: '/api/v1/accounts',
        correlationId: null,
        details: []
      },
      { status: 401, statusText: 'Unauthorized' }
    );

    const retriedRequest = httpTesting.expectOne('/api/v1/accounts');
    expect(retriedRequest.request.headers.get('Authorization')).toBe('Bearer new-access-token');
    retriedRequest.flush({ ok: true });
  });

  it('clears the session and does not retry when the refresh call itself fails', (done) => {
    authStore.refreshAccessToken.and.returnValue(throwError(() => new Error('refresh failed')));

    http.get('/api/v1/accounts').subscribe({
      error: () => {
        expect(authStore.clearSession).toHaveBeenCalled();
        done();
      }
    });

    const firstRequest = httpTesting.expectOne('/api/v1/accounts');
    firstRequest.flush(
      {
        timestamp: '2026-05-12T17:00:00Z',
        status: 401,
        error: 'Unauthorized',
        code: 'TOKEN_EXPIRED',
        message: 'Token has expired.',
        path: '/api/v1/accounts',
        correlationId: null,
        details: []
      },
      { status: 401, statusText: 'Unauthorized' }
    );
  });
});
