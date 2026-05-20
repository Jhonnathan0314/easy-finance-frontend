import { CurrencyCode } from './common.models';
import { ExpensePaymentState, ExpenseStatus, ExpenseType } from './enums';

export interface CreateExpenseRequest {
  categoryId: number;
  paymentMethodId: number;
  description: string;
  amount: number;
  expenseDate: string;
  paymentState?: ExpensePaymentState | null;
}

export interface UpdateExpenseRequest {
  categoryId: number;
  paymentMethodId: number;
  description: string;
  amount: number;
  expenseDate: string;
  paymentState: ExpensePaymentState;
}

export interface DuplicateExpenseRequest {
  expenseDate: string;
  amount?: number;
  description?: string;
  paymentState?: ExpensePaymentState;
}

export interface CreateInstallmentExpenseRequest {
  categoryId: number;
  paymentMethodId: number;
  description: string;
  totalAmount: number;
  expenseDate: string;
  installmentCount: number;
  installmentAmount: number;
  firstInstallmentDate: string;
  debtName?: string | null;
  notes?: string | null;
}

export interface ExpenseResponse {
  id: number;
  accountId: number;
  categoryId: number;
  paymentMethodId: number;
  participantId: number;
  description: string;
  amount: number;
  currency: CurrencyCode;
  expenseDate: string;
  paymentState: ExpensePaymentState;
  status: ExpenseStatus;
  expenseType: ExpenseType;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseResponseDto = ExpenseResponse;

export interface ExpenseListFilters {
  from?: string | null;
  to?: string | null;
  search?: string | null;
  categoryId?: number | null;
  paymentMethodId?: number | null;
  participantId?: number | null;
  paymentState?: ExpensePaymentState | null;
  status?: ExpenseStatus | null;
  page?: number | null;
  size?: number | null;
  sort?: string | null;
}
