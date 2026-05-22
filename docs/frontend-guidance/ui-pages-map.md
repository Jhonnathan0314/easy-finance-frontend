# UI Pages Map

## Login

- Goal: authenticate existing user.
- Endpoint: `POST /api/v1/auth/login`.
- Actions: submit credentials, store token, load accounts.
- Components: login form, auth error alert.
- Errors: `INVALID_CREDENTIALS`, `USER_BLOCKED`, `USER_NOT_ACTIVE`.

## Register

- Goal: create user and participant.
- Endpoint: `POST /api/v1/auth/register`.
- Actions: submit registration, store token.
- Components: register form.
- Errors: `EMAIL_ALREADY_REGISTERED`, validation errors.

## Accounts

- Goal: list/create/select financial accounts.
- Endpoints: `GET /api/v1/accounts`, `POST /api/v1/accounts`.
- Actions: create account, select account.
- Components: account list, account form, empty state.
- Errors: validation errors.

## Account Dashboard

- Goal: show monthly financial overview.
- Endpoints:
  - `GET /analytics/monthly-summary`
  - `GET /analytics/cashflow-summary`
  - `GET /analytics/expense-summary`
  - `GET /analytics/cashflow`
  - `GET /analytics/expenses-by-category`
  - `GET /analytics/expenses-by-payment-method`
  - `GET /analytics/incomes-by-category`
  - `GET /analytics/debt-summary`
  - `GET /analytics/budget-summary`
  - `GET /analytics/budget-vs-expenses-by-category`
- Actions: use quick presets, select a specific year/month, change manual date range, participant, category, payment method, payment state, expense type, and cashflow grouping.
- Components:
  - Global filters remain above all dashboard content.
  - Local tabs: `Resumen`, `Cashflow`, `Gastos`, `Presupuesto`.
  - `Resumen`: real cashflow cards and conceptual expense cards.
  - `Cashflow`: cashflow timeline.
  - `Gastos`: expense category breakdown, payment-method breakdown, income category breakdown.
  - `Presupuesto`: budget-vs-expense category comparison when the active range is exactly one calendar month.
- Errors: `ANALYTICS_PERIOD_INVALID`, `ANALYTICS_DATE_RANGE_INVALID`, `ANALYTICS_DATE_RANGE_TOO_LARGE`.

## Catalogs

- Goal: manage categories and payment methods.
- Endpoints:
  - `/categories`
  - `/payment-methods`
- Actions: create, update, deactivate, filter, search by text.
- Components: tabs for categories/payment methods, forms, tables.
- Errors: duplicate names, type change not allowed, admin required.

## Expenses

- Goal: manage simple expenses and create installment expenses.
- Endpoints:
  - `GET/POST /expenses`
  - `PUT/PATCH /expenses/{expenseId}`
  - `POST /expenses/{expenseId}/duplicate`
  - `POST /expenses/installments`
- Actions: create simple, quick create simple, create installment, update/cancel/duplicate simple, search by description, filter, sort by date, paginate.
- Components: expense table, expense form, quick expense panel, installment form, filters, top/bottom pagination, page-size selector.
- Errors: invalid category/payment method, update/cancel not allowed, account not active.

## Debts

- Goal: view debts and create manual debts.
- Endpoints:
  - `GET/POST /debts`
  - `GET /debts/{debtId}`
  - `PATCH /debts/{debtId}/cancel`
- Actions: create manual debt, cancel manual debt, open detail.
- Components: debt table, debt detail, debt form.
- Errors: cancel not allowed, debt not active.

## Debt Payments

- Goal: register and list debt payments.
- Endpoints:
  - `POST /debts/{debtId}/payments`
  - `GET /debts/{debtId}/payments`
  - `GET /debts/{debtId}/payments/{paymentId}`
- Actions: register payment, optionally create an associated conceptual expense, filter payment history.
- Components: payment form, optional associated-expense fields, payment history table.
- Errors: overpayment, debt already paid, debt cancelled.

## Budgets

- Goal: view monthly budget, sub-budgets, and debt impacts.
- Endpoints:
  - `GET/PUT /budgets/{year}/{month}`
  - `GET /budgets`
  - `POST/PUT/DELETE /budgets/{budgetId}/sub-budgets`
- Actions: select month, filter/sort list, upsert budget, duplicate budget, create/update/deactivate manual sub-budget.
- Components: monthly budget header with overall progress, top metrics from `budget-summary`, simplified sub-budget cards/table, impact table.
- Notes: manual sub-budget execution is returned by backend from active simple expenses in the same month/category; associated debt-payment expenses are excluded to avoid double counting.
- UI note: individual sub-budgets intentionally show base data only: name, category, planned amount, status/source and actions. Individual spent/remaining/progress values are hidden to keep the section simple.
- Errors: invalid period, derived sub-budget not editable, admin required.

## Income

- Goal: manage income entries.
- Endpoints:
  - `GET/POST /incomes`
  - `GET/PUT/PATCH /incomes/{incomeId}`
- Actions: create, update, cancel, duplicate to another date, search by description, filter by visible fields, sort by date, paginate.
- Components: income table, income form, filters, top/bottom pagination, page-size selector.
- UI note: `participantId` and `status` remain supported by the API, but are hidden from the main Income filters because they are not useful as manual end-user inputs in the current UI.
- Errors: category invalid type, category inactive, update/cancel not allowed.

## Imports

- Goal: upload expense Excel, preview validation, confirm valid rows.
- Endpoints:
  - `GET /imports/expenses/template`
  - `POST /imports/expenses/preview`
  - `GET /imports/expenses/{batchId}`
  - `POST /imports/expenses/{batchId}/confirm`
- Actions: download dynamic template, upload, inspect row errors, confirm, clear/load another file.
- Components: template download action, upload input, preview summary, row error table, debt-payment columns, clear action.
- Notes: rows marked `AplicaPagoDeuda = SI` create both the imported expense and the debt payment during confirm.
- Errors: file required, invalid type, template invalid, row limit exceeded, already confirmed.

## Members

- Goal: manage account membership.
- Endpoints:
  - `GET /members`
  - `POST /members`
  - `PATCH /members/{participantId}/role`
  - `DELETE /members/{participantId}`
- Actions: add member, change role, deactivate member.
- Components: member table, add member form, role selector.
- Errors: admin required, last admin required, member already exists.
