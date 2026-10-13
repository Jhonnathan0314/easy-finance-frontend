import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { take } from 'rxjs';

import { CatalogsApiService } from '../../../core/catalogs/catalogs-api.service';
import { CreditCardClosingStore } from '../../../core/expenses/credit-card-closing.store';
import { AccountStore } from '../../../core/state/account.store';
import { CategoryResponseDto, ClosingTargetState, PaymentMethodResponseDto } from '../../../shared/models';
import { MultiSelectDropdownComponent, MultiSelectOption } from '../../../shared/ui/multi-select-dropdown.component';

@Component({
  selector: 'ef-credit-card-closing-page',
  standalone: true,
  imports: [CurrencyPipe, MultiSelectDropdownComponent, ReactiveFormsModule, RouterLink],
  styleUrl: './credit-card-closing-page.component.scss',
  template: `
    <section class="page-shell">
      <div class="page-header">
        <div>
          <h1 class="page-title">Cierre de tarjeta de crédito</h1>
          <p class="page-subtitle">
            Marca en bloque como pagados, o pasa a «en bolsillo», los gastos pendientes de una tarjeta en un rango de fechas.
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
              Se {{ result.targetState === 'IN_POCKET' ? 'pasaron a en bolsillo' : 'marcaron como pagados' }}
              <strong>{{ result.updatedCount }}</strong> gastos por un total de
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
            <div class="field">
              <span>Categorías</span>
              <ef-multi-select-dropdown
                [options]="categoryOptions()"
                [selectedIds]="filterForm.controls.categoryIds.value"
                placeholder="Todas"
                (selectedIdsChange)="filterForm.controls.categoryIds.setValue($event)"
              />
            </div>
            <label class="field">
              <span>Acción al confirmar</span>
              <select formControlName="targetState">
                <option value="PAID">Marcar como pagado</option>
                <option value="IN_POCKET">Pasar a en bolsillo</option>
              </select>
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
              <p class="hint">
                {{ selectedExpenses().length }} de {{ preview.totalCount }} gastos seleccionados entre {{ preview.from }} y {{ preview.to }}.
              </p>
              <strong class="closing-total">{{ selectedTotal() | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>

              @if (preview.expenses.length) {
                <div class="table-scroll">
                  <table class="category-breakdown">
                    <thead>
                      <tr>
                        <th>Categoría</th>
                        <th>Gastos</th>
                        <th>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of selectedByCategory(); track item.categoryId) {
                        <tr>
                          <td>{{ item.categoryName }}</td>
                          <td>{{ item.count }}</td>
                          <td>{{ item.amount | currency: 'COP':'symbol-narrow':'1.0-0' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                <div class="table-scroll closing-expense-scroll">
                  <table class="closing-expense-table">
                    <thead>
                      <tr>
                        <th class="check-col">
                          <input
                            type="checkbox"
                            aria-label="Seleccionar todos los gastos"
                            [checked]="allSelected()"
                            (change)="toggleAll($any($event.target).checked)"
                          >
                        </th>
                        <th>Fecha</th>
                        <th>Descripción</th>
                        <th>Categoría</th>
                        <th class="amount-col">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (expense of preview.expenses; track expense.id) {
                        <tr [class.deselected]="!isSelected(expense.id)">
                          <td class="check-col">
                            <input
                              type="checkbox"
                              [attr.aria-label]="'Incluir ' + expense.description"
                              [checked]="isSelected(expense.id)"
                              (change)="toggleExpense(expense.id)"
                            >
                          </td>
                          <td>{{ expense.expenseDate }}</td>
                          <td>{{ expense.description }}</td>
                          <td>{{ categoryName(expense.categoryId) }}</td>
                          <td class="amount-col">{{ expense.amount | currency: 'COP':'symbol-narrow':'1.0-0' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                <div class="form-actions">
                  <button class="button" type="button" [disabled]="store.isConfirming() || !selectedExpenses().length" (click)="confirmClosing(preview.paymentMethodId, preview.from, preview.to)">
                    {{ store.isConfirming() ? 'Aplicando...' : confirmLabel() }}
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

  private readonly deselectedIds = signal<ReadonlySet<number>>(new Set());
  readonly selectedExpenses = computed(() =>
    (this.store.preview()?.expenses ?? []).filter((expense) => !this.deselectedIds().has(expense.id))
  );
  readonly selectedTotal = computed(() => this.selectedExpenses().reduce((sum, expense) => sum + expense.amount, 0));
  readonly selectedByCategory = computed(() => {
    const names = new Map((this.store.preview()?.byCategory ?? []).map((item) => [item.categoryId, item.categoryName]));
    const groups = new Map<number, { categoryId: number; categoryName: string; amount: number; count: number }>();

    for (const expense of this.selectedExpenses()) {
      const group = groups.get(expense.categoryId) ?? {
        categoryId: expense.categoryId,
        categoryName: names.get(expense.categoryId) ?? this.categoryName(expense.categoryId),
        amount: 0,
        count: 0
      };
      group.amount += expense.amount;
      group.count += 1;
      groups.set(expense.categoryId, group);
    }

    return [...groups.values()].sort((a, b) => b.amount - a.amount);
  });
  readonly allSelected = computed(() => {
    const total = this.store.preview()?.expenses.length ?? 0;
    return total > 0 && this.selectedExpenses().length === total;
  });

  readonly creditCards = signal<PaymentMethodResponseDto[]>([]);
  readonly categories = signal<CategoryResponseDto[]>([]);
  readonly categoryOptions = computed<MultiSelectOption[]>(() =>
    this.categories().map((category) => ({ id: category.id, label: category.name }))
  );
  private appliedCategoryIds: number[] = [];
  private readonly appliedTargetState = signal<ClosingTargetState>('PAID');
  readonly confirmLabel = computed(() => (this.appliedTargetState() === 'IN_POCKET' ? 'Pasar a en bolsillo' : 'Marcar como pagado'));
  readonly accountId = computed(() => this.accountStore.selectedAccountId() ?? 0);
  readonly isAdmin = computed(() => this.accountStore.selectedAccount()?.currentUserRole === 'ACCOUNT_ADMIN');

  readonly filterForm = this.fb.group({
    paymentMethodId: [0, [Validators.required, Validators.min(1)]],
    from: ['', [Validators.required]],
    to: ['', [Validators.required]],
    categoryIds: [[] as number[]],
    targetState: ['PAID' as ClosingTargetState]
  });

  ngOnInit(): void {
    this.store.reset();
    this.loadCreditCards();
    this.loadCategories();
  }

  calculate(): void {
    if (this.filterForm.invalid) {
      this.filterForm.markAllAsTouched();
      return;
    }

    const raw = this.filterForm.getRawValue();
    this.deselectedIds.set(new Set());
    this.appliedCategoryIds = raw.categoryIds;
    this.appliedTargetState.set(raw.targetState);
    this.store.calculate(this.accountId(), raw.paymentMethodId, raw.from, raw.to, raw.categoryIds, raw.targetState).pipe(take(1)).subscribe({ error: () => undefined });
  }

  confirmClosing(paymentMethodId: number, from: string, to: string): void {
    const preview = this.store.preview();

    if (!preview || !this.selectedExpenses().length || !globalThis.confirm(`¿${this.appliedTargetState() === 'IN_POCKET' ? 'Pasar a en bolsillo' : 'Marcar como pagados'} ${this.selectedExpenses().length} gastos por ${this.selectedTotal()}?`)) {
      return;
    }

    this.store.confirm(this.accountId(), paymentMethodId, from, to, this.appliedCategoryIds, this.appliedTargetState(), this.selectedExpenses().map((expense) => expense.id)).pipe(take(1)).subscribe({ error: () => undefined });
  }

  startNewClosing(): void {
    this.store.reset();
    this.filterForm.reset({ paymentMethodId: 0, from: '', to: '', categoryIds: [], targetState: 'PAID' });
  }

  isSelected(expenseId: number): boolean {
    return !this.deselectedIds().has(expenseId);
  }

  toggleExpense(expenseId: number): void {
    const next = new Set(this.deselectedIds());

    if (!next.delete(expenseId)) {
      next.add(expenseId);
    }

    this.deselectedIds.set(next);
  }

  toggleAll(selectAll: boolean): void {
    this.deselectedIds.set(selectAll ? new Set() : new Set((this.store.preview()?.expenses ?? []).map((expense) => expense.id)));
  }

  categoryName(categoryId: number): string {
    const fromPreview = this.store.preview()?.byCategory.find((item) => item.categoryId === categoryId)?.categoryName;

    return fromPreview ?? this.categories().find((category) => category.id === categoryId)?.name ?? '-';
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

  private loadCategories(): void {
    this.catalogsApi
      .listCategories(this.accountId(), { type: 'EXPENSE', status: 'ACTIVE', size: 100, sort: 'name,asc' })
      .pipe(take(1))
      .subscribe({
        next: (page) => this.categories.set(page.content),
        error: () => this.categories.set([])
      });
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
