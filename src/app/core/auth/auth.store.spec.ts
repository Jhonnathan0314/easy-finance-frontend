import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { AuthTokenResponseDto } from '../../shared/models';
import { AuthApiService } from './auth-api.service';
import { AuthStorageService } from './auth-storage.service';
import { AuthStore } from './auth.store';

class FakeAuthStorageService {
  private session: AuthTokenResponseDto | null = null;

  read(): AuthTokenResponseDto | null {
    return this.session;
  }

  write(session: AuthTokenResponseDto): void {
    this.session = session;
  }

  clear(): void {
    this.session = null;
  }
}

describe('AuthStore', () => {
  let store: AuthStore;
  let storage: FakeAuthStorageService;

  const session: AuthTokenResponseDto = {
    accessToken: 'token-value',
    tokenType: 'Bearer',
    expiresIn: 3600,
    user: {
      userId: 1,
      participantId: 2,
      email: 'demo@example.com',
      fullName: 'Demo User',
      globalRoles: ['USER']
    }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        { provide: AuthStorageService, useClass: FakeAuthStorageService },
        {
          provide: AuthApiService,
          useValue: {
            login: jasmine.createSpy('login').and.returnValue(of(session)),
            register: jasmine.createSpy('register').and.returnValue(of(session)),
            me: jasmine.createSpy('me').and.returnValue(of(session.user)),
            updateProfile: jasmine.createSpy('updateProfile').and.returnValue(of({ ...session.user, fullName: 'Jane Smith' })),
            refresh: jasmine.createSpy('refresh').and.returnValue(of(session)),
            logout: jasmine.createSpy('logout').and.returnValue(of(undefined))
          }
        }
      ]
    });

    store = TestBed.inject(AuthStore);
    storage = TestBed.inject(AuthStorageService) as unknown as FakeAuthStorageService;
  });

  it('sets a session in memory and storage', () => {
    store.setSession(session);

    expect(store.token()).toBe('token-value');
    expect(store.user()?.email).toBe('demo@example.com');
    expect(store.isAuthenticated()).toBeTrue();
    expect(storage.read()).toEqual(session);
  });

  it('clears session state', () => {
    store.setSession(session);

    store.clearSession();

    expect(store.token()).toBeNull();
    expect(store.user()).toBeNull();
    expect(store.isAuthenticated()).toBeFalse();
    expect(storage.read()).toBeNull();
  });

  it('updates the user in place after a successful profile update', (done) => {
    store.setSession(session);

    store.updateProfile({ fullName: 'Jane Smith' }).subscribe((user) => {
      expect(user.fullName).toBe('Jane Smith');
      expect(store.user()?.fullName).toBe('Jane Smith');
      expect(store.token()).toBe('token-value');
      expect(storage.read()?.user.fullName).toBe('Jane Smith');
      done();
    });
  });

  it('propagates profile update errors into authError', (done) => {
    const api = TestBed.inject(AuthApiService) as unknown as { updateProfile: jasmine.Spy };
    api.updateProfile.and.returnValue(throwError(() => ({ error: { code: 'FULL_NAME_REQUIRED', message: 'Full name is required.' } })));
    store.setSession(session);

    store.updateProfile({ fullName: '' }).subscribe({
      error: () => {
        expect(store.authError()?.code).toBe('FULL_NAME_REQUIRED');
        done();
      }
    });
  });

  it('refreshes the access token and updates the session', (done) => {
    const refreshedSession: AuthTokenResponseDto = { ...session, accessToken: 'new-token-value' };
    const api = TestBed.inject(AuthApiService) as unknown as { refresh: jasmine.Spy };
    api.refresh.and.returnValue(of(refreshedSession));
    store.setSession(session);

    store.refreshAccessToken().subscribe((result) => {
      expect(result.accessToken).toBe('new-token-value');
      expect(store.token()).toBe('new-token-value');
      expect(storage.read()?.accessToken).toBe('new-token-value');
      done();
    });
  });

  it('shares a single in-flight refresh call across concurrent callers', () => {
    const pending = new Subject<AuthTokenResponseDto>();
    const api = TestBed.inject(AuthApiService) as unknown as { refresh: jasmine.Spy };
    api.refresh.and.returnValue(pending);
    store.setSession(session);

    store.refreshAccessToken().subscribe();
    store.refreshAccessToken().subscribe();

    expect(api.refresh).toHaveBeenCalledTimes(1);

    pending.next({ ...session, accessToken: 'new-token-value' });
    pending.complete();
  });

  it('calls the logout endpoint and clears the session', () => {
    const api = TestBed.inject(AuthApiService) as unknown as { logout: jasmine.Spy };
    store.setSession(session);

    store.logout();

    expect(api.logout).toHaveBeenCalled();
    expect(store.isAuthenticated()).toBeFalse();
    expect(storage.read()).toBeNull();
  });
});
