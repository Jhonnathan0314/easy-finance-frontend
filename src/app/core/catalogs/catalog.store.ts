import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, switchMap, tap, throwError } from 'rxjs';

import {
  ApiErrorResponse,
  CatalogListFilters,
  CatalogStatus,
  CategoryResponseDto,
  CategoryType,
  CreateCategoryRequest,
  CreatePaymentMethodRequest,
  PaymentMethodResponseDto,
  PaymentMethodType,
  UpdateCategoryRequest,
  UpdatePaymentMethodRequest
} from '../../shared/models';
import { FeatureFilterStorageService } from '../filters/feature-filter-storage.service';
import { CatalogsApiService } from './catalogs-api.service';

export interface CategoryFilters {
  search: string | null;
  type: CategoryType | null;
  status: CatalogStatus;
  page: number;
  size: number;
  sort: string | null;
}

export interface PaymentMethodFilters {
  search: string | null;
  type: PaymentMethodType | null;
  status: CatalogStatus;
  page: number;
  size: number;
  sort: string | null;
}

const DEFAULT_CATEGORY_FILTERS: CategoryFilters = {
  search: null,
  type: null,
  status: 'ACTIVE',
  page: 0,
  size: 20,
  sort: 'name,asc'
};

const DEFAULT_PAYMENT_METHOD_FILTERS: PaymentMethodFilters = {
  search: null,
  type: null,
  status: 'ACTIVE',
  page: 0,
  size: 20,
  sort: 'name,asc'
};
const CATEGORY_FILTERS_FEATURE = 'catalogs.categories';
const PAYMENT_METHOD_FILTERS_FEATURE = 'catalogs.paymentMethods';
const CATALOG_STATUSES: CatalogStatus[] = ['ACTIVE', 'INACTIVE'];
const CATEGORY_TYPES: Array<CategoryType | null> = [null, 'EXPENSE', 'INCOME'];
const PAYMENT_METHOD_TYPES: Array<PaymentMethodType | null> = [
  null,
  'CASH',
  'BANK_ACCOUNT',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'DIGITAL_WALLET',
  'OTHER'
];

@Injectable({ providedIn: 'root' })
export class CatalogStore {
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly filterStorage = inject(FeatureFilterStorageService);
  private readonly currentAccountId = signal<number | null>(null);

  readonly categories = signal<CategoryResponseDto[]>([]);
  readonly paymentMethods = signal<PaymentMethodResponseDto[]>([]);
  readonly isLoadingCategories = signal(false);
  readonly isLoadingPaymentMethods = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly categoryFilters = signal<CategoryFilters>({ ...DEFAULT_CATEGORY_FILTERS });
  readonly paymentMethodFilters = signal<PaymentMethodFilters>({ ...DEFAULT_PAYMENT_METHOD_FILTERS });
  readonly hasCatalogs = computed(() => this.categories().length > 0 || this.paymentMethods().length > 0);

  loadCategories(
    accountId: number,
    filters?: Partial<CategoryFilters>,
    options: { persist?: boolean } = {}
  ): Observable<CategoryResponseDto[]> {
    this.ensureAccount(accountId);
    const currentFilters = this.categoryFilters();
    const nextFilters = normalizeCategoryFilters({ ...currentFilters, ...filters });
    if (Object.prototype.hasOwnProperty.call(filters ?? {}, 'search') && nextFilters.search !== currentFilters.search) {
      nextFilters.page = 0;
    }
    this.categoryFilters.set(nextFilters);

    if (options.persist) {
      this.filterStorage.setFilters(CATEGORY_FILTERS_FEATURE, accountId, catalogFiltersForStorage(nextFilters));
    }

    this.isLoadingCategories.set(true);
    this.error.set(null);

    return this.catalogsApi.listCategories(accountId, nextFilters).pipe(
      map((page) => page.content),
      tap((categories) => this.categories.set(categories)),
      catchError((error: unknown) => {
        this.error.set(toApiError(error));
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingCategories.set(false))
    );
  }

  loadPaymentMethods(
    accountId: number,
    filters?: Partial<PaymentMethodFilters>,
    options: { persist?: boolean } = {}
  ): Observable<PaymentMethodResponseDto[]> {
    this.ensureAccount(accountId);
    const currentFilters = this.paymentMethodFilters();
    const nextFilters = normalizePaymentMethodFilters({ ...currentFilters, ...filters });
    if (Object.prototype.hasOwnProperty.call(filters ?? {}, 'search') && nextFilters.search !== currentFilters.search) {
      nextFilters.page = 0;
    }
    this.paymentMethodFilters.set(nextFilters);

    if (options.persist) {
      this.filterStorage.setFilters(PAYMENT_METHOD_FILTERS_FEATURE, accountId, catalogFiltersForStorage(nextFilters));
    }

    this.isLoadingPaymentMethods.set(true);
    this.error.set(null);

    return this.catalogsApi.listPaymentMethods(accountId, nextFilters).pipe(
      map((page) => page.content),
      tap((paymentMethods) => this.paymentMethods.set(paymentMethods)),
      catchError((error: unknown) => {
        this.error.set(toApiError(error));
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingPaymentMethods.set(false))
    );
  }

  createCategory(accountId: number, request: CreateCategoryRequest): Observable<CategoryResponseDto[]> {
    this.ensureAccount(accountId);

    return this.catalogsApi.createCategory(accountId, request).pipe(
      switchMap(() => this.loadCategories(accountId)),
      catchError((error: unknown) => {
        this.error.set(toApiError(error));
        return throwError(() => error);
      })
    );
  }

  updateCategory(accountId: number, categoryId: number, request: UpdateCategoryRequest): Observable<CategoryResponseDto[]> {
    this.ensureAccount(accountId);

    return this.catalogsApi.updateCategory(accountId, categoryId, request).pipe(
      switchMap(() => this.loadCategories(accountId)),
      catchError((error: unknown) => {
        this.error.set(toApiError(error));
        return throwError(() => error);
      })
    );
  }

  deactivateCategory(accountId: number, categoryId: number): Observable<CategoryResponseDto[]> {
    this.ensureAccount(accountId);

    return this.catalogsApi.deactivateCategory(accountId, categoryId).pipe(
      switchMap(() => this.loadCategories(accountId)),
      catchError((error: unknown) => {
        this.error.set(toApiError(error));
        return throwError(() => error);
      })
    );
  }

  createPaymentMethod(accountId: number, request: CreatePaymentMethodRequest): Observable<PaymentMethodResponseDto[]> {
    this.ensureAccount(accountId);

    return this.catalogsApi.createPaymentMethod(accountId, request).pipe(
      switchMap(() => this.loadPaymentMethods(accountId)),
      catchError((error: unknown) => {
        this.error.set(toApiError(error));
        return throwError(() => error);
      })
    );
  }

  updatePaymentMethod(
    accountId: number,
    paymentMethodId: number,
    request: UpdatePaymentMethodRequest
  ): Observable<PaymentMethodResponseDto[]> {
    this.ensureAccount(accountId);

    return this.catalogsApi.updatePaymentMethod(accountId, paymentMethodId, request).pipe(
      switchMap(() => this.loadPaymentMethods(accountId)),
      catchError((error: unknown) => {
        this.error.set(toApiError(error));
        return throwError(() => error);
      })
    );
  }

  deactivatePaymentMethod(accountId: number, paymentMethodId: number): Observable<PaymentMethodResponseDto[]> {
    this.ensureAccount(accountId);

    return this.catalogsApi.deactivatePaymentMethod(accountId, paymentMethodId).pipe(
      switchMap(() => this.loadPaymentMethods(accountId)),
      catchError((error: unknown) => {
        this.error.set(toApiError(error));
        return throwError(() => error);
      })
    );
  }

  refreshAll(accountId: number): Observable<[CategoryResponseDto[], PaymentMethodResponseDto[]]> {
    this.ensureAccount(accountId);

    return this.loadCategories(accountId).pipe(
      switchMap((categories) =>
        this.loadPaymentMethods(accountId).pipe(map((paymentMethods) => [categories, paymentMethods] as [CategoryResponseDto[], PaymentMethodResponseDto[]]))
      )
    );
  }

  loadPersistedCategoryFilters(accountId: number): CategoryFilters {
    this.ensureAccount(accountId);
    const saved = this.filterStorage.getFilters<Partial<CategoryFilters>>(CATEGORY_FILTERS_FEATURE, accountId);
    const filters = saved ? normalizeCategoryFilters({ ...DEFAULT_CATEGORY_FILTERS, ...saved }) : { ...DEFAULT_CATEGORY_FILTERS };

    this.categoryFilters.set(filters);
    return filters;
  }

  loadPersistedPaymentMethodFilters(accountId: number): PaymentMethodFilters {
    this.ensureAccount(accountId);
    const saved = this.filterStorage.getFilters<Partial<PaymentMethodFilters>>(PAYMENT_METHOD_FILTERS_FEATURE, accountId);
    const filters = saved
      ? normalizePaymentMethodFilters({ ...DEFAULT_PAYMENT_METHOD_FILTERS, ...saved })
      : { ...DEFAULT_PAYMENT_METHOD_FILTERS };

    this.paymentMethodFilters.set(filters);
    return filters;
  }

  clearPersistedCategoryFilters(accountId: number): CategoryFilters {
    this.ensureAccount(accountId);
    this.filterStorage.clearFilters(CATEGORY_FILTERS_FEATURE, accountId);
    const filters = { ...DEFAULT_CATEGORY_FILTERS };
    this.categoryFilters.set(filters);

    return filters;
  }

  clearPersistedPaymentMethodFilters(accountId: number): PaymentMethodFilters {
    this.ensureAccount(accountId);
    this.filterStorage.clearFilters(PAYMENT_METHOD_FILTERS_FEATURE, accountId);
    const filters = { ...DEFAULT_PAYMENT_METHOD_FILTERS };
    this.paymentMethodFilters.set(filters);

    return filters;
  }

  clear(): void {
    this.currentAccountId.set(null);
    this.categories.set([]);
    this.paymentMethods.set([]);
    this.categoryFilters.set({ ...DEFAULT_CATEGORY_FILTERS });
    this.paymentMethodFilters.set({ ...DEFAULT_PAYMENT_METHOD_FILTERS });
    this.error.set(null);
  }

  private ensureAccount(accountId: number): void {
    if (this.currentAccountId() === accountId) {
      return;
    }

    this.currentAccountId.set(accountId);
    this.categories.set([]);
    this.paymentMethods.set([]);
    this.categoryFilters.set({ ...DEFAULT_CATEGORY_FILTERS });
    this.paymentMethodFilters.set({ ...DEFAULT_PAYMENT_METHOD_FILTERS });
    this.error.set(null);
  }
}

function normalizeCategoryFilters(filters: CategoryFilters): CategoryFilters {
  return {
    ...filters,
    search: normalizeSearch(filters.search),
    type: CATEGORY_TYPES.includes(filters.type ?? null) ? filters.type ?? null : null,
    status: CATALOG_STATUSES.includes(filters.status as CatalogStatus) ? (filters.status as CatalogStatus) : 'ACTIVE',
    page: numberOrDefault(filters.page, 0),
    size: numberOrDefault(filters.size, 20),
    sort: typeof filters.sort === 'string' && filters.sort ? filters.sort : 'name,asc'
  };
}

function normalizePaymentMethodFilters(filters: PaymentMethodFilters): PaymentMethodFilters {
  return {
    ...filters,
    search: normalizeSearch(filters.search),
    type: PAYMENT_METHOD_TYPES.includes(filters.type ?? null) ? filters.type ?? null : null,
    status: CATALOG_STATUSES.includes(filters.status as CatalogStatus) ? (filters.status as CatalogStatus) : 'ACTIVE',
    page: numberOrDefault(filters.page, 0),
    size: numberOrDefault(filters.size, 20),
    sort: typeof filters.sort === 'string' && filters.sort ? filters.sort : 'name,asc'
  };
}

function catalogFiltersForStorage<T extends CategoryFilters | PaymentMethodFilters>(filters: T): Omit<T, 'page' | 'size'> {
  const { page: _page, size: _size, ...persisted } = filters;

  return persisted;
}

function normalizeSearch(search: string | null | undefined): string | null {
  const trimmed = search?.trim();
  return trimmed ? trimmed : null;
}

function numberOrDefault(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : fallback;
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
