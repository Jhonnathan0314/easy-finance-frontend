import { CurrencyCode } from './common.models';
import { DebtPaymentType, ExpenseImportStatus, ExpensePaymentState } from './enums';

export interface ImportRowError {
  column: string;
  code: string;
  message: string;
}

export type ImportRowErrorDto = ImportRowError;

export interface ExpenseImportRowResponse {
  id: number;
  rowNumber: number;
  expenseDate?: string | null;
  description?: string | null;
  amount?: number | null;
  currency?: CurrencyCode | null;
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
  errors: ImportRowError[];
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
  categoryName?: string | null;
  categoryId?: number | null;
  valid: boolean;
  errors: ImportRowError[];
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
  type?: string | null;
  valid: boolean;
  errors: ImportRowError[];
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
