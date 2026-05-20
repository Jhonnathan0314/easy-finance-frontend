import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthStore } from '../auth/auth.store';
import { AccountStore } from '../state/account.store';
import { GlobalErrorStore } from '../state/global-error.store';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let authStore: jasmine.SpyObj<Pick<AuthStore, 'clearSession'>>;

  beforeEach(() => {
    authStore = jasmine.createSpyObj<Pick<AuthStore, 'clearSession'>>('AuthStore', ['clearSession']);

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
  });
});
