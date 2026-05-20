import { CurrencyCode } from './common.models';
import { BudgetImpactSourceType, BudgetImpactStatus, BudgetStatus, SubBudgetSourceType, SubBudgetStatus } from './enums';

export interface BudgetListFilters {
  year?: number | null;
  status?: BudgetStatus | null;
  page?: number | null;
  size?: number | null;
  sort?: string | null;
}

export interface UpsertBudgetRequest {
  name?: string | null;
  status?: BudgetStatus | null;
}

export interface DuplicateBudgetRequest {
  targetYear: number;
  targetMonth: number;
  name?: string | null;
}

export interface CreateSubBudgetRequest {
  categoryId?: number | null;
  name: string;
  plannedAmount: number;
}

export interface UpdateSubBudgetRequest {
  categoryId?: number | null;
  name: string;
  plannedAmount: number;
}

export interface BudgetResponse {
  id: number;
  accountId: number;
  year: number;
  month: number;
  name?: string | null;
  status: BudgetStatus;
  createdAt: string;
  updatedAt: string;
}

export type BudgetResponseDto = BudgetResponse;

export interface SubBudgetResponse {
  id: number;
  accountId: number;
  budgetId: number;
  categoryId?: number | null;
  debtId?: number | null;
  name: string;
  plannedAmount: number;
  plannedCurrency: CurrencyCode;
  spentAmount: number;
  spentCurrency: CurrencyCode;
  status: SubBudgetStatus;
  sourceType: SubBudgetSourceType;
  createdAt: string;
  updatedAt: string;
}

export type SubBudgetResponseDto = SubBudgetResponse;

export interface BudgetImpactResponse {
  id: number;
  accountId: number;
  budgetId: number;
  subBudgetId: number;
  debtId: number;
  expenseId?: number | null;
  periodYear: number;
  periodMonth: number;
  expectedAmount: number;
  expectedCurrency: CurrencyCode;
  paidAmount: number;
  paidCurrency: CurrencyCode;
  status: BudgetImpactStatus;
  sourceType: BudgetImpactSourceType;
  createdAt: string;
  updatedAt: string;
}

export type BudgetImpactResponseDto = BudgetImpactResponse;

export interface BudgetDetailResponse {
  budget: BudgetResponse;
  subBudgets: SubBudgetResponse[];
  impacts: BudgetImpactResponse[];
}

export type BudgetDetailResponseDto = BudgetDetailResponse;
