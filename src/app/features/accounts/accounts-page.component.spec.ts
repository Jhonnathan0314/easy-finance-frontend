import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AccountStore } from '../../core/state/account.store';
import { AccountsPageComponent } from './accounts-page.component';
import { AccountResponseDto } from '../../shared/models';

describe('AccountsPageComponent', () => {
  let fixture: ComponentFixture<AccountsPageComponent>;
  let component: AccountsPageComponent;
  let accountStore: {
    accounts: ReturnType<typeof signal<AccountResponseDto[]>>;
    selectedAccountId: ReturnType<typeof signal<number | null>>;
    selectedAccount: ReturnType<typeof signal<AccountResponseDto | null>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<null>>;
    loadAccounts: jasmine.Spy;
    createAccount: jasmine.Spy;
    selectAccount: jasmine.Spy;
  };
  let router: Router;

  const account: AccountResponseDto = {
    id: 1,
    name: 'Casa',
    description: 'Cuenta familiar',
    status: 'ACTIVE',
    currentUserRole: 'ACCOUNT_ADMIN',
    createdAt: '',
    updatedAt: ''
  };

  beforeEach(async () => {
    accountStore = {
      accounts: signal([]),
      selectedAccountId: signal(null),
      selectedAccount: signal(null),
      isLoading: signal(false),
      error: signal(null),
      loadAccounts: jasmine.createSpy('loadAccounts').and.returnValue(of([])),
      createAccount: jasmine.createSpy('createAccount'),
      selectAccount: jasmine.createSpy('selectAccount')
    };

    await TestBed.configureTestingModule({
      imports: [AccountsPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: AccountStore,
          useValue: accountStore
        }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(AccountsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the empty state when there are no accounts', () => {
    expect(fixture.nativeElement.textContent).toContain('Aun no tienes cuentas');
  });

  it('requires account name on the create form', () => {
    component.openCreateForm();
    component.form.setValue({ name: '', description: '' });

    expect(component.form.valid).toBeFalse();
    expect(component.form.controls.name.hasError('required')).toBeTrue();
  });

  it('shows account card actions without the redundant open action', () => {
    accountStore.accounts.set([account]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Seleccionar');
    expect(text).toContain('Ver detalles');
    expect(text).not.toContain('Abrir');
  });

  it('selects an account and navigates to dashboard', () => {
    accountStore.accounts.set([account]);
    fixture.detectChanges();

    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(
      (item) => item.textContent?.trim() === 'Seleccionar'
    );

    button?.click();

    expect(accountStore.selectAccount).toHaveBeenCalledWith(account);
    expect(router.navigate).toHaveBeenCalledWith(['/app/accounts', account.id, 'dashboard']);
  });
});
