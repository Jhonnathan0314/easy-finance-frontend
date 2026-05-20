import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CreateExpenseRequest,
  CreateInstallmentExpenseRequest,
  DuplicateExpenseRequest,
  ExpenseListFilters,
  ExpenseResponseDto,
  PageResponseDto,
  UpdateExpenseRequest
} from '../../shared/models';
import { ApiClient } from '../http/api-client';

@Injectable({ providedIn: 'root' })
export class ExpensesApiService {
  private readonly api = inject(ApiClient);

  listExpenses(accountId: number, filters: ExpenseListFilters = {}): Observable<PageResponseDto<ExpenseResponseDto>> {
    return this.api.get<PageResponseDto<ExpenseResponseDto>>(`/accounts/${accountId}/expenses`, normalizeFilters(filters));
  }

  createExpense(accountId: number, request: CreateExpenseRequest): Observable<ExpenseResponseDto> {
    return this.api.post<ExpenseResponseDto, CreateExpenseRequest>(`/accounts/${accountId}/expenses`, request);
  }

  getExpense(accountId: number, expenseId: number): Observable<ExpenseResponseDto> {
    return this.api.get<ExpenseResponseDto>(`/accounts/${accountId}/expenses/${expenseId}`);
  }

  updateExpense(accountId: number, expenseId: number, request: UpdateExpenseRequest): Observable<ExpenseResponseDto> {
    return this.api.put<ExpenseResponseDto, UpdateExpenseRequest>(`/accounts/${accountId}/expenses/${expenseId}`, request);
  }

  duplicateExpense(accountId: number, expenseId: number, request: DuplicateExpenseRequest): Observable<ExpenseResponseDto> {
    return this.api.post<ExpenseResponseDto, DuplicateExpenseRequest>(`/accounts/${accountId}/expenses/${expenseId}/duplicate`, request);
  }

  cancelExpense(accountId: number, expenseId: number): Observable<void> {
    return this.api.patch<void, Record<string, never>>(`/accounts/${accountId}/expenses/${expenseId}/cancel`, {});
  }

  createInstallmentExpense(accountId: number, request: CreateInstallmentExpenseRequest): Observable<ExpenseResponseDto> {
    return this.api.post<ExpenseResponseDto, CreateInstallmentExpenseRequest>(
      `/accounts/${accountId}/expenses/installments`,
      request
    );
  }
}

function normalizeFilters(filters: ExpenseListFilters): Record<string, string | number | null | undefined> {
  return {
    from: filters.from,
    to: filters.to,
    search: optionalText(filters.search),
    categoryId: filters.categoryId,
    paymentMethodId: filters.paymentMethodId,
    participantId: filters.participantId,
    paymentState: filters.paymentState,
    status: filters.status ?? 'ACTIVE',
    page: filters.page ?? 0,
    size: filters.size ?? 20,
    sort: filters.sort ?? 'expenseDate,desc'
  };
}

function optionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}
