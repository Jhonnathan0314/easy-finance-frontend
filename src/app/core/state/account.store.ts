import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, tap, throwError } from 'rxjs';

import { AccountsApiService } from '../accounts/accounts-api.service';
import { AccountResponseDto, ApiErrorResponse, CreateAccountRequest } from '../../shared/models';

const SELECTED_ACCOUNT_ID_KEY = 'easy-finance.selected-account-id';

@Injectable({ providedIn: 'root' })
export class AccountStore {
  private readonly accountsApi = inject(AccountsApiService);
  private readonly accountList = signal<AccountResponseDto[]>([]);
  private readonly account = signal<AccountResponseDto | null>(null);
  private readonly loaded = signal(false);

  readonly accounts = this.accountList.asReadonly();
  readonly selectedAccount = this.account.asReadonly();
  readonly selectedAccountId = computed(() => this.account()?.id ?? null);
  readonly hasSelectedAccount = computed(() => Boolean(this.selectedAccountId()));
  readonly isLoading = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly selectedAccountArchived = computed(() => this.account()?.status === 'ARCHIVED');

  loadAccounts(page = 0, size = 20, force = false): Observable<AccountResponseDto[]> {
    if (this.loaded() && !force) {
      return of(this.accounts());
    }

    this.isLoading.set(true);
    this.error.set(null);

    return this.accountsApi.listAccounts(page, size).pipe(
      map((pageResponse) => pageResponse.content),
      tap((accounts) => {
        this.accountList.set(accounts);
        this.loaded.set(true);
        const restoreState = this.restoreSelectedAccount();

        if (!this.selectedAccount() && accounts.length === 1 && restoreState === 'none') {
          this.selectAccount(accounts[0]);
        }
      }),
      catchError((error: unknown) => {
        this.error.set(toApiError(error));
        return throwError(() => error);
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  selectAccount(account: AccountResponseDto): void {
    globalThis.localStorage?.setItem(SELECTED_ACCOUNT_ID_KEY, String(account.id));
    this.account.set(account);
  }

  select(account: AccountResponseDto): void {
    this.selectAccount(account);
  }

  selectAccountById(accountId: number): Observable<AccountResponseDto | null> {
    return this.loadAccounts().pipe(
      map((accounts) => accounts.find((account) => account.id === accountId) ?? null),
      tap((account) => {
        if (account) {
          this.selectAccount(account);
        } else {
          this.clearSelectedAccount();
        }
      })
    );
  }

  restoreSelectedAccount(): 'restored' | 'missing' | 'none' {
    const selectedAccountId = this.readSelectedAccountId();

    if (!selectedAccountId) {
      this.account.set(null);
      return 'none';
    }

    const restored = this.accounts().find((account) => account.id === selectedAccountId) ?? null;

    if (restored) {
      this.account.set(restored);
      return 'restored';
    }

    this.clearSelectedAccount();
    return 'missing';
  }

  clearSelectedAccount(): void {
    globalThis.localStorage?.removeItem(SELECTED_ACCOUNT_ID_KEY);
    this.account.set(null);
  }

  clear(): void {
    this.clearSelectedAccount();
    this.accountList.set([]);
    this.loaded.set(false);
    this.error.set(null);
  }

  createAccount(request: CreateAccountRequest): Observable<AccountResponseDto> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.accountsApi.createAccount(request).pipe(
      tap((account) => {
        this.accountList.update((accounts) => [account, ...accounts.filter((item) => item.id !== account.id)]);
        this.loaded.set(true);
        this.selectAccount(account);
      }),
      catchError((error: unknown) => {
        this.error.set(toApiError(error));
        return throwError(() => error);
      }),
      finalize(() => this.isLoading.set(false))
    );
  }

  refreshSelectedAccount(): Observable<AccountResponseDto | null> {
    const accountId = this.selectedAccountId();

    if (!accountId) {
      return of(null);
    }

    return this.accountsApi.getAccount(accountId).pipe(
      tap((account) => {
        this.accountList.update((accounts) => accounts.map((item) => (item.id === account.id ? account : item)));
        this.selectAccount(account);
      }),
      catchError((error: unknown) => {
        this.error.set(toApiError(error));
        return throwError(() => error);
      })
    );
  }

  private readSelectedAccountId(): number | null {
    const raw = globalThis.localStorage?.getItem(SELECTED_ACCOUNT_ID_KEY);

    if (!raw) {
      return null;
    }

    const id = Number(raw);

    if (!Number.isFinite(id)) {
      globalThis.localStorage?.removeItem(SELECTED_ACCOUNT_ID_KEY);
      return null;
    }

    return id;
  }
}

function toApiError(error: unknown): ApiErrorResponse {
  if (error && typeof error === 'object' && 'error' in error) {
    const maybeHttpError = error as { error?: unknown; status?: number; statusText?: string; url?: string | null };

    if (isApiErrorResponse(maybeHttpError.error)) {
      return maybeHttpError.error;
    }

    return {
      timestamp: new Date().toISOString(),
      status: maybeHttpError.status ?? 0,
      error: maybeHttpError.statusText ?? 'Error',
      code: 'HTTP_ERROR',
      message: 'No fue posible completar la solicitud.',
      path: maybeHttpError.url ?? '',
      correlationId: null,
      details: []
    };
  }

  return {
    timestamp: new Date().toISOString(),
    status: 0,
    error: 'Error',
    code: 'UNKNOWN_ERROR',
    message: 'No fue posible completar la solicitud.',
    path: '',
    correlationId: null,
    details: []
  };
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return Boolean(value && typeof value === 'object' && 'code' in value && 'message' in value);
}
