import { CurrencyCode } from './common.models';
import { DebtPaymentStatus, DebtPaymentType, DebtSourceType, DebtState } from './enums';

export interface CreateManualDebtRequest {
  name: string;
  description?: string | null;
  totalAmount: number;
  installmentCount?: number | null;
  installmentAmount?: number | null;
  startDate: string;
  dueDate?: string | null;
  notes?: string | null;
}

export interface RegisterDebtPaymentRequest {
  paymentType: DebtPaymentType;
  amount: number;
  paymentDate: string;
  notes?: string | null;
}

export interface DebtResponse {
  id: number;
  accountId: number;
  participantId: number;
  originExpenseId?: number | null;
  sourceType: DebtSourceType;
  name: string;
  description?: string | null;
  totalAmount: number;
  totalCurrency: CurrencyCode;
  remainingAmount: number;
  remainingCurrency: CurrencyCode;
  installmentCount?: number | null;
  installmentAmount?: number | null;
  installmentCurrency?: CurrencyCode | null;
  startDate: string;
  endDate?: string | null;
  state: DebtState;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DebtResponseDto = DebtResponse;

export interface DebtPaymentResponse {
  id: number;
  accountId: number;
  debtId: number;
  participantId: number;
  paymentType: DebtPaymentType;
  amount: number;
  currency: CurrencyCode;
  paymentDate: string;
  notes?: string | null;
  status: DebtPaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export type DebtPaymentResponseDto = DebtPaymentResponse;

export interface RegisterDebtPaymentResponse {
  payment: DebtPaymentResponse;
  debt: DebtResponse;
}

export type RegisterDebtPaymentResponseDto = RegisterDebtPaymentResponse;

export interface DebtListFilters {
  state?: DebtState | null;
  sourceType?: DebtSourceType | null;
  participantId?: number | null;
  from?: string | null;
  to?: string | null;
  page?: number | null;
  size?: number | null;
  sort?: string | null;
}

export interface DebtPaymentListFilters {
  from?: string | null;
  to?: string | null;
  paymentType?: DebtPaymentType | null;
  status?: DebtPaymentStatus | null;
  page?: number | null;
  size?: number | null;
  sort?: string | null;
}
