import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  BudgetDetailResponseDto,
  BudgetListFilters,
  BudgetResponseDto,
  CreateSubBudgetRequest,
  DuplicateBudgetRequest,
  PageResponseDto,
  SubBudgetResponseDto,
  UpdateSubBudgetRequest,
  UpsertBudgetRequest
} from '../../shared/models';
import { ApiClient } from '../http/api-client';

@Injectable({ providedIn: 'root' })
export class BudgetsApiService {
  private readonly api = inject(ApiClient);

  listBudgets(accountId: number, filters: BudgetListFilters = {}): Observable<PageResponseDto<BudgetResponseDto>> {
    return this.api.get<PageResponseDto<BudgetResponseDto>>(`/accounts/${accountId}/budgets`, normalizeFilters(filters));
  }

  upsertBudget(
    accountId: number,
    year: number,
    month: number,
    request: UpsertBudgetRequest
  ): Observable<BudgetResponseDto> {
    return this.api.put<BudgetResponseDto, UpsertBudgetRequest>(`/accounts/${accountId}/budgets/${year}/${month}`, request);
  }

  getBudgetDetail(accountId: number, year: number, month: number): Observable<BudgetDetailResponseDto> {
    return this.api.get<BudgetDetailResponseDto>(`/accounts/${accountId}/budgets/${year}/${month}`);
  }

  duplicateBudget(
    accountId: number,
    sourceYear: number,
    sourceMonth: number,
    request: DuplicateBudgetRequest
  ): Observable<BudgetDetailResponseDto> {
    return this.api.post<BudgetDetailResponseDto, DuplicateBudgetRequest>(
      `/accounts/${accountId}/budgets/${sourceYear}/${sourceMonth}/duplicate`,
      request
    );
  }

  createSubBudget(
    accountId: number,
    budgetId: number,
    request: CreateSubBudgetRequest
  ): Observable<SubBudgetResponseDto> {
    return this.api.post<SubBudgetResponseDto, CreateSubBudgetRequest>(
      `/accounts/${accountId}/budgets/${budgetId}/sub-budgets`,
      request
    );
  }

  updateSubBudget(
    accountId: number,
    budgetId: number,
    subBudgetId: number,
    request: UpdateSubBudgetRequest
  ): Observable<SubBudgetResponseDto> {
    return this.api.put<SubBudgetResponseDto, UpdateSubBudgetRequest>(
      `/accounts/${accountId}/budgets/${budgetId}/sub-budgets/${subBudgetId}`,
      request
    );
  }

  deactivateSubBudget(accountId: number, budgetId: number, subBudgetId: number): Observable<void> {
    return this.api.delete<void>(`/accounts/${accountId}/budgets/${budgetId}/sub-budgets/${subBudgetId}`);
  }
}

function normalizeFilters(filters: BudgetListFilters): Record<string, string | number | null | undefined> {
  return {
    year: filters.year,
    status: filters.status,
    page: filters.page ?? 0,
    size: filters.size ?? 20,
    sort: filters.sort ?? 'month,desc'
  };
}
