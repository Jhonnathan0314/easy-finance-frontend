import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { take } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { AccountStore } from '../state/account.store';
import { GlobalErrorStore } from '../state/global-error.store';

interface NavigationItem {
  label: string;
  segment: string | null;
}

@Component({
  selector: 'ef-private-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  styleUrl: './private-layout.component.scss',
  template: `
    <div class="layout">
      <aside class="sidebar" aria-label="Navegacion principal">
        <a class="brand" routerLink="/app/accounts">
          <span class="brand-mark">EF</span>
          <span>Easy Finance</span>
        </a>

        <nav class="nav">
          @for (item of navigation; track item.label) {
            <a
              [routerLink]="accountLink(item)"
              routerLinkActive="active"
              [class.disabled]="item.segment && !accountStore.hasSelectedAccount()"
              [routerLinkActiveOptions]="{ exact: item.segment === null }"
            >
              {{ item.label }}
            </a>
          }
        </nav>
      </aside>

      <div class="content">
        <header class="topbar">
          <div class="account-context">
            <label>
              <span>Cuenta</span>
              <select [value]="accountStore.selectedAccountId() ?? ''" (change)="changeAccount($event)">
                <option value="">Sin seleccionar</option>
                @for (account of accountStore.accounts(); track account.id) {
                  <option [value]="account.id">{{ account.name }}</option>
                }
              </select>
            </label>
            @if (accountStore.selectedAccount(); as account) {
              <strong>{{ account.currentUserRole }}</strong>
            }
          </div>

          <div class="user-context">
            <span>{{ authStore.user()?.fullName ?? authStore.user()?.email }}</span>
            <button type="button" (click)="logout()">Salir</button>
          </div>
        </header>

        @if (errorStore.error(); as error) {
          <section class="error-banner" role="alert">
            <strong>{{ error.code }}</strong>
            <span>{{ error.message }}</span>
            @if (error.correlationId) {
              <small>Correlation ID: {{ error.correlationId }}</small>
            }
            <button type="button" (click)="errorStore.clear()">Cerrar</button>
          </section>
        }

        @if (!accountStore.hasSelectedAccount()) {
          <section class="account-banner">
            Selecciona o crea una cuenta para comenzar a registrar movimientos.
          </section>
        }

        @if (accountStore.selectedAccountArchived()) {
          <section class="account-banner archived">
            Esta cuenta esta archivada. Las operaciones de escritura se bloquearan en las siguientes fases.
          </section>
        }

        <main class="main">
          <router-outlet />
        </main>
      </div>
    </div>
  `
})
export class PrivateLayoutComponent implements OnInit {
  protected readonly authStore = inject(AuthStore);
  protected readonly accountStore = inject(AccountStore);
  protected readonly errorStore = inject(GlobalErrorStore);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly navigation: NavigationItem[] = [
    { label: 'Cuentas', segment: null },
    { label: 'Dashboard', segment: 'dashboard' },
    { label: 'Gastos', segment: 'expenses' },
    { label: 'Deudas', segment: 'debts' },
    { label: 'Presupuestos', segment: 'budgets' },
    { label: 'Ingresos', segment: 'income' },
    { label: 'Catalogos', segment: 'catalogs' },
    { label: 'Importaciones', segment: 'imports' }
  ];

  ngOnInit(): void {
    this.accountStore.loadAccounts().pipe(take(1)).subscribe({ error: () => undefined });
  }

  accountLink(item: NavigationItem): string[] {
    if (!item.segment) {
      return ['/app/accounts'];
    }

    const accountId = this.accountStore.selectedAccountId();
    return accountId ? ['/app/accounts', String(accountId), item.segment] : ['/app/accounts'];
  }

  changeAccount(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const accountId = Number(value);
    const account = this.accountStore.accounts().find((item) => item.id === accountId);

    if (!account) {
      this.accountStore.clearSelectedAccount();
      void this.router.navigate(['/app/accounts']);
      return;
    }

    this.accountStore.selectAccount(account);
    void this.router.navigate(['/app/accounts', account.id, 'dashboard']);
  }

  logout(): void {
    this.authService.logout();
    this.accountStore.clear();
    void this.router.navigate(['/login']);
  }
}
