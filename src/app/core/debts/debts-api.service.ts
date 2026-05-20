import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CreateManualDebtRequest,
  DebtListFilters,
  DebtPaymentListFilters,
  DebtPaymentResponseDto,
  DebtResponseDto,
  PageResponseDto,
  RegisterDebtPaymentRequest,
  RegisterDebtPaymentResponseDto
} from '../../shared/models';
import { ApiClient } from '../http/api-client';

@Injectable({ providedIn: 'root' })
export class DebtsApiService {
  private readonly api = inject(ApiClient);

  listDebts(accountId: number, filters: DebtListFilters = {}): Observable<PageResponseDto<DebtResponseDto>> {
    return this.api.get<PageResponseDto<DebtResponseDto>>(`/accounts/${accountId}/debts`, normalizeDebtFilters(filters));
  }

  createManualDebt(accountId: number, request: CreateManualDebtRequest): Observable<DebtResponseDto> {
    return this.api.post<DebtResponseDto, CreateManualDebtRequest>(`/accounts/${accountId}/debts`, request);
  }

  getDebt(accountId: number, debtId: number): Observable<DebtResponseDto> {
    return this.api.get<DebtResponseDto>(`/accounts/${accountId}/debts/${debtId}`);
  }

  cancelDebt(accountId: number, debtId: number): Observable<void> {
    return this.api.patch<void, Record<string, never>>(`/accounts/${accountId}/debts/${debtId}/cancel`, {});
  }

  listPayments(
    accountId: number,
    debtId: number,
    filters: DebtPaymentListFilters = {}
  ): Observable<PageResponseDto<DebtPaymentResponseDto>> {
    return this.api.get<PageResponseDto<DebtPaymentResponseDto>>(
      `/accounts/${accountId}/debts/${debtId}/payments`,
      normalizePaymentFilters(filters)
    );
  }

  registerPayment(
    accountId: number,
    debtId: number,
    request: RegisterDebtPaymentRequest
  ): Observable<RegisterDebtPaymentResponseDto> {
    return this.api.post<RegisterDebtPaymentResponseDto, RegisterDebtPaymentRequest>(
      `/accounts/${accountId}/debts/${debtId}/payments`,
      request
    );
  }

  getPayment(accountId: number, debtId: number, paymentId: number): Observable<DebtPaymentResponseDto> {
    return this.api.get<DebtPaymentResponseDto>(`/accounts/${accountId}/debts/${debtId}/payments/${paymentId}`);
  }
}

function normalizeDebtFilters(filters: DebtListFilters): Record<string, string | number | null | undefined> {
  return {
    state: filters.state ?? 'ACTIVE',
    sourceType: filters.sourceType,
    participantId: filters.participantId,
    from: filters.from,
    to: filters.to,
    page: filters.page ?? 0,
    size: filters.size ?? 20,
    sort: filters.sort ?? 'startDate,desc'
  };
}

function normalizePaymentFilters(filters: DebtPaymentListFilters): Record<string, string | number | null | undefined> {
  return {
    from: filters.from,
    to: filters.to,
    paymentType: filters.paymentType,
    status: filters.status ?? 'ACTIVE',
    page: filters.page ?? 0,
    size: filters.size ?? 20,
    sort: filters.sort ?? 'paymentDate,desc'
  };
}
