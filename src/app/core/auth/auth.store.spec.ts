import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

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
            me: jasmine.createSpy('me').and.returnValue(of(session.user))
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
});
