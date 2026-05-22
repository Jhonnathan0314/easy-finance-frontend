# State Management Plan

## Auth State

Fields:

- `accessToken`
- `expiresAt`
- `user`
- `isAuthenticated`

Actions:

- register
- login
- logout
- load current user
- handle token expired

## Selected Account State

Fields:

- `accounts`
- `selectedAccountId`
- `selectedAccount`
- `currentUserRole`

Persist selected account ID in local storage only as a convenience. Always validate by refetching account/list after login.

When the selected account changes from the topbar, update `AccountStore` first-class state and navigate with the new `accountId`. Feature stores must not mix data between accounts; each store should clear or reload on account change.

## Catalog Cache

Cache active categories and payment methods by account:

- expense categories
- income categories
- payment methods

Invalidate after create/update/deactivate.

## Feature Filter State

Persist implemented feature filters per account using `FeatureFilterStorageService`.

Storage key:

```text
easyFinance.filters.{feature}.{accountId}
```

Persisted features:

- expenses filters
- analytics filters
- income filters
- debt filters
- budget year/month
- catalog category filters
- catalog payment method filters
- import batch ID/status

Do not persist sensitive data. Ignore invalid or old JSON with `try/catch`. Clearing filters in a feature should remove that feature/account key and return to current defaults.

Current UI notes:

- Expenses and Income persist search/date/category/sort-style filters, but page/size are not treated as durable user preferences unless a feature explicitly decides to do so.
- Income hides `participantId` and `status` filters in the UI to avoid invisible/confusing filters; old persisted values for those fields should be ignored when loading page filters.
- Analytics persists date range, advanced filters and `groupBy`.
- Budgets persists selected year/month/status/sort.
- Catalogs persists category and payment-method filters separately.

## Loading And Errors

Use a small global HTTP pending indicator and feature-level loading states.

Map backend errors by `code` first, status second.
