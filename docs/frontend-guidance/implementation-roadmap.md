# Implementation Roadmap

Estado: frontend implementado hasta backend v0.2.0. Esta guia conserva el orden historico de construccion y marca el alcance actual de cada modulo.

## Phase 0: Bootstrap Angular

- Create Angular app.
- Configure environments.
- Add lint/format/test setup.
- Add shared layout primitives.

## Phase 1: Auth

- Login/register pages.
- Auth service/store.
- Bearer token interceptor.
- Error interceptor.
- Auth guard.
- `/auth/me` bootstrap.

## Phase 2: Layout App + Account Selection

- App shell.
- Account list and selector.
- Create account flow.
- Role-aware menu.
- Topbar account selector preserves the current account-scoped section when switching accounts.

## Phase 3: Accounts/Catalogs

- Account detail/settings.
- Members page.
- Categories page.
- Payment methods page.
- Admin-only controls.

## Phase 4: Expenses

- Simple expense CRUD.
- Description search.
- Date/status/category/payment-method filters.
- Date sorting.
- Top and bottom pagination controls.
- Page-size selector.
- Installment expense create form with total validation.
- Block update/cancel controls for installment expenses.
- Duplicate active simple expenses.
- Quick simple expense flow.

## Phase 5: Debts/Payments

- Debt list/detail.
- Manual debt creation.
- Register payment flow.
- Optional associated expense when registering a debt payment.
- Debt remaining balance display.

## Phase 6: Budgets

- Monthly budget view.
- Manual sub-budget management.
- Debt-derived impacts display.
- Duplicate monthly budget.
- Top metrics from `analytics/budget-summary`.
- Manual execution returned by backend from active `MANUAL`/`IMPORT` expenses.
- Sub-budget cards intentionally show base information only: name, category, planned amount, status/source and actions.

## Phase 7: Income

- Income CRUD.
- Description search.
- Date/category filters.
- Simplified UI filters: participant/status are supported internally by API but hidden from the main page.
- Date sorting.
- Top and bottom pagination controls.
- Page-size selector.
- Duplicate active income.

## Phase 8: Analytics Dashboard

- Local tabs: `Resumen`, `Cashflow`, `Gastos`, `Presupuesto`.
- Quick presets and manual `from/to` filters.
- Specific month selector by year/month.
- Real cashflow cards and timeline.
- Conceptual expense summary.
- Expenses by category.
- Expenses by payment method.
- Incomes by category.
- Debt summary.
- Budget summary.
- Budget vs expenses by category for exact calendar-month ranges.

## Phase 9: Imports Excel

- Dynamic template download.
- Upload preview.
- Row error table.
- Debt-payment metadata columns in preview.
- Confirm batch creates valid expenses and debt payments when rows request it.
- Clear/load another file action.

## Phase 10: Polish/Hardening

- Empty states.
- Loading states.
- Mobile layouts.
- Accessibility pass.
- Error messages by backend code.
- Smoke test script.

## Post v0.2.0 Candidates

- Visual QA pass in real browsers and responsive breakpoints.
- Accessibility audit beyond basic labels/focus.
- E2E automation for smoke flows.
- Export/reporting features if prioritized.
- Imports for income/debts if backend adds contracts.
