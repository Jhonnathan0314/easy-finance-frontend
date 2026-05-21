import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { AccountStore } from '../state/account.store';
import { GlobalErrorStore } from '../state/global-error.store';
import { PrivateLayoutComponent } from './private-layout.component';

describe('PrivateLayoutComponent', () => {
  let fixture: ComponentFixture<PrivateLayoutComponent>;
  let accountStore: {
    accounts: ReturnType<typeof signal>;
    selectedAccount: ReturnType<typeof signal>;
    selectedAccountId: ReturnType<typeof signal>;
    hasSelectedAccount: ReturnType<typeof signal>;
    selectedAccountArchived: ReturnType<typeof signal>;
    loadAccounts: jasmine.Spy;
    clear: jasmine.Spy;
    clearSelectedAccount: jasmine.Spy;
    selectAccount: jasmine.Spy;
  };
  let router: Router;

  beforeEach(async () => {
    const selectedAccount = {
      id: 1,
      name: 'Casa',
      description: null,
      status: 'ACTIVE',
      currentUserRole: 'ACCOUNT_ADMIN',
      createdAt: '',
      updatedAt: ''
    };
    const secondAccount = {
      ...selectedAccount,
      id: 2,
      name: 'Empresa'
    };
    const selectedAccountSignal = signal<typeof selectedAccount | null>(selectedAccount);
    const selectedAccountIdSignal = signal<number | null>(1);
    const hasSelectedAccountSignal = signal(true);

    accountStore = {
      accounts: signal([selectedAccount, secondAccount]),
      selectedAccount: selectedAccountSignal,
      selectedAccountId: selectedAccountIdSignal,
      hasSelectedAccount: hasSelectedAccountSignal,
      selectedAccountArchived: signal(false),
      loadAccounts: jasmine.createSpy('loadAccounts').and.returnValue(of([selectedAccount, secondAccount])),
      clear: jasmine.createSpy('clear'),
      clearSelectedAccount: jasmine.createSpy('clearSelectedAccount').and.callFake(() => {
        selectedAccountSignal.set(null);
        selectedAccountIdSignal.set(null);
        hasSelectedAccountSignal.set(false);
      }),
      selectAccount: jasmine.createSpy('selectAccount').and.callFake((account) => {
        selectedAccountSignal.set(account);
        selectedAccountIdSignal.set(account.id);
        hasSelectedAccountSignal.set(true);
      })
    };

    await TestBed.configureTestingModule({
      imports: [PrivateLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { logout: jasmine.createSpy('logout') } },
        { provide: AuthStore, useValue: { user: signal({ fullName: 'Demo User', email: 'demo@example.com' }) } },
        { provide: GlobalErrorStore, useValue: { error: signal(null), clear: jasmine.createSpy('clear') } },
        {
          provide: AccountStore,
          useValue: accountStore
        }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(PrivateLayoutComponent);
    fixture.detectChanges();
  });

  it('shows the selected account and role', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Casa');
    expect(text).toContain('ACCOUNT_ADMIN');
  });

  it('keeps Dashboard in navigation and hides Analytics placeholder link', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Dashboard');
    expect(text).not.toContain('Analitica');
  });

  it('changes account from topbar preserving expenses section', () => {
    spyOnProperty(router, 'url', 'get').and.returnValue('/app/accounts/1/expenses');

    fixture.componentInstance.changeAccount(selectEvent('2'));

    expect(accountStore.selectAccount).toHaveBeenCalledWith(jasmine.objectContaining({ id: 2 }));
    expect(router.navigate).toHaveBeenCalledWith(['/app/accounts', '2', 'expenses']);
  });

  it('changes directly from account A to B from the select without choosing empty first', () => {
    spyOnProperty(router, 'url', 'get').and.returnValue('/app/accounts/1/expenses');
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;

    select.value = '2';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(accountStore.selectAccount).toHaveBeenCalledWith(jasmine.objectContaining({ id: 2 }));
    expect(router.navigate).toHaveBeenCalledWith(['/app/accounts', '2', 'expenses']);
    expect(select.value).toBe('2');
  });

  it('changes account from topbar preserving budgets section', () => {
    spyOnProperty(router, 'url', 'get').and.returnValue('/app/accounts/1/budgets');

    fixture.componentInstance.changeAccount(selectEvent('2'));

    expect(router.navigate).toHaveBeenCalledWith(['/app/accounts', '2', 'budgets']);
  });

  it('ignores selecting the currently selected account', () => {
    spyOnProperty(router, 'url', 'get').and.returnValue('/app/accounts/1/expenses');

    fixture.componentInstance.changeAccount(selectEvent('1'));

    expect(accountStore.selectAccount).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('changes account from topbar preserving nested members settings section', () => {
    spyOnProperty(router, 'url', 'get').and.returnValue('/app/accounts/1/settings/members');

    fixture.componentInstance.changeAccount(selectEvent('2'));

    expect(router.navigate).toHaveBeenCalledWith(['/app/accounts', '2', 'settings', 'members']);
  });

  it('changes account from accounts page to the new account dashboard', () => {
    spyOnProperty(router, 'url', 'get').and.returnValue('/app/accounts');

    fixture.componentInstance.changeAccount(selectEvent('2'));

    expect(router.navigate).toHaveBeenCalledWith(['/app/accounts', '2', 'dashboard']);
  });

  it('clears selected account when choosing the empty option', () => {
    fixture.componentInstance.changeAccount(selectEvent(''));

    expect(accountStore.clearSelectedAccount).toHaveBeenCalled();
    expect(accountStore.selectAccount).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/app/accounts']);
  });
});

function selectEvent(value: string): Event {
  return { target: { value } } as unknown as Event;
}
