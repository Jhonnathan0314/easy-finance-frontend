export interface MonthlySummaryResponse {
  accountId: number;
  year: number;
  month: number;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  totalDebtRemaining: number;
  totalDebtPaidInMonth: number;
  activeDebtsCount: number;
  paidDebtsCount: number;
  budgetExpected: number;
  budgetPaid: number;
  budgetPending: number;
  generatedAt: string;
}

export type MonthlySummaryResponseDto = MonthlySummaryResponse;

export type CashflowGroupBy = 'DAY' | 'WEEK' | 'MONTH';

export interface AnalyticsDashboardFilters {
  from: string;
  to: string;
  participantId?: number | null;
  expenseCategoryId?: number | null;
  incomeCategoryId?: number | null;
  paymentMethodId?: number | null;
  expenseStatus?: string | null;
  expensePaymentState?: string | null;
  incomeStatus?: string | null;
  expenseType?: string | null;
  groupBy: CashflowGroupBy;
}

export interface CashflowSummaryResponse {
  accountId: number;
  from: string;
  to: string;
  totalIncome: number;
  totalSimpleExpenseOutflow: number;
  totalDebtPaymentOutflow: number;
  totalOutflow: number;
  netCashflow: number;
  generatedAt: string;
}

export type CashflowSummaryResponseDto = CashflowSummaryResponse;

export interface ExpenseSummaryResponse {
  accountId: number;
  from: string;
  to: string;
  totalSimpleExpenses: number;
  totalInstallmentPurchases: number;
  totalExpensesConceptual: number;
  expensesCount: number;
  generatedAt: string;
}

export type ExpenseSummaryResponseDto = ExpenseSummaryResponse;

export interface CashflowItem {
  period: string;
  totalIncome: number;
  simpleExpenseOutflow: number;
  debtPaymentOutflow: number;
  totalOutflow: number;
  netCashflow: number;
}

export type CashflowItemDto = CashflowItem;

export interface CashflowResponse {
  accountId: number;
  from: string;
  to: string;
  groupBy: CashflowGroupBy;
  items: CashflowItem[];
}

export type CashflowResponseDto = CashflowResponse;

export interface CategoryAmountItem {
  categoryId: number;
  categoryName: string;
  amount: number;
  count: number;
}

export type CategoryAmountItemDto = CategoryAmountItem;

export interface CategoryBreakdownResponse {
  accountId: number;
  from: string;
  to: string;
  items: CategoryAmountItem[];
}

export type CategoryBreakdownResponseDto = CategoryBreakdownResponse;

export interface PaymentMethodAmountItem {
  paymentMethodId?: number | null;
  paymentMethodName: string;
  amount: number;
  count: number;
}

export type PaymentMethodAmountItemDto = PaymentMethodAmountItem;

export interface PaymentMethodBreakdownResponse {
  accountId: number;
  from: string;
  to: string;
  items: PaymentMethodAmountItem[];
}

export type PaymentMethodBreakdownResponseDto = PaymentMethodBreakdownResponse;

export interface DebtSummaryResponse {
  accountId: number;
  activeDebtsCount: number;
  paidDebtsCount: number;
  cancelledDebtsCount: number;
  totalDebtAmount: number;
  totalRemainingBalance: number;
  totalPaidAmount: number;
  manualDebtsCount: number;
  installmentExpenseDebtsCount: number;
}

export type DebtSummaryResponseDto = DebtSummaryResponse;

export interface BudgetSummaryResponse {
  accountId: number;
  year: number;
  month: number;
  budgetId?: number | null;
  expectedAmount: number;
  paidAmount: number;
  pendingAmount: number;
  impactsCount: number;
  paidImpactsCount: number;
  activeImpactsCount: number;
  subBudgetsCount: number;
}

export type BudgetSummaryResponseDto = BudgetSummaryResponse;

export interface BudgetVsExpensesByCategoryItem {
  categoryId: number;
  categoryName: string;
  budgetedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  executionPercentage?: number | null;
}

export type BudgetVsExpensesByCategoryItemDto = BudgetVsExpensesByCategoryItem;

export interface BudgetVsExpensesByCategoryResponse {
  accountId: number;
  year: number;
  month: number;
  from: string;
  to: string;
  items: BudgetVsExpensesByCategoryItem[];
}

export type BudgetVsExpensesByCategoryResponseDto = BudgetVsExpensesByCategoryResponse;
