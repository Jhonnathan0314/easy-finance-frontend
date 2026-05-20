import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';

import { AnalyticsStore, monthPeriodFromRange } from '../../core/analytics/analytics.store';
import { AccountStore } from '../../core/state/account.store';
import {
  AnalyticsDashboardFilters,
  BudgetVsExpensesByCategoryItemDto,
  CashflowGroupBy,
  CashflowItemDto,
  CategoryAmountItemDto,
  PaymentMethodAmountItemDto
} from '../../shared/models';

type QuickPreset = 'THIS_MONTH' | 'LAST_30_DAYS' | 'LAST_3_MONTHS' | 'THIS_YEAR';

@Component({
  selector: 'ef-dashboard-page',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, ReactiveFormsModule],
  styleUrl: './dashboard-page.component.scss',
  template: `
    <section class="page-shell">
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Exploracion financiera de la cuenta {{ accountId() }}.</p>
        </div>
        @if (accountStore.selectedAccountArchived()) {
          <span class="permission-note">Cuenta archivada: lectura habilitada</span>
        }
      </div>

      <form class="panel filters-panel" [formGroup]="filtersForm" (ngSubmit)="loadDashboard()">
        <div class="quick-presets" aria-label="Presets de periodo">
          <button
            type="button"
            class="quick-preset-button"
            [class.active]="activePreset() === 'THIS_MONTH'"
            [attr.aria-pressed]="activePreset() === 'THIS_MONTH'"
            (click)="applyPreset('THIS_MONTH')"
          >
            Este mes
          </button>
          <button
            type="button"
            class="quick-preset-button"
            [class.active]="activePreset() === 'LAST_30_DAYS'"
            [attr.aria-pressed]="activePreset() === 'LAST_30_DAYS'"
            (click)="applyPreset('LAST_30_DAYS')"
          >
            Ultimos 30 dias
          </button>
          <button
            type="button"
            class="quick-preset-button"
            [class.active]="activePreset() === 'LAST_3_MONTHS'"
            [attr.aria-pressed]="activePreset() === 'LAST_3_MONTHS'"
            (click)="applyPreset('LAST_3_MONTHS')"
          >
            Ultimos 3 meses
          </button>
          <button
            type="button"
            class="quick-preset-button"
            [class.active]="activePreset() === 'THIS_YEAR'"
            [attr.aria-pressed]="activePreset() === 'THIS_YEAR'"
            (click)="applyPreset('THIS_YEAR')"
          >
            Este anio
          </button>
        </div>

        <div class="filters">
          <label>
            <span>Desde</span>
            <input type="date" formControlName="from">
          </label>
          <label>
            <span>Hasta</span>
            <input type="date" formControlName="to">
          </label>
          <button type="button" class="secondary-button" (click)="advancedOpen.update(toggle)">
            {{ advancedOpen() ? 'Ocultar filtros' : 'Filtros avanzados' }}
          </button>
          <div class="filter-actions">
            <button type="submit" [disabled]="analyticsStore.loading()">Refrescar</button>
            <button type="button" class="secondary-button" (click)="clearFilters()">Limpiar filtros</button>
          </div>
        </div>

        @if (advancedOpen()) {
          <div class="advanced-filters">
            <label>
              <span>Participante ID</span>
              <input type="number" min="1" formControlName="participantId">
            </label>
            <label>
              <span>Categoria gasto ID</span>
              <input type="number" min="1" formControlName="expenseCategoryId">
            </label>
            <label>
              <span>Categoria ingreso ID</span>
              <input type="number" min="1" formControlName="incomeCategoryId">
            </label>
            <label>
              <span>Medio de pago ID</span>
              <input type="number" min="1" formControlName="paymentMethodId">
            </label>
            <label>
              <span>Status gasto</span>
              <select formControlName="expenseStatus">
                <option value="">Todos</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </label>
            <label>
              <span>Estado pago gasto</span>
              <select formControlName="expensePaymentState">
                <option value="">Todos</option>
                <option value="PENDING">PENDING</option>
                <option value="PARTIAL">PARTIAL</option>
                <option value="PAID">PAID</option>
              </select>
            </label>
            <label>
              <span>Status ingreso</span>
              <select formControlName="incomeStatus">
                <option value="">Todos</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </label>
            <label>
              <span>Tipo gasto</span>
              <select formControlName="expenseType">
                <option value="">Todos</option>
                <option value="SIMPLE">SIMPLE</option>
                <option value="INSTALLMENT">INSTALLMENT</option>
              </select>
            </label>
            <label>
              <span>Agrupar cashflow</span>
              <select formControlName="groupBy">
                @for (group of groupByOptions; track group) {
                  <option [value]="group">{{ group }}</option>
                }
              </select>
            </label>
          </div>
        }
      </form>

      @if (localError(); as error) {
        <div class="panel error-panel" role="alert">{{ error }}</div>
      }

      @if (analyticsStore.error(); as error) {
        <div class="panel error-panel" role="alert">
          <strong>{{ error.code }}</strong>
          <span>{{ friendlyError(error.code, error.message) }}</span>
          <button type="button" (click)="loadDashboard()">Reintentar</button>
        </div>
      }

      @if (analyticsStore.loading()) {
        <div class="skeleton-grid" aria-label="Cargando dashboard">
          @for (item of skeletonItems; track item) {
            <span class="skeleton-card"></span>
          }
        </div>
      }

      @if (analyticsStore.isEmpty() && !analyticsStore.loading()) {
        <div class="panel empty-state">
          <h2>Sin movimientos para este rango</h2>
          <p>Cuando existan ingresos, pagos, gastos o compras en cuotas, el dashboard los mostrara aqui.</p>
        </div>
      }

      @if (analyticsStore.cashflowSummary(); as cashflow) {
        <section class="dashboard-section" aria-label="Cashflow real">
          <div class="section-heading">
            <div>
              <h2>Cashflow real</h2>
              <span>{{ cashflow.from }} a {{ cashflow.to }}</span>
            </div>
            <span class="badge">Dinero real</span>
          </div>
          <div class="kpi-grid">
            <article class="metric-card">
              <span>Ingresos reales</span>
              <strong>{{ cashflow.totalIncome | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
            </article>
            <article class="metric-card">
              <span>Gastos reales pagados</span>
              <strong>{{ cashflow.totalSimpleExpenseOutflow | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
            </article>
            <article class="metric-card">
              <span>Pagos deuda</span>
              <strong>{{ cashflow.totalDebtPaymentOutflow | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
            </article>
            <article class="metric-card">
              <span>Salida total</span>
              <strong>{{ cashflow.totalOutflow | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
            </article>
            <article class="metric-card" [class.positive]="cashflow.netCashflow >= 0" [class.negative]="cashflow.netCashflow < 0">
              <span>Neto</span>
              <strong>{{ cashflow.netCashflow | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
            </article>
          </div>
          <p class="generated-at">Generado {{ cashflow.generatedAt | date: 'medium' }}</p>
        </section>
      }

      @if (analyticsStore.expenseSummary(); as expenses) {
        <section class="dashboard-section" aria-label="Gastos conceptuales">
          <div class="section-heading">
            <div>
              <h2>Compras y gastos conceptuales</h2>
              <span>{{ expenses.from }} a {{ expenses.to }}</span>
            </div>
            <span class="badge muted-badge">Incluye cuotas</span>
          </div>
          <div class="kpi-grid">
            <article class="metric-card">
              <span>Gastos simples</span>
              <strong>{{ expenses.totalSimpleExpenses | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
            </article>
            <article class="metric-card">
              <span>Compras cuotas</span>
              <strong>{{ expenses.totalInstallmentPurchases | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
            </article>
            <article class="metric-card">
              <span>Total conceptual</span>
              <strong>{{ expenses.totalExpensesConceptual | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
            </article>
            <article class="metric-card">
              <span>Cantidad gastos</span>
              <strong>{{ expenses.expensesCount }}</strong>
            </article>
          </div>
        </section>
      }

      <section class="panel budget-comparison-panel" aria-label="Presupuesto vs gastos por categoria">
        @if (monthlyBudgetComparisonPeriod(); as period) {
          <div class="section-heading">
            <div>
              <h2>Presupuesto vs gastos por categoria</h2>
              <span>{{ periodLabel(period.year, period.month) }}</span>
            </div>
            <span class="badge">Mensual</span>
          </div>

          @if (analyticsStore.loading()) {
            <p class="muted">Cargando comparacion de presupuesto...</p>
          } @else if (analyticsStore.budgetVsExpensesByCategory(); as comparison) {
            @if (comparison.length) {
              <div class="comparison-table" role="table" aria-label="Comparacion de presupuesto y gasto conceptual">
                <div class="comparison-row comparison-head" role="row">
                  <span role="columnheader">Categoria</span>
                  <span role="columnheader">Presupuestado</span>
                  <span role="columnheader">Gastado</span>
                  <span role="columnheader">Restante</span>
                  <span role="columnheader">Ejecucion</span>
                </div>
                @for (item of comparison; track item.categoryId) {
                  <div class="comparison-row" [class.overrun]="item.remainingAmount < 0" role="row">
                    <strong role="cell">{{ item.categoryName }}</strong>
                    <span role="cell">{{ item.budgetedAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}</span>
                    <span role="cell">{{ item.spentAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}</span>
                    <span role="cell" [class.negative-text]="item.remainingAmount < 0">
                      {{ item.remainingAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}
                      @if (item.remainingAmount < 0) {
                        <em class="negative-text">Sobre-ejecucion</em>
                      }
                    </span>
                    <span role="cell">
                      @if (item.executionPercentage === null || item.executionPercentage === undefined) {
                        <span class="muted">Sin presupuesto</span>
                      } @else {
                        {{ item.executionPercentage | number: '1.0-2' }}%
                        <span class="bar-track comparison-progress" aria-hidden="true">
                          <span [style.width.%]="executionBarPercent(item)"></span>
                        </span>
                      }
                    </span>
                  </div>
                }
              </div>
            } @else {
              <p class="muted">No hay presupuesto ni gastos por categoria para este mes.</p>
            }
          } @else {
            <p class="muted">No hay datos de comparacion para este mes.</p>
          }
        } @else {
          <div class="section-heading">
            <div>
              <h2>Presupuesto vs gastos por categoria</h2>
              <span>Comparacion mensual</span>
            </div>
            <span class="badge muted-badge">Mes especifico</span>
          </div>
          <p class="muted">La comparacion contra presupuesto esta disponible para un mes especifico.</p>
        }
      </section>

      <div class="dashboard-grid">
        <section class="panel breakdown-panel">
          <div class="section-heading">
            <h2>Gastos por categoria</h2>
            @if (analyticsStore.expensesByCategory(); as breakdown) {
              <span>{{ breakdown.from }} a {{ breakdown.to }}</span>
            }
          </div>
          @if (analyticsStore.expensesByCategory()?.items?.length) {
            <div class="breakdown-list">
              @for (item of analyticsStore.expensesByCategory()?.items ?? []; track item.categoryId) {
                <article class="breakdown-row">
                  <div class="row-heading">
                    <strong>{{ item.categoryName }}</strong>
                    <span>{{ item.count }} registros</span>
                  </div>
                  <div class="bar-track">
                    <span [style.width.%]="categoryPercent(item, analyticsStore.expensesByCategory()?.items ?? [])"></span>
                  </div>
                  <strong>{{ item.amount | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
                </article>
              }
            </div>
          } @else {
            <p class="muted">No hay gastos por categoria para este rango.</p>
          }
        </section>

        <section class="panel breakdown-panel">
          <div class="section-heading">
            <h2>Gastos por medio de pago</h2>
            @if (analyticsStore.expensesByPaymentMethod(); as breakdown) {
              <span>{{ breakdown.from }} a {{ breakdown.to }}</span>
            }
          </div>
          @if (analyticsStore.expensesByPaymentMethod()?.items?.length) {
            <div class="breakdown-list">
              @for (item of analyticsStore.expensesByPaymentMethod()?.items ?? []; track item.paymentMethodId ?? item.paymentMethodName) {
                <article class="breakdown-row payment">
                  <div class="row-heading">
                    <strong>{{ item.paymentMethodName }}</strong>
                    <span>{{ item.count }} registros</span>
                  </div>
                  <div class="bar-track">
                    <span [style.width.%]="paymentMethodPercent(item, analyticsStore.expensesByPaymentMethod()?.items ?? [])"></span>
                  </div>
                  <strong>{{ item.amount | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
                </article>
              }
            </div>
          } @else {
            <p class="muted">No hay gastos por medio de pago para este rango.</p>
          }
        </section>

        <section class="panel breakdown-panel">
          <div class="section-heading">
            <h2>Ingresos por categoria</h2>
            @if (analyticsStore.incomesByCategory(); as breakdown) {
              <span>{{ breakdown.from }} a {{ breakdown.to }}</span>
            }
          </div>
          @if (analyticsStore.incomesByCategory()?.items?.length) {
            <div class="breakdown-list">
              @for (item of analyticsStore.incomesByCategory()?.items ?? []; track item.categoryId) {
                <article class="breakdown-row income">
                  <div class="row-heading">
                    <strong>{{ item.categoryName }}</strong>
                    <span>{{ item.count }} registros</span>
                  </div>
                  <div class="bar-track">
                    <span [style.width.%]="categoryPercent(item, analyticsStore.incomesByCategory()?.items ?? [])"></span>
                  </div>
                  <strong>{{ item.amount | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
                </article>
              }
            </div>
          } @else {
            <p class="muted">No hay ingresos por categoria para este rango.</p>
          }
        </section>

        <section class="panel breakdown-panel timeline-panel">
          <div class="section-heading">
            <h2>Timeline cashflow</h2>
            @if (analyticsStore.cashflowTimeline(); as timeline) {
              <span>{{ timeline.groupBy }}</span>
            }
          </div>
          @if (analyticsStore.cashflowTimeline()?.items?.length) {
            <div class="timeline-list">
              @for (item of analyticsStore.cashflowTimeline()?.items ?? []; track item.period) {
                <article class="timeline-row">
                  <div class="row-heading">
                    <strong>{{ item.period }}</strong>
                    <span [class.positive-text]="item.netCashflow >= 0" [class.negative-text]="item.netCashflow < 0">
                      {{ item.netCashflow | currency: 'COP':'symbol-narrow':'1.0-0' }}
                    </span>
                  </div>
                  <div class="timeline-bars">
                    <span class="income-bar" [style.width.%]="cashflowPercent(item.totalIncome)"></span>
                    <span class="outflow-bar" [style.width.%]="cashflowPercent(item.totalOutflow)"></span>
                  </div>
                  <div class="timeline-detail">
                    <span>Ingreso {{ item.totalIncome | currency: 'COP':'symbol-narrow':'1.0-0' }}</span>
                    <span>Gasto real {{ item.simpleExpenseOutflow | currency: 'COP':'symbol-narrow':'1.0-0' }}</span>
                    <span>Deuda {{ item.debtPaymentOutflow | currency: 'COP':'symbol-narrow':'1.0-0' }}</span>
                  </div>
                </article>
              }
            </div>
          } @else {
            <p class="muted">No hay cashflow para graficar en este rango.</p>
          }
        </section>
      </div>
    </section>
  `
})
export class DashboardPageComponent implements OnInit {
  protected readonly analyticsStore = inject(AnalyticsStore);
  protected readonly accountStore = inject(AccountStore);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly groupByOptions: CashflowGroupBy[] = ['DAY', 'WEEK', 'MONTH'];
  readonly skeletonItems = Array.from({ length: 6 }, (_, index) => index);
  readonly advancedOpen = signal(false);
  readonly localError = signal<string | null>(null);
  readonly accountId = computed(() => this.accountStore.selectedAccountId() ?? 0);
  readonly toggle = (value: boolean) => !value;
  readonly filtersForm = this.fb.group({
    from: ['', [Validators.required]],
    to: ['', [Validators.required]],
    participantId: [''],
    expenseCategoryId: [''],
    incomeCategoryId: [''],
    paymentMethodId: [''],
    expenseStatus: [''],
    expensePaymentState: [''],
    incomeStatus: [''],
    expenseType: [''],
    groupBy: ['MONTH' as CashflowGroupBy, [Validators.required]]
  });

  ngOnInit(): void {
    this.patchFiltersForm(this.analyticsStore.loadPersistedFilters(this.accountId()));
    this.loadDashboard();
  }

  applyPreset(preset: QuickPreset, reload = true): void {
    const range = presetRange(preset);
    this.filtersForm.patchValue({ from: range.from, to: range.to });

    if (reload) {
      this.loadDashboard();
    }
  }

  activePreset(): QuickPreset | null {
    const raw = this.filtersForm.getRawValue();
    const presets: QuickPreset[] = ['THIS_MONTH', 'LAST_30_DAYS', 'LAST_3_MONTHS', 'THIS_YEAR'];

    return presets.find((preset) => {
      const range = presetRange(preset);
      return raw.from === range.from && raw.to === range.to;
    }) ?? null;
  }

  loadDashboard(): void {
    const validationError = this.validateFilters();

    if (validationError) {
      this.localError.set(validationError);
      return;
    }

    this.localError.set(null);
    this.analyticsStore
      .applyFilters(this.accountId(), this.currentFilters())
      .pipe(take(1))
      .subscribe({ error: () => undefined });
  }

  clearFilters(): void {
    this.localError.set(null);
    this.patchFiltersForm(this.analyticsStore.clearPersistedFilters(this.accountId()));
    this.loadDashboardWithoutPersisting();
  }

  currentFilters(): AnalyticsDashboardFilters {
    const raw = this.filtersForm.getRawValue();

    return {
      from: raw.from,
      to: raw.to,
      participantId: nullableNumber(raw.participantId),
      expenseCategoryId: nullableNumber(raw.expenseCategoryId),
      incomeCategoryId: nullableNumber(raw.incomeCategoryId),
      paymentMethodId: nullableNumber(raw.paymentMethodId),
      expenseStatus: raw.expenseStatus || null,
      expensePaymentState: raw.expensePaymentState || null,
      incomeStatus: raw.incomeStatus || null,
      expenseType: raw.expenseType || null,
      groupBy: raw.groupBy as CashflowGroupBy
    };
  }

  private loadDashboardWithoutPersisting(): void {
    const validationError = this.validateFilters();

    if (validationError) {
      this.localError.set(validationError);
      return;
    }

    this.analyticsStore
      .applyFilters(this.accountId(), this.currentFilters(), { persist: false })
      .pipe(take(1))
      .subscribe({ error: () => undefined });
  }

  private patchFiltersForm(filters: AnalyticsDashboardFilters): void {
    this.filtersForm.patchValue({
      from: filters.from,
      to: filters.to,
      participantId: filters.participantId ? String(filters.participantId) : '',
      expenseCategoryId: filters.expenseCategoryId ? String(filters.expenseCategoryId) : '',
      incomeCategoryId: filters.incomeCategoryId ? String(filters.incomeCategoryId) : '',
      paymentMethodId: filters.paymentMethodId ? String(filters.paymentMethodId) : '',
      expenseStatus: filters.expenseStatus ?? '',
      expensePaymentState: filters.expensePaymentState ?? '',
      incomeStatus: filters.incomeStatus ?? '',
      expenseType: filters.expenseType ?? '',
      groupBy: filters.groupBy
    });
  }

  validateFilters(): string | null {
    if (this.filtersForm.invalid) {
      this.filtersForm.markAllAsTouched();
      return 'Selecciona un rango de fechas valido.';
    }

    const raw = this.filtersForm.getRawValue();
    const from = parseDate(raw.from);
    const to = parseDate(raw.to);

    if (!from || !to) {
      return 'Selecciona un rango de fechas valido.';
    }

    if (from.getTime() > to.getTime()) {
      return 'La fecha inicial no puede ser mayor que la fecha final.';
    }

    if (monthsBetween(from, to) > 24) {
      return 'El rango maximo permitido es de 24 meses.';
    }

    return null;
  }

  categoryPercent(item: CategoryAmountItemDto, items: CategoryAmountItemDto[]): number {
    return amountPercent(item.amount, items.map((entry) => entry.amount));
  }

  paymentMethodPercent(item: PaymentMethodAmountItemDto, items: PaymentMethodAmountItemDto[]): number {
    return amountPercent(item.amount, items.map((entry) => entry.amount));
  }

  cashflowPercent(amount: number): number {
    const items = this.analyticsStore.cashflowTimeline()?.items ?? [];
    return amountPercent(
      amount,
      items.flatMap((item) => [item.totalIncome, item.totalOutflow])
    );
  }

  monthlyBudgetComparisonPeriod(): { year: number; month: number } | null {
    const raw = this.filtersForm.getRawValue();
    return monthPeriodFromRange(raw.from, raw.to);
  }

  periodLabel(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  executionBarPercent(item: BudgetVsExpensesByCategoryItemDto): number {
    if (item.executionPercentage === null || item.executionPercentage === undefined) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(item.executionPercentage)));
  }

  friendlyError(code: string, fallback: string): string {
    const messages: Record<string, string> = {
      ANALYTICS_PERIOD_INVALID: 'El periodo seleccionado no es valido.',
      ANALYTICS_DATE_RANGE_INVALID: 'El rango de fechas no es valido.',
      ANALYTICS_DATE_RANGE_TOO_LARGE: 'El rango maximo permitido es de 24 meses.'
    };

    return messages[code] ?? fallback;
  }
}

function presetRange(preset: QuickPreset): { from: string; to: string } {
  const today = new Date();

  if (preset === 'THIS_MONTH') {
    return {
      from: toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: toDateInputValue(new Date(today.getFullYear(), today.getMonth() + 1, 0))
    };
  }

  if (preset === 'LAST_30_DAYS') {
    const from = new Date(today);
    from.setDate(today.getDate() - 29);
    return { from: toDateInputValue(from), to: toDateInputValue(today) };
  }

  if (preset === 'LAST_3_MONTHS') {
    return {
      from: toDateInputValue(new Date(today.getFullYear(), today.getMonth() - 2, 1)),
      to: toDateInputValue(new Date(today.getFullYear(), today.getMonth() + 1, 0))
    };
  }

  return {
    from: toDateInputValue(new Date(today.getFullYear(), 0, 1)),
    to: toDateInputValue(new Date(today.getFullYear(), 11, 31))
  };
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthsBetween(from: Date, to: Date): number {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return months + (to.getDate() >= from.getDate() ? 0 : -1);
}

function nullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function amountPercent(amount: number, amounts: number[]): number {
  const maxAmount = Math.max(...amounts, 0);

  if (maxAmount <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((amount / maxAmount) * 100)));
}
