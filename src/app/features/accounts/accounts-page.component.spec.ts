import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AccountStore } from '../../core/state/account.store';
import { AccountsPageComponent } from './accounts-page.component';

describe('AccountsPageComponent', () => {
  let fixture: ComponentFixture<AccountsPageComponent>;
  let component: AccountsPageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountsPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: AccountStore,
          useValue: {
            accounts: signal([]),
            selectedAccountId: signal(null),
            selectedAccount: signal(null),
            isLoading: signal(false),
            error: signal(null),
            loadAccounts: jasmine.createSpy('loadAccounts').and.returnValue(of([])),
            createAccount: jasmine.createSpy('createAccount'),
            selectAccount: jasmine.createSpy('selectAccount')
          }
        }
      ]
    }).compileComponents();

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
});
