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

export interface CreateAnnualSubBudgetBaseRequest {
  categoryId?: number | null;
  name: string;
  plannedAmount: number;
}

export interface CreateAnnualBudgetRequest {
  year: number;
  name?: string | null;
  status?: BudgetStatus | null;
  subBudgets: CreateAnnualSubBudgetBaseRequest[];
}

export interface CreateSubBudgetRequest {
  categoryId?: number | null;
  name: string;
  plannedAmount: number;
  participantId?: number | null;
}

export interface UpdateSubBudgetRequest {
  categoryId?: number | null;
  name: string;
  plannedAmount: number;
  participantId?: number | null;
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

export interface AnnualBudgetResponse {
  accountId: number;
  year: number;
  createdBudgets: BudgetResponse[];
}

export type AnnualBudgetResponseDto = AnnualBudgetResponse;

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
  participantId?: number | null;
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

export type SubBudgetForwardAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type SubBudgetForwardMonthStatus =
  | 'WILL_CREATE'
  | 'WILL_UPDATE'
  | 'WILL_DEACTIVATE'
  | 'DIVERGES'
  | 'NO_CHANGE'
  | 'SKIPPED_CLOSED'
  | 'SKIPPED_NO_BUDGET';

export interface SubBudgetForwardRequest {
  action: SubBudgetForwardAction;
  subBudgetId?: number | null;
  categoryId?: number | null;
  participantId?: number | null;
  name?: string | null;
  plannedAmount?: number | null;
}

export interface SubBudgetForwardApplyRequest extends SubBudgetForwardRequest {
  months: number[];
}

export interface SubBudgetForwardMonthPlanResponse {
  year: number;
  month: number;
  budgetId?: number | null;
  status: SubBudgetForwardMonthStatus;
  currentSubBudgetId?: number | null;
  currentName?: string | null;
  currentCategoryId?: number | null;
  currentParticipantId?: number | null;
  currentPlannedAmount?: number | null;
  proposedName?: string | null;
  proposedCategoryId?: number | null;
  proposedParticipantId?: number | null;
  proposedPlannedAmount?: number | null;
}

export interface SubBudgetForwardPlanResponse {
  months: SubBudgetForwardMonthPlanResponse[];
}

export type SubBudgetForwardPlanResponseDto = SubBudgetForwardPlanResponse;

export interface SubBudgetForwardMonthResultResponse {
  year: number;
  month: number;
  outcome: 'APPLIED' | 'SKIPPED';
  reason?: string | null;
}

export interface SubBudgetForwardApplyResponse {
  months: SubBudgetForwardMonthResultResponse[];
}

export type SubBudgetForwardApplyResponseDto = SubBudgetForwardApplyResponse;
