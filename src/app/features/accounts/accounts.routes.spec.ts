import { ACCOUNTS_ROUTES } from './accounts.routes';

describe('ACCOUNTS_ROUTES', () => {
  it('redirects account analytics links to the dashboard preserving accountId', () => {
    const analyticsRoute = ACCOUNTS_ROUTES.find((route) => route.path === ':accountId/analytics');

    expect(analyticsRoute).toBeDefined();
    expect(analyticsRoute?.redirectTo).toBe(':accountId/dashboard');
    expect(analyticsRoute?.pathMatch).toBe('full');
  });
});
