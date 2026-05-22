# Routing Plan

```text
/login
/register
/app
/app/accounts
/app/accounts/:accountId/dashboard
/app/accounts/:accountId/analytics -> redirects to /app/accounts/:accountId/dashboard
/app/accounts/:accountId/expenses
/app/accounts/:accountId/debts
/app/accounts/:accountId/budgets
/app/accounts/:accountId/income
/app/accounts/:accountId/catalogs
/app/accounts/:accountId/imports
/app/accounts/:accountId/settings/members
```

## Guards

- Public routes: `/login`, `/register`.
- Authenticated routes: `/app/**`.
- Account routes require selected `accountId`.
- Do not call backend with a stale `accountId`; clear selected account if `/auth/me` fails.
- The topbar account selector updates the selected account and preserves the current account-scoped section when safe:
  - `/app/accounts/1/expenses` -> `/app/accounts/2/expenses`
  - `/app/accounts/1/settings/members` -> `/app/accounts/2/settings/members`
  - `/app/accounts` -> `/app/accounts/{newAccountId}/dashboard`
- The legacy analytics route is kept only for link compatibility and redirects to Dashboard. The menu must not show an Analytics placeholder.

## Suggested Route Modules

- `features/auth/auth.routes.ts`
- `features/accounts/accounts.routes.ts`
- `features/expenses/expenses.routes.ts`
- `features/debts/debts.routes.ts`
- `features/budgets/budgets.routes.ts`
- `features/income/income.routes.ts`
- `features/imports/imports.routes.ts`
- `features/dashboard/dashboard.routes.ts`
