import { CurrencyCode } from './common.models';
import { IncomeStatus } from './enums';

export interface IncomeListFilters {
  from?: string | null;
  to?: string | null;
  search?: string | null;
  categoryId?: number | null;
  participantId?: number | null;
  status?: IncomeStatus | null;
  page?: number | null;
  size?: number | null;
  sort?: string | null;
}

export interface CreateIncomeRequest {
  categoryId: number;
  description: string;
  amount: number;
  incomeDate: string;
}

export interface UpdateIncomeRequest {
  categoryId: number;
  description: string;
  amount: number;
  incomeDate: string;
}

export interface DuplicateIncomeRequest {
  incomeDate: string;
  amount?: number | null;
  description?: string | null;
}

export interface IncomeResponse {
  id: number;
  accountId: number;
  categoryId: number;
  participantId: number;
  description: string;
  amount: number;
  currency: CurrencyCode;
  incomeDate: string;
  status: IncomeStatus;
  createdAt: string;
  updatedAt: string;
}

export type IncomeResponseDto = IncomeResponse;
