import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { AccountStore } from '../state/account.store';
import { GlobalErrorStore } from '../state/global-error.store';
import { PrivateLayoutComponent } from './private-layout.component';

describe('PrivateLayoutComponent', () => {
  let fixture: ComponentFixture<PrivateLayoutComponent>;

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

    await TestBed.configureTestingModule({
      imports: [PrivateLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { logout: jasmine.createSpy('logout') } },
        { provide: AuthStore, useValue: { user: signal({ fullName: 'Demo User', email: 'demo@example.com' }) } },
        { provide: GlobalErrorStore, useValue: { error: signal(null), clear: jasmine.createSpy('clear') } },
        {
          provide: AccountStore,
          useValue: {
            accounts: signal([selectedAccount]),
            selectedAccount: signal(selectedAccount),
            selectedAccountId: signal(1),
            hasSelectedAccount: signal(true),
            selectedAccountArchived: signal(false),
            loadAccounts: jasmine.createSpy('loadAccounts').and.returnValue(of([selectedAccount])),
            clear: jasmine.createSpy('clear'),
            clearSelectedAccount: jasmine.createSpy('clearSelectedAccount'),
            selectAccount: jasmine.createSpy('selectAccount')
          }
        }
      ]
    }).compileComponents();

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
});
