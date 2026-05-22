# Forms Validation Guide

Mirror backend validation to reduce failed submissions. Backend remains the final authority.

## Common

- Required: block submit and show inline message.
- Money: number, min `0.01` unless planned budget where min is `0.00`.
- Currency: always `COP`; do not expose currency selector in MVP.
- Dates: use `YYYY-MM-DD`.
- Date ranges: `from <= to`.
- Pagination: default `page=0`, `size=20` unless the feature has a page-size selector.
- Text search: trim values; blank search must be ignored/cleared.

## Auth

- email required and valid.
- password required.
- register password min length 8.
- fullName required.

## Accounts

- name required, max 120.
- description max 500.

## Catalogs

- name required, max 120.
- description max 500.
- category type required.
- payment method type required.
- Do not allow changing type in UI after create.
- Search filters by name/description and composes with type/status.

## Expenses

- categoryId required.
- paymentMethodId required.
- description required, max 500.
- amount required, min 0.01.
- expenseDate required.
- paymentState optional on create; default backend behavior is `PAID`.
- quick expense uses today's date, `PAID` by default, and requires only amount/category/payment method.
- text search filters by description.
- For installment expense:
  - totalAmount required, min 0.01.
  - installmentCount required, min 1.
  - installmentAmount required, min 0.01.
  - firstInstallmentDate required.
  - validate `installmentAmount * installmentCount == totalAmount`.
- Duplicate expense:
  - source must be active and simple.
  - target expenseDate required.
  - optional amount must be greater than zero.

## Debts

- name required, max 150.
- description max 500.
- totalAmount required, min 0.01.
- installmentCount optional but if present min 1.
- installmentAmount optional but if present min 0.01.
- startDate required.
- notes max 1000.

## Debt Payments

- paymentType required.
- amount required, min 0.01.
- paymentDate required.
- amount must not exceed current `remainingAmount`.
- notes max 1000.
- optional associated expense:
  - `createExpense` defaults to `false`.
  - when `createExpense=true`, categoryId, paymentMethodId, and expenseDescription are required.
  - do not ask for separate expense amount/date; backend uses payment amount and paymentDate.

## Budgets

- year range: 2000-2100.
- month range: 1-12.
- manual subBudget name required.
- plannedAmount required, min 0.00.
- Do not allow editing `DEBT_DERIVED` sub-budgets.
- Duplicate budget target year/month required.
- Duplicate target cannot be the same source year/month.

## Income

- categoryId required and must be an `INCOME` category.
- description required.
- amount required, min 0.01.
- incomeDate required.
- text search filters by description.
- Duplicate income:
  - source must be active.
  - target incomeDate required.
  - optional amount must be greater than zero.

## Dashboard Analytics

- Dashboard date filters require valid `from` and `to`.
- `from` must be before or equal to `to`.
- Date range max is 24 months.
- Budget-vs-expenses comparison is only shown for an exact calendar-month range.
- Specific month selector sets `from` to the first day of the month and `to` to the last day.

## Imports

- file required.
- extension `.xlsx`.
- max file size: 5MB unless backend config changes.
- first sheet headers:
  - `Fecha`
  - `Descripcion`
  - `Monto`
  - `Categoria`
  - `MedioPago`
  - `EstadoPago`
  - `AplicaPagoDeuda`
  - `Deuda`
  - `TipoPagoDeuda`
  - `NotasPagoDeuda`
- older files without debt-payment columns remain accepted.
- `AplicaPagoDeuda` supports `SI` or `NO`; blank is treated as `NO`.
- if `AplicaPagoDeuda = SI`, `Deuda` and `TipoPagoDeuda` are required.
- if `AplicaPagoDeuda = NO` or blank, debt-payment fields must stay empty.
- confirm creates the expense and registers the debt payment for rows marked with `SI`.
- max rows: backend-configured, currently documented as 1000.
- formulas are rejected.
