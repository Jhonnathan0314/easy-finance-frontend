import { CurrencyCode } from './common.models';
import { ExpensePaymentState, ExpenseSourceType, ExpenseStatus, ExpenseType } from './enums';

export interface CreateExpenseRequest {
  categoryId: number;
  paymentMethodId: number;
  description: string;
  amount: number;
  expenseDate: string;
  paymentState?: ExpensePaymentState | null;
  participantId?: number | null;
}

export interface UpdateExpenseRequest {
  categoryId: number;
  paymentMethodId: number;
  description: string;
  amount: number;
  expenseDate: string;
  paymentState: ExpensePaymentState;
  participantId?: number | null;
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
  participantId?: number | null;
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
  /** Origin of the expense. May be absent/unknown on older cached data; treat that as a normal (non-debt-payment) expense. */
  sourceType?: ExpenseSourceType | string | null;
  /** Only set when sourceType === 'DEBT_PAYMENT'. */
  sourceDebtPaymentId?: number | null;
  /** Only set when sourceType === 'DEBT_PAYMENT' and the backend could resolve the originating debt. */
  sourceDebtId?: number | null;
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
  expenseType?: ExpenseType | null;
  status?: ExpenseStatus | null;
  /** true = only DEBT_PAYMENT origin; false = anything that is not DEBT_PAYMENT; omitted/null = no filter. */
  debtPaymentOrigin?: boolean | null;
  page?: number | null;
  size?: number | null;
  sort?: string | null;
}

/** True only when the backend explicitly reports this expense as originated from a debt payment. */
export function isDebtPaymentExpense(expense: Pick<ExpenseResponse, 'sourceType'>): boolean {
  return expense.sourceType === 'DEBT_PAYMENT';
}
