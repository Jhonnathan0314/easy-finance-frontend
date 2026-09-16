import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { take } from 'rxjs';

import { CatalogsApiService } from '../../../core/catalogs/catalogs-api.service';
import { CreditCardClosingStore } from '../../../core/expenses/credit-card-closing.store';
import { AccountStore } from '../../../core/state/account.store';
import { PaymentMethodResponseDto } from '../../../shared/models';

@Component({
  selector: 'ef-credit-card-closing-page',
  standalone: true,
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink],
  styleUrl: './credit-card-closing-page.component.scss',
  template: `
    <section class="page-shell">
      <div class="page-header">
        <div>
          <h1 class="page-title">Cierre de tarjeta de crédito</h1>
          <p class="page-subtitle">
            Marca en bloque como pagados los gastos pendientes de una tarjeta en un rango de fechas.
          </p>
        </div>
        <a [routerLink]="['/app/accounts', accountId(), 'expenses']">Volver a gastos</a>
      </div>

      @if (!isAdmin()) {
        <div class="panel warning-panel">Solo un administrador de la cuenta puede hacer el cierre de tarjeta.</div>
      } @else {
        @if (store.error(); as error) {
          <div class="panel error-panel" role="alert">
            <strong>{{ error.code }}</strong>
            <span>{{ friendlyError(error.code, error.message) }}</span>
          </div>
        }

        @if (store.result(); as result) {
          <div class="panel success-panel">
            <p>
              Se marcaron <strong>{{ result.updatedCount }}</strong> gastos como pagados por un total de
              <strong>{{ result.totalAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>.
            </p>
            <div class="form-actions">
              <a class="button" [routerLink]="['/app/accounts', accountId(), 'expenses']">Ir al listado de gastos</a>
              <button type="button" (click)="startNewClosing()">Hacer otro cierre</button>
            </div>
          </div>
        } @else {
          <form class="panel form-grid" [formGroup]="filterForm" (ngSubmit)="calculate()">
            <label class="field">
              <span>Tarjeta</span>
              <select formControlName="paymentMethodId">
                <option [ngValue]="0">Selecciona</option>
                @for (card of creditCards(); track card.id) {
                  <option [ngValue]="card.id">{{ card.name }}</option>
                }
              </select>
            </label>
            <label class="field">
              <span>Desde</span>
              <input type="date" formControlName="from">
            </label>
            <label class="field">
              <span>Hasta</span>
              <input type="date" formControlName="to">
            </label>
            <div class="form-actions">
              <button class="button" type="submit" [disabled]="filterForm.invalid || store.isLoadingPreview()">
                {{ store.isLoadingPreview() ? 'Calculando...' : 'Calcular' }}
              </button>
            </div>
          </form>

          @if (!creditCards().length) {
            <div class="panel warning-panel">No hay tarjetas de crédito activas en esta cuenta.</div>
          }

          @if (store.preview(); as preview) {
            <div class="panel">
              <h2>Resumen del cierre</h2>
              <p class="hint">{{ preview.totalCount }} gastos pendientes entre {{ preview.from }} y {{ preview.to }}.</p>
              <strong class="closing-total">{{ preview.totalAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>

              @if (preview.byCategory.length) {
                <table class="category-breakdown">
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th>Gastos</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of preview.byCategory; track item.categoryId) {
                      <tr>
                        <td>{{ item.categoryName }}</td>
                        <td>{{ item.count }}</td>
                        <td>{{ item.amount | currency: 'COP':'symbol-narrow':'1.0-0' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>

                <ul class="closing-expense-list">
                  @for (expense of preview.expenses; track expense.id) {
                    <li>
                      <span>{{ expense.expenseDate }} · {{ expense.description }}</span>
                      <strong>{{ expense.amount | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
                    </li>
                  }
                </ul>

                <div class="form-actions">
                  <button class="button" type="button" [disabled]="store.isConfirming()" (click)="confirmClosing(preview.paymentMethodId, preview.from, preview.to)">
                    {{ store.isConfirming() ? 'Marcando...' : 'Marcar como pagado' }}
                  </button>
                </div>
              } @else {
                <p class="hint">No hay gastos pendientes de esta tarjeta en el rango seleccionado.</p>
              }
            </div>
          }
        }
      }
    </section>
  `
})
export class CreditCardClosingPageComponent implements OnInit {
  protected readonly store = inject(CreditCardClosingStore);
  protected readonly accountStore = inject(AccountStore);
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);

  readonly creditCards = signal<PaymentMethodResponseDto[]>([]);
  readonly accountId = computed(() => this.accountStore.selectedAccountId() ?? 0);
  readonly isAdmin = computed(() => this.accountStore.selectedAccount()?.currentUserRole === 'ACCOUNT_ADMIN');

  readonly filterForm = this.fb.group({
    paymentMethodId: [0, [Validators.required, Validators.min(1)]],
    from: ['', [Validators.required]],
    to: ['', [Validators.required]]
  });

  ngOnInit(): void {
    this.store.reset();
    this.loadCreditCards();
  }

  calculate(): void {
    if (this.filterForm.invalid) {
      this.filterForm.markAllAsTouched();
      return;
    }

    const raw = this.filterForm.getRawValue();
    this.store.calculate(this.accountId(), raw.paymentMethodId, raw.from, raw.to).pipe(take(1)).subscribe({ error: () => undefined });
  }

  confirmClosing(paymentMethodId: number, from: string, to: string): void {
    const preview = this.store.preview();

    if (!preview || !globalThis.confirm(`¿Marcar ${preview.totalCount} gastos como pagados por ${preview.totalAmount}?`)) {
      return;
    }

    this.store.confirm(this.accountId(), paymentMethodId, from, to).pipe(take(1)).subscribe({ error: () => undefined });
  }

  startNewClosing(): void {
    this.store.reset();
    this.filterForm.reset({ paymentMethodId: 0, from: '', to: '' });
  }

  friendlyError(code: string, fallback: string): string {
    const messages: Record<string, string> = {
      ACCOUNT_ADMIN_REQUIRED: 'Solo un administrador de la cuenta puede hacer el cierre de tarjeta.',
      EXPENSE_PAYMENT_METHOD_NOT_FOUND: 'El medio de pago no existe.',
      EXPENSE_PAYMENT_METHOD_INACTIVE: 'El medio de pago está inactivo.',
      CREDIT_CARD_CLOSING_INVALID_PAYMENT_METHOD: 'El medio de pago seleccionado no es una tarjeta de crédito.',
      CREDIT_CARD_CLOSING_EMPTY: 'No hay gastos pendientes para cerrar en el rango seleccionado.',
      EXPENSE_DATE_INVALID: 'El rango de fechas no es válido.',
      VALIDATION_ERROR: 'Revisa los datos del formulario.'
    };

    return messages[code] ?? fallback;
  }

  private loadCreditCards(): void {
    this.catalogsApi
      .listPaymentMethods(this.accountId(), { type: 'CREDIT_CARD', status: 'ACTIVE', size: 100, sort: 'name,asc' })
      .pipe(take(1))
      .subscribe({
        next: (page) => this.creditCards.set(page.content),
        error: () => this.creditCards.set([])
      });
  }
}
