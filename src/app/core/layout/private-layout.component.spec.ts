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

  it('does not render the topbar account select', () => {
    const select = fixture.nativeElement.querySelector('select');

    expect(select).toBeNull();
  });

  it('renders the change account button', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Cambiar de cuenta');
  });

  it('keeps Dashboard in navigation and hides Analytics placeholder link', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Dashboard');
    expect(text).not.toContain('Analitica');
  });

  it('navigates to accounts when clicking change account', () => {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const button = buttons.find(
      (item): item is HTMLButtonElement => item.textContent?.trim() === 'Cambiar de cuenta'
    );

    button?.click();

    expect(accountStore.selectAccount).not.toHaveBeenCalled();
    expect(accountStore.clearSelectedAccount).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/app/accounts']);
  });
});
