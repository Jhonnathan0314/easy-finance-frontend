import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AccountResponseDto } from '../../shared/models';
import { AccountsApiService } from '../accounts/accounts-api.service';
import { AccountStore } from './account.store';

describe('AccountStore', () => {
  const account: AccountResponseDto = {
    id: 1,
    name: 'Casa',
    description: null,
    status: 'ACTIVE',
    currentUserRole: 'ACCOUNT_ADMIN',
    createdAt: '2026-05-12T00:00:00Z',
    updatedAt: '2026-05-12T00:00:00Z'
  };

  beforeEach(() => {
    localStorage.clear();
  });

  function configure(accounts: AccountResponseDto[] = [account]): AccountStore {
    TestBed.configureTestingModule({
      providers: [
        AccountStore,
        {
          provide: AccountsApiService,
          useValue: {
            listAccounts: jasmine
              .createSpy('listAccounts')
              .and.returnValue(of({ content: accounts, page: 0, size: 20, totalElements: accounts.length, totalPages: 1 })),
            createAccount: jasmine.createSpy('createAccount').and.returnValue(of(account)),
            getAccount: jasmine.createSpy('getAccount').and.returnValue(of(account))
          }
        }
      ]
    });

    return TestBed.inject(AccountStore);
  }

  it('selects and persists an account id', () => {
    const store = configure();

    store.selectAccount(account);

    expect(store.selectedAccountId()).toBe(1);
    expect(localStorage.getItem('easy-finance.selected-account-id')).toBe('1');
  });

  it('clears an invalid persisted selected account', (done) => {
    localStorage.setItem('easy-finance.selected-account-id', '99');
    const store = configure([account]);

    store.loadAccounts().subscribe(() => {
      expect(store.selectedAccount()).toBeNull();
      expect(localStorage.getItem('easy-finance.selected-account-id')).toBeNull();
      done();
    });
  });
});
