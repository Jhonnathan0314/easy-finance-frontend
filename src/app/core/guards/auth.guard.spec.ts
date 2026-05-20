import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';

import { AuthStore } from '../auth/auth.store';
import { authGuard, publicGuard } from './auth.guard';

describe('authGuard', () => {
  it('redirects to login when there is no authenticated session', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            isAuthenticated: () => false,
            hasToken: () => false
          }
        }
      ]
    });

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    const router = TestBed.inject(Router);

    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('redirects public routes to accounts when the user is already authenticated', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            isAuthenticated: () => true,
            hasToken: () => true
          }
        }
      ]
    });

    const result = TestBed.runInInjectionContext(() => publicGuard({} as never, {} as never));
    const router = TestBed.inject(Router);

    expect(router.serializeUrl(result as UrlTree)).toBe('/app/accounts');
  });
});
