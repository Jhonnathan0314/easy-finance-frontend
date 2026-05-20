import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree, provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';

import { AccountStore } from '../state/account.store';
import { accountRouteGuard } from './account-route.guard';

describe('accountRouteGuard', () => {
  it('allows access when the route account belongs to the user', (done) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AccountStore,
          useValue: {
            selectAccountById: jasmine.createSpy('selectAccountById').and.returnValue(of({ id: 7 }))
          }
        }
      ]
    });

    const route = {
      paramMap: {
        get: () => '7'
      }
    } as unknown as ActivatedRouteSnapshot;

    const result = TestBed.runInInjectionContext(() => accountRouteGuard(route, {} as never));

    (result as Observable<boolean>).subscribe((value) => {
      expect(value).toBeTrue();
      done();
    });
  });

  it('redirects to accounts when the route account does not belong to the user', (done) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AccountStore,
          useValue: {
            selectAccountById: jasmine.createSpy('selectAccountById').and.returnValue(of(null))
          }
        }
      ]
    });

    const route = {
      paramMap: {
        get: () => '99'
      }
    } as unknown as ActivatedRouteSnapshot;

    const result = TestBed.runInInjectionContext(() => accountRouteGuard(route, {} as never));
    const router = TestBed.inject(Router);

    (result as Observable<UrlTree>).subscribe((value: UrlTree) => {
      expect(router.serializeUrl(value as UrlTree)).toBe('/app/accounts');
      done();
    });
  });
});
