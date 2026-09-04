import { CurrencyCode } from './common.models';
import { DebtPaymentType, ExpenseImportStatus, ExpensePaymentState } from './enums';

export interface ImportRowError {
  column: string;
  code: string;
  message: string;
}

export type ImportRowErrorDto = ImportRowError | string;

export interface ExpenseImportRowResponse {
  id: number;
  rowNumber: number;
  expenseDate?: string | null;
  description?: string | null;
  amount?: number | null;
  currency?: CurrencyCode | null;
  participantId?: number | null;
  participantLabel?: string | null;
  participantName?: string | null;
  categoryName?: string | null;
  categoryId?: number | null;
  paymentMethodName?: string | null;
  paymentMethodId?: number | null;
  paymentState?: ExpensePaymentState | null;
  appliesDebtPayment?: boolean | null;
  debtId?: number | null;
  debtLabel?: string | null;
  debtPaymentType?: DebtPaymentType | null;
  debtPaymentNotes?: string | null;
  valid: boolean;
  errors: ImportRowErrorDto[];
  createdExpenseId?: number | null;
  createdDebtPaymentId?: number | null;
}

export type ExpenseImportRowResponseDto = ExpenseImportRowResponse;

export interface ExpenseImportBatchResponse {
  batchId: number;
  accountId: number;
  participantId: number;
  originalFilename: string;
  status: ExpenseImportStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  confirmedAt?: string | null;
  rows: ExpenseImportRowResponse[];
}

export type ExpenseImportBatchResponseDto = ExpenseImportBatchResponse;

export interface IncomeImportRowResponse {
  rowNumber: number;
  incomeDate?: string | null;
  description?: string | null;
  amount?: number | null;
  participantId?: number | null;
  participantLabel?: string | null;
  participantName?: string | null;
  categoryName?: string | null;
  categoryId?: number | null;
  valid: boolean;
  errors: ImportRowErrorDto[];
  createdIncomeId?: number | null;
}

export type IncomeImportRowResponseDto = IncomeImportRowResponse;

export interface IncomeImportResponse {
  accountId: number;
  participantId: number;
  originalFilename: string;
  totalRows: number;
  createdCount: number;
  invalidRows: number;
  rows: IncomeImportRowResponse[];
}

export type IncomeImportResponseDto = IncomeImportResponse;

export interface CategoryImportRowResponse {
  rowNumber: number;
  name?: string | null;
  description?: string | null;
  type?: string | null;
  valid: boolean;
  errors: ImportRowErrorDto[];
  createdCategoryId?: number | null;
}

export type CategoryImportRowResponseDto = CategoryImportRowResponse;

export interface CategoryImportResponse {
  accountId: number;
  participantId: number;
  originalFilename: string;
  totalRows: number;
  createdCount: number;
  invalidRows: number;
  rows: CategoryImportRowResponse[];
}

export type CategoryImportResponseDto = CategoryImportResponse;

export interface PaymentMethodImportRowResponse {
  rowNumber: number;
  name?: string | null;
  description?: string | null;
  type?: string | null;
  valid: boolean;
  errors: ImportRowErrorDto[];
  createdPaymentMethodId?: number | null;
}

export type PaymentMethodImportRowResponseDto = PaymentMethodImportRowResponse;

export interface PaymentMethodImportResponse {
  accountId: number;
  participantId: number;
  originalFilename: string;
  totalRows: number;
  createdCount: number;
  invalidRows: number;
  rows: PaymentMethodImportRowResponse[];
}

export type PaymentMethodImportResponseDto = PaymentMethodImportResponse;

export interface AnnualBudgetImportRowResponse {
  rowNumber: number;
  year?: number | null;
  month?: string | null;
  budgetName?: string | null;
  categoryName?: string | null;
  categoryId?: number | null;
  subBudgetName?: string | null;
  plannedAmount?: number | null;
  participantId?: number | null;
  participantLabel?: string | null;
  participantName?: string | null;
  appliedMonths?: number[];
  valid: boolean;
  errors: ImportRowErrorDto[];
}

export type AnnualBudgetImportRowResponseDto = AnnualBudgetImportRowResponse;

export interface AnnualBudgetImportResponse {
  accountId: number;
  participantId: number;
  originalFilename: string;
  totalRows: number;
  createdBudgetsCount: number;
  createdSubBudgetsCount: number;
  invalidRows: number;
  rows: AnnualBudgetImportRowResponse[];
}

export type AnnualBudgetImportResponseDto = AnnualBudgetImportResponse;

export interface DebtImportRowResponse {
  rowNumber: number;
  name?: string | null;
  description?: string | null;
  totalAmount?: number | null;
  remainingBalance?: number | null;
  installmentCount?: number | null;
  installmentAmount?: number | null;
  startDate?: string | null;
  dueDate?: string | null;
  participantId?: number | null;
  participantLabel?: string | null;
  participantName?: string | null;
  notes?: string | null;
  valid: boolean;
  errors: ImportRowErrorDto[];
  createdDebtId?: number | null;
}

export type DebtImportRowResponseDto = DebtImportRowResponse;

export interface DebtImportResponse {
  accountId: number;
  participantId: number;
  originalFilename: string;
  totalRows: number;
  createdCount: number;
  invalidRows: number;
  rows: DebtImportRowResponse[];
}

export type DebtImportResponseDto = DebtImportResponse;
