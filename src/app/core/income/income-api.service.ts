import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CreateIncomeRequest,
  DuplicateIncomeRequest,
  IncomeListFilters,
  IncomeResponseDto,
  PageResponseDto,
  UpdateIncomeRequest
} from '../../shared/models';
import { ApiClient } from '../http/api-client';

@Injectable({ providedIn: 'root' })
export class IncomeApiService {
  private readonly api = inject(ApiClient);

  listIncomes(accountId: number, filters: IncomeListFilters = {}): Observable<PageResponseDto<IncomeResponseDto>> {
    return this.api.get<PageResponseDto<IncomeResponseDto>>(`/accounts/${accountId}/incomes`, normalizeFilters(filters));
  }

  createIncome(accountId: number, request: CreateIncomeRequest): Observable<IncomeResponseDto> {
    return this.api.post<IncomeResponseDto, CreateIncomeRequest>(`/accounts/${accountId}/incomes`, request);
  }

  getIncome(accountId: number, incomeId: number): Observable<IncomeResponseDto> {
    return this.api.get<IncomeResponseDto>(`/accounts/${accountId}/incomes/${incomeId}`);
  }

  updateIncome(accountId: number, incomeId: number, request: UpdateIncomeRequest): Observable<IncomeResponseDto> {
    return this.api.put<IncomeResponseDto, UpdateIncomeRequest>(`/accounts/${accountId}/incomes/${incomeId}`, request);
  }

  duplicateIncome(accountId: number, incomeId: number, request: DuplicateIncomeRequest): Observable<IncomeResponseDto> {
    return this.api.post<IncomeResponseDto, DuplicateIncomeRequest>(`/accounts/${accountId}/incomes/${incomeId}/duplicate`, request);
  }

  cancelIncome(accountId: number, incomeId: number): Observable<void> {
    return this.api.patch<void, Record<string, never>>(`/accounts/${accountId}/incomes/${incomeId}/cancel`, {});
  }
}

function normalizeFilters(filters: IncomeListFilters): Record<string, string | number | null | undefined> {
  return {
    from: filters.from,
    to: filters.to,
    search: optionalText(filters.search),
    categoryId: filters.categoryId,
    participantId: filters.participantId,
    status: filters.status ?? 'ACTIVE',
    page: filters.page ?? 0,
    size: filters.size ?? 20,
    sort: filters.sort ?? 'incomeDate,desc'
  };
}

function optionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}
