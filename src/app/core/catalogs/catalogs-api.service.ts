import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CatalogListFilters,
  CategoryResponseDto,
  CreateCategoryRequest,
  CreatePaymentMethodRequest,
  PageResponseDto,
  PaymentMethodResponseDto,
  UpdateCategoryRequest,
  UpdatePaymentMethodRequest
} from '../../shared/models';
import { ApiClient } from '../http/api-client';

@Injectable({ providedIn: 'root' })
export class CatalogsApiService {
  private readonly api = inject(ApiClient);

  listCategories(accountId: number, filters: CatalogListFilters = {}): Observable<PageResponseDto<CategoryResponseDto>> {
    return this.api.get<PageResponseDto<CategoryResponseDto>>(`/accounts/${accountId}/categories`, normalizeFilters(filters));
  }

  createCategory(accountId: number, request: CreateCategoryRequest): Observable<CategoryResponseDto> {
    return this.api.post<CategoryResponseDto, CreateCategoryRequest>(`/accounts/${accountId}/categories`, request);
  }

  getCategory(accountId: number, categoryId: number): Observable<CategoryResponseDto> {
    return this.api.get<CategoryResponseDto>(`/accounts/${accountId}/categories/${categoryId}`);
  }

  updateCategory(accountId: number, categoryId: number, request: UpdateCategoryRequest): Observable<CategoryResponseDto> {
    return this.api.put<CategoryResponseDto, UpdateCategoryRequest>(`/accounts/${accountId}/categories/${categoryId}`, request);
  }

  deactivateCategory(accountId: number, categoryId: number): Observable<void> {
    return this.api.delete<void>(`/accounts/${accountId}/categories/${categoryId}`);
  }

  listPaymentMethods(
    accountId: number,
    filters: CatalogListFilters = {}
  ): Observable<PageResponseDto<PaymentMethodResponseDto>> {
    return this.api.get<PageResponseDto<PaymentMethodResponseDto>>(
      `/accounts/${accountId}/payment-methods`,
      normalizeFilters(filters)
    );
  }

  createPaymentMethod(accountId: number, request: CreatePaymentMethodRequest): Observable<PaymentMethodResponseDto> {
    return this.api.post<PaymentMethodResponseDto, CreatePaymentMethodRequest>(
      `/accounts/${accountId}/payment-methods`,
      request
    );
  }

  getPaymentMethod(accountId: number, paymentMethodId: number): Observable<PaymentMethodResponseDto> {
    return this.api.get<PaymentMethodResponseDto>(`/accounts/${accountId}/payment-methods/${paymentMethodId}`);
  }

  updatePaymentMethod(
    accountId: number,
    paymentMethodId: number,
    request: UpdatePaymentMethodRequest
  ): Observable<PaymentMethodResponseDto> {
    return this.api.put<PaymentMethodResponseDto, UpdatePaymentMethodRequest>(
      `/accounts/${accountId}/payment-methods/${paymentMethodId}`,
      request
    );
  }

  deactivatePaymentMethod(accountId: number, paymentMethodId: number): Observable<void> {
    return this.api.delete<void>(`/accounts/${accountId}/payment-methods/${paymentMethodId}`);
  }
}

function normalizeFilters(filters: CatalogListFilters): Record<string, string | number | null | undefined> {
  const search = filters.search?.trim();

  return {
    search: search || undefined,
    type: filters.type,
    status: filters.status ?? 'ACTIVE',
    page: filters.page ?? 0,
    size: filters.size ?? 20,
    sort: filters.sort
  };
}
