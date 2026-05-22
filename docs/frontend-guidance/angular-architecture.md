# Angular Architecture

Use Angular 21 with standalone components and TypeScript strict.

## Recommended Shape

- Standalone components.
- Lazy-loaded feature routes.
- `HttpClient` for API access.
- Auth interceptor for Bearer JWT.
- Error interceptor for `ApiErrorResponse`.
- Route guards for authenticated app routes.
- Feature services by API area.
- TypeScript interfaces generated from OpenAPI or maintained manually from `models/dto-reference.md`.
- Reactive forms.
- Signals for local UI state; RxJS for async API streams and cross-component flows.

## Suggested Folder Layout

```text
src/app/
  core/
    auth/
    http/
    guards/
    layout/
  shared/
    ui/
    forms/
    models/
    utils/
  features/
    auth/
    accounts/
    catalogs/
    expenses/
    debts/
    budgets/
    income/
    dashboard/
    imports/
```

## HTTP Layer

- `AuthInterceptor`: attaches `Authorization: Bearer <token>`.
- `ErrorInterceptor`: normalizes backend `ApiErrorResponse`.
- `CorrelationIdInterceptor` optional: read and display correlation ID for support.

## State

Keep state lean:

- Auth user/token in `AuthStore`.
- Selected account in `AccountStore`.
- Catalog cache per account.
- Feature stores with signals for route-local data.
- Persisted filters per account through `FeatureFilterStorageService` for expenses, analytics dashboard, income, debts, budgets and catalogs.

Avoid global state for every table row; refetch on route changes or after mutations.

## Current Navigation Notes

- Dashboard is the single analytics experience.
- The legacy `/app/accounts/:accountId/analytics` route redirects to Dashboard for old links.
- The sidebar must not expose an Analytics placeholder.
- Switching account from the topbar preserves the current account-scoped section when safe.
