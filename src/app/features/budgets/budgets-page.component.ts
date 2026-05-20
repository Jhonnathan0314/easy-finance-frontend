import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { take } from 'rxjs';

import { BudgetPersistedFilters, BudgetsStore } from '../../core/budgets/budgets.store';
import { CatalogsApiService } from '../../core/catalogs/catalogs-api.service';
import { AccountStore } from '../../core/state/account.store';
import {
  BudgetImpactResponseDto,
  BudgetResponseDto,
  BudgetStatus,
  CategoryResponseDto,
  SubBudgetResponseDto
} from '../../shared/models';

type BudgetPeriodSort = 'month,desc' | 'month,asc';

@Component({
  selector: 'ef-budgets-page',
  standalone: true,
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink],
  styleUrl: './budgets-page.component.scss',
  template: `
    <section class="page-shell">
      <div class="page-header">
        <div>
          <h1 class="page-title">Presupuestos</h1>
          <p class="page-subtitle">Presupuestos mensuales de la cuenta {{ accountId() }}.</p>
        </div>
        @if (canWrite()) {
          <button class="button" type="button" (click)="startUpsertBudget()">Crear/actualizar presupuesto</button>
        } @else {
          <span class="permission-note">Solo lectura</span>
        }
      </div>

      @if (accountStore.selectedAccountArchived()) {
        <div class="panel warning-panel">La cuenta esta archivada. Las acciones de escritura estan bloqueadas.</div>
      }

      @if (!expenseCategories().length) {
        <div class="panel warning-panel">
          No hay categorias EXPENSE activas para subpresupuestos manuales.
          <a [routerLink]="['/app/accounts', accountId(), 'catalogs']">Ir a catalogos</a>
        </div>
      }

      @if (successMessage(); as message) {
        <div class="panel success-panel">{{ message }}</div>
      }

      @if (budgetsStore.error(); as error) {
        <div class="panel error-panel" role="alert">
          <strong>{{ error.code }}</strong>
          <span>{{ friendlyError(error.code, error.message) }}</span>
        </div>
      }

      <section class="panel filters-panel" aria-label="Filtros de presupuestos">
        <div class="filter-panel-heading">
          <div>
            <h2>Lista anual</h2>
            <p>Filtra los presupuestos del anio seleccionado y ordena sus meses.</p>
          </div>
        </div>

        <form class="filters budget-list-filters" [formGroup]="listFilterForm" (ngSubmit)="loadBudgets()">
          <label>
            <span>Anio</span>
            <input type="number" min="2000" max="2100" formControlName="year">
          </label>
          <label>
            <span>Estado</span>
            <select formControlName="status">
              <option value="">Todos</option>
              @for (status of budgetStatuses; track status) {
                <option [value]="status">{{ status }}</option>
              }
            </select>
          </label>
          <div class="sort-field" aria-label="Orden de presupuestos por periodo">
            <span>Orden por periodo</span>
            <div class="sort-actions">
              @for (option of periodSortOptions; track option.value) {
                <button
                  type="button"
                  [class.active]="currentPeriodSort() === option.value"
                  [attr.aria-pressed]="currentPeriodSort() === option.value"
                  (click)="changePeriodSort(option.value)">
                  {{ option.label }}
                </button>
              }
            </div>
          </div>
          <div class="filter-actions">
            <button type="submit">Filtrar</button>
            <button type="button" (click)="clearFilters()">Limpiar filtros</button>
          </div>
        </form>
      </section>

      <section class="panel filters-panel" aria-label="Selector de presupuesto mensual">
        <div class="filter-panel-heading">
          <div>
            <h2>Detalle mensual</h2>
            <p>Selecciona el mes que quieres revisar en detalle.</p>
          </div>
        </div>

        <form class="filters period-filters" [formGroup]="periodForm" (ngSubmit)="loadSelectedBudgetDetail()">
          <label>
            <span>Anio</span>
            <input type="number" min="2000" max="2100" formControlName="year">
          </label>
          <label>
            <span>Mes</span>
            <select formControlName="month">
              @for (month of months; track month.value) {
                <option [ngValue]="month.value">{{ month.label }}</option>
              }
            </select>
          </label>
          <div class="filter-actions">
            <button type="submit">Ver presupuesto</button>
            <button type="button" (click)="clearFilters()">Limpiar filtros</button>
          </div>
        </form>
      </section>

      @if (showBudgetForm()) {
        <form class="panel form-grid budget-form" [formGroup]="budgetForm" (ngSubmit)="saveBudget()">
          <h2>Presupuesto mensual</h2>
          <label class="field">
            <span>Anio</span>
            <input type="number" min="2000" max="2100" formControlName="year">
          </label>
          <label class="field">
            <span>Mes</span>
            <select formControlName="month">
              @for (month of months; track month.value) {
                <option [ngValue]="month.value">{{ month.label }}</option>
              }
            </select>
          </label>
          <label class="field">
            <span>Nombre</span>
            <input type="text" formControlName="name">
          </label>
          <label class="field">
            <span>Status</span>
            <select formControlName="status">
              @for (status of budgetStatuses; track status) {
                <option [value]="status">{{ status }}</option>
              }
            </select>
          </label>
          <div class="form-actions">
            <button class="button" type="submit" [disabled]="budgetForm.invalid || budgetsStore.isSaving()">Guardar</button>
            <button type="button" (click)="showBudgetForm.set(false)">Cancelar</button>
          </div>
        </form>
      }

      <div class="content-grid">
        <section class="budget-list-panel">
          <div class="section-heading">
            <h2>Presupuestos del anio</h2>
            <span>{{ budgetsStore.pagination().totalElements }} registros</span>
          </div>

          @if (budgetsStore.isLoading() && !budgetsStore.budgets().length) {
            <div class="panel">Cargando presupuestos...</div>
          } @else if (!budgetsStore.budgets().length) {
            <div class="panel empty-state">
              <h2>No hay presupuestos para este anio</h2>
              @if (canWrite()) {
                <button class="button" type="button" (click)="startUpsertBudget()">Crear presupuesto mensual</button>
              }
            </div>
          } @else {
            <div class="budget-list">
              @for (budget of budgetsStore.budgets(); track budget.id) {
                <article
                  class="budget-card"
                  [class.selected]="budgetsStore.selectedBudgetDetail()?.budget?.id === budget.id"
                >
                  <div>
                    <h3>{{ budget.name || monthLabel(budget.month) }}</h3>
                    <p>{{ monthLabel(budget.month) }} {{ budget.year }}</p>
                  </div>
                  <span class="status-badge">{{ budget.status }}</span>
                  <div class="actions">
                    <button type="button" (click)="selectBudget(budget)">Ver detalle</button>
                    @if (canWrite()) {
                      <button type="button" (click)="startUpsertBudget(budget)">Editar</button>
                    }
                  </div>
                </article>
              }
            </div>
          }
        </section>

        <section class="detail-column">
          @if (budgetsStore.selectedBudgetDetail(); as detail) {
            <div class="panel detail-panel">
              <div class="detail-heading">
                <div>
                  <h2>{{ detail.budget.name || monthLabel(detail.budget.month) }}</h2>
                  <p>{{ monthLabel(detail.budget.month) }} {{ detail.budget.year }}</p>
                </div>
                <div class="detail-actions">
                  <span class="status-badge">{{ detail.budget.status }}</span>
                  @if (canWrite()) {
                    <button class="button" type="button" (click)="startDuplicateBudget()">Duplicar presupuesto</button>
                  }
                </div>
              </div>

              <dl class="summary-grid">
                <div>
                  <dt>Expected</dt>
                  <dd>{{ impactTotals().expected | currency: 'COP':'symbol-narrow':'1.0-0' }}</dd>
                </div>
                <div>
                  <dt>Paid</dt>
                  <dd>{{ impactTotals().paid | currency: 'COP':'symbol-narrow':'1.0-0' }}</dd>
                </div>
                <div>
                  <dt>Pending</dt>
                  <dd>{{ impactTotals().pending | currency: 'COP':'symbol-narrow':'1.0-0' }}</dd>
                </div>
                <div>
                  <dt>Avance impacts</dt>
                  <dd>{{ impactProgress() }}%</dd>
                </div>
              </dl>

              <div class="progress">
                <div class="progress-label">
                  <span>Paid / expected</span>
                  <span>{{ impactProgress() }}%</span>
                </div>
                <div class="progress-track"><span [style.width.%]="impactProgress()"></span></div>
              </div>
            </div>

            @if (showDuplicateBudgetForm()) {
              <form class="panel form-grid duplicate-form" [formGroup]="duplicateBudgetForm" (ngSubmit)="saveDuplicateBudget()">
                <h2>Duplicar presupuesto</h2>
                <p class="form-note">
                  Origen: {{ monthLabel(detail.budget.month) }} {{ detail.budget.year }}. Se copiaran solo los subpresupuestos manuales activos.
                </p>
                @if (duplicateBudgetError(); as error) {
                  <p class="form-error">{{ error }}</p>
                }
                <label class="field">
                  <span>Anio destino</span>
                  <input type="number" min="2000" max="2100" formControlName="targetYear">
                </label>
                <label class="field">
                  <span>Mes destino</span>
                  <select formControlName="targetMonth">
                    @for (month of months; track month.value) {
                      <option [ngValue]="month.value">{{ month.label }}</option>
                    }
                  </select>
                </label>
                <label class="field">
                  <span>Nombre</span>
                  <input type="text" formControlName="name">
                </label>
                <div class="form-actions">
                  <button class="button" type="submit" [disabled]="duplicateBudgetForm.invalid || budgetsStore.isSaving()">
                    Duplicar
                  </button>
                  <button type="button" (click)="cancelDuplicateBudgetForm()">Cancelar</button>
                </div>
              </form>
            }

            <section class="panel subbudget-section">
              <div class="section-heading">
                <h2>Subpresupuestos</h2>
                @if (canWrite()) {
                  <button class="button" type="button" (click)="startCreateSubBudget()" [disabled]="!expenseCategories().length">
                    Nuevo subpresupuesto
                  </button>
                }
              </div>

              @if (showSubBudgetForm()) {
                <form class="form-grid subbudget-form" [formGroup]="subBudgetForm" (ngSubmit)="saveSubBudget()">
                  <h3>{{ editingSubBudget() ? 'Editar subpresupuesto' : 'Crear subpresupuesto' }}</h3>
                  <label class="field">
                    <span>Categoria</span>
                    <select formControlName="categoryId">
                      <option value="">Sin categoria</option>
                      @for (category of expenseCategories(); track category.id) {
                        <option [ngValue]="category.id">{{ category.name }}</option>
                      }
                    </select>
                  </label>
                  <label class="field">
                    <span>Nombre</span>
                    <input type="text" formControlName="name">
                  </label>
                  <label class="field">
                    <span>Planeado</span>
                    <input type="number" min="0" step="0.01" formControlName="plannedAmount">
                  </label>
                  <div class="form-actions">
                    <button class="button" type="submit" [disabled]="subBudgetForm.invalid || budgetsStore.isSaving()">Guardar</button>
                    <button type="button" (click)="cancelSubBudgetForm()">Cancelar</button>
                  </div>
                </form>
              }

              @if (!detail.subBudgets.length) {
                <p class="muted">No hay subpresupuestos para este mes.</p>
              } @else {
                <div class="subbudget-list">
                  @for (subBudget of detail.subBudgets; track subBudget.id) {
                    <article class="subbudget-card">
                      <div>
                        <h3>{{ subBudget.name }}</h3>
                        <p>{{ categoryName(subBudget.categoryId) }} - {{ subBudget.sourceType }}</p>
                      </div>
                      <div class="amount-block">
                        <strong>{{ subBudget.spentAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
                        <span>de {{ subBudget.plannedAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}</span>
                      </div>
                      <div class="progress">
                        <div class="progress-label">
                          <span>Spent / planned</span>
                          <span>{{ subBudgetProgress(subBudget) }}%</span>
                        </div>
                        <div class="progress-track"><span [style.width.%]="subBudgetProgress(subBudget)"></span></div>
                      </div>
                      <div class="badges">
                        <span>{{ subBudget.status }}</span>
                        <span>{{ subBudget.sourceType }}</span>
                      </div>
                      @if (canMutateSubBudget(subBudget)) {
                        <div class="actions">
                          <button type="button" (click)="startEditSubBudget(subBudget)">Editar</button>
                          <button
                            type="button"
                            [disabled]="subBudget.status === 'INACTIVE'"
                            (click)="deactivateSubBudget(subBudget)"
                          >
                            Desactivar
                          </button>
                        </div>
                      }
                    </article>
                  }
                </div>
              }
            </section>

            <section class="panel impacts-section">
              <div class="section-heading">
                <h2>Impacts presupuestarios</h2>
                <span>{{ detail.impacts.length }} registros</span>
              </div>

              @if (!detail.impacts.length) {
                <p class="muted">No hay impacts generados desde gastos en cuotas/deudas para este mes.</p>
              } @else {
                <div class="impact-list">
                  @for (impact of detail.impacts; track impact.id) {
                    <article class="impact-row">
                      <div>
                        <strong>{{ impact.periodYear }}-{{ twoDigits(impact.periodMonth) }}</strong>
                        <span>Debt {{ impact.debtId }} @if (impact.expenseId) { - Expense {{ impact.expenseId }} }</span>
                      </div>
                      <div>
                        <span>Expected</span>
                        <strong>{{ impact.expectedAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
                      </div>
                      <div>
                        <span>Paid</span>
                        <strong>{{ impact.paidAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
                      </div>
                      <div>
                        <span>Pending</span>
                        <strong>{{ impactPending(impact) | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
                      </div>
                      <div class="badges">
                        <span>{{ impact.status }}</span>
                        <span>{{ impact.sourceType }}</span>
                      </div>
                    </article>
                  }
                </div>
              }
            </section>
          } @else {
            <div class="panel empty-state">
              <h2>No hay presupuesto para este mes</h2>
              <p>Selecciona otro periodo o crea el presupuesto mensual para comenzar.</p>
              @if (canWrite()) {
                <button class="button" type="button" (click)="startUpsertBudget()">Crear presupuesto mensual</button>
              }
            </div>
          }
        </section>
      </div>
    </section>
  `
})
export class BudgetsPageComponent implements OnInit {
  protected readonly budgetsStore = inject(BudgetsStore);
  protected readonly accountStore = inject(AccountStore);
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly currentDate = new Date();
  readonly expenseCategories = signal<CategoryResponseDto[]>([]);
  readonly showBudgetForm = signal(false);
  readonly showDuplicateBudgetForm = signal(false);
  readonly showSubBudgetForm = signal(false);
  readonly editingSubBudget = signal<SubBudgetResponseDto | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly duplicateBudgetError = signal<string | null>(null);
  readonly accountId = computed(() => this.accountStore.selectedAccountId() ?? 0);
  readonly canWrite = computed(
    () => this.accountStore.selectedAccount()?.currentUserRole === 'ACCOUNT_ADMIN' && !this.accountStore.selectedAccountArchived()
  );
  readonly impactTotals = computed(() => {
    const impacts = this.budgetsStore.selectedBudgetDetail()?.impacts ?? [];
    const expected = impacts.reduce((total, impact) => total + impact.expectedAmount, 0);
    const paid = impacts.reduce((total, impact) => total + impact.paidAmount, 0);

    return {
      expected,
      paid,
      pending: Math.max(0, expected - paid)
    };
  });
  readonly impactProgress = computed(() => {
    const totals = this.impactTotals();

    return totals.expected > 0 ? Math.min(100, Math.round((totals.paid / totals.expected) * 100)) : 0;
  });
  readonly currentPeriodSort = computed<BudgetPeriodSort>(() =>
    this.budgetsStore.filters().sort === 'month,asc' ? 'month,asc' : 'month,desc'
  );

  readonly budgetStatuses: BudgetStatus[] = ['ACTIVE', 'CLOSED', 'ARCHIVED'];
  readonly periodSortOptions: Array<{ value: BudgetPeriodSort; label: string }> = [
    { value: 'month,desc', label: 'Mas recientes primero' },
    { value: 'month,asc', label: 'Mas antiguos primero' }
  ];
  readonly months = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ];

  readonly listFilterForm = this.fb.group({
    year: [this.currentDate.getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]],
    status: ['']
  });
  readonly periodForm = this.fb.group({
    year: [this.currentDate.getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]],
    month: [this.currentDate.getMonth() + 1, [Validators.required, Validators.min(1), Validators.max(12)]]
  });
  readonly budgetForm = this.fb.group({
    year: [this.currentDate.getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]],
    month: [this.currentDate.getMonth() + 1, [Validators.required, Validators.min(1), Validators.max(12)]],
    name: ['', [Validators.maxLength(120)]],
    status: ['ACTIVE' as BudgetStatus, [Validators.required]]
  });
  readonly duplicateBudgetForm = this.fb.group({
    targetYear: [this.currentDate.getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]],
    targetMonth: [this.currentDate.getMonth() + 1, [Validators.required, Validators.min(1), Validators.max(12)]],
    name: ['', [Validators.maxLength(120)]]
  });
  readonly subBudgetForm = this.fb.group({
    categoryId: [null as number | null],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    plannedAmount: [0, [Validators.required, Validators.min(0)]]
  });

  ngOnInit(): void {
    this.loadCategories();
    this.patchFilters(this.budgetsStore.loadPersistedFilters(this.accountId()));
    this.loadBudgets();
  }

  loadBudgets(): void {
    if (this.listFilterForm.invalid) {
      this.listFilterForm.markAllAsTouched();
      return;
    }

    const raw = this.listFilterForm.getRawValue();
    this.budgetsStore
      .loadBudgets(this.accountId(), {
        year: raw.year,
        status: raw.status ? (raw.status as BudgetStatus) : null,
        page: 0
      },
      { persist: true })
      .pipe(take(1))
      .subscribe({ error: () => undefined });
  }

  changePeriodSort(sort: BudgetPeriodSort): void {
    if (this.currentPeriodSort() === sort) {
      return;
    }

    this.budgetsStore
      .loadBudgets(this.accountId(), { sort, page: 0 }, { persist: true })
      .pipe(take(1))
      .subscribe({ error: () => undefined });
  }

  loadSelectedBudgetDetail(): void {
    if (this.periodForm.invalid) {
      this.periodForm.markAllAsTouched();
      return;
    }

    const raw = this.periodForm.getRawValue();
    this.budgetsStore
      .getBudgetDetail(this.accountId(), raw.year, raw.month, { persist: true })
      .pipe(take(1))
      .subscribe({ error: () => undefined });
  }

  selectBudget(budget: BudgetResponseDto): void {
    this.periodForm.patchValue({ year: budget.year, month: budget.month });
    this.budgetsStore
      .getBudgetDetail(this.accountId(), budget.year, budget.month, { persist: true })
      .pipe(take(1))
      .subscribe({ error: () => undefined });
  }

  clearFilters(): void {
    this.patchFilters(this.budgetsStore.clearPersistedFilters(this.accountId()));
    this.budgetsStore.selectedBudgetDetail.set(null);
    this.budgetsStore.loadBudgets(this.accountId()).pipe(take(1)).subscribe({ error: () => undefined });
  }

  startUpsertBudget(budget?: BudgetResponseDto): void {
    if (!this.canWrite()) {
      return;
    }

    const detailBudget = this.budgetsStore.selectedBudgetDetail()?.budget;
    const source = budget ?? detailBudget;
    const period = this.periodForm.getRawValue();

    this.budgetForm.reset({
      year: source?.year ?? period.year,
      month: source?.month ?? period.month,
      name: source?.name ?? '',
      status: source?.status ?? 'ACTIVE'
    });
    this.showBudgetForm.set(true);
  }

  startDuplicateBudget(): void {
    const source = this.budgetsStore.selectedBudgetDetail()?.budget;

    if (!source || !this.canWrite()) {
      return;
    }

    const target = this.nextPeriod(source.year, source.month);

    this.duplicateBudgetError.set(null);
    this.duplicateBudgetForm.reset({
      targetYear: target.year,
      targetMonth: target.month,
      name: source.name ?? ''
    });
    this.showDuplicateBudgetForm.set(true);
  }

  saveDuplicateBudget(): void {
    const source = this.budgetsStore.selectedBudgetDetail()?.budget;

    if (!source || this.duplicateBudgetForm.invalid || !this.canWrite()) {
      this.duplicateBudgetForm.markAllAsTouched();
      return;
    }

    const raw = this.duplicateBudgetForm.getRawValue();

    if (raw.targetYear === source.year && raw.targetMonth === source.month) {
      this.duplicateBudgetError.set('El mes destino debe ser diferente al presupuesto origen.');
      return;
    }

    if (
      !globalThis.confirm('Se copiaran solo los subpresupuestos manuales activos. No se copiaran impacts ni ejecucion.')
    ) {
      return;
    }

    this.successMessage.set(null);
    this.duplicateBudgetError.set(null);

    this.budgetsStore
      .duplicateBudget(this.accountId(), source.year, source.month, {
        targetYear: raw.targetYear,
        targetMonth: raw.targetMonth,
        name: raw.name || null
      })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.periodForm.patchValue({ year: raw.targetYear, month: raw.targetMonth });
          this.listFilterForm.patchValue({ year: raw.targetYear });
          this.successMessage.set('Presupuesto duplicado correctamente.');
          this.cancelDuplicateBudgetForm();
        },
        error: () => undefined
      });
  }

  cancelDuplicateBudgetForm(): void {
    this.showDuplicateBudgetForm.set(false);
    this.duplicateBudgetError.set(null);
  }

  saveBudget(): void {
    if (this.budgetForm.invalid || !this.canWrite()) {
      this.budgetForm.markAllAsTouched();
      return;
    }

    this.successMessage.set(null);
    const raw = this.budgetForm.getRawValue();

    this.budgetsStore
      .upsertBudget(this.accountId(), raw.year, raw.month, {
        name: raw.name || null,
        status: raw.status
      })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.periodForm.patchValue({ year: raw.year, month: raw.month });
          this.listFilterForm.patchValue({ year: raw.year });
          this.successMessage.set('Presupuesto mensual guardado.');
          this.showBudgetForm.set(false);
        },
        error: () => undefined
      });
  }

  startCreateSubBudget(): void {
    if (!this.canWrite() || !this.budgetsStore.selectedBudgetDetail()) {
      return;
    }

    this.editingSubBudget.set(null);
    this.subBudgetForm.reset({
      categoryId: null,
      name: '',
      plannedAmount: 0
    });
    this.showSubBudgetForm.set(true);
  }

  startEditSubBudget(subBudget: SubBudgetResponseDto): void {
    if (!this.canMutateSubBudget(subBudget)) {
      return;
    }

    this.editingSubBudget.set(subBudget);
    this.subBudgetForm.reset({
      categoryId: subBudget.categoryId ?? null,
      name: subBudget.name,
      plannedAmount: subBudget.plannedAmount
    });
    this.showSubBudgetForm.set(true);
  }

  saveSubBudget(): void {
    const detail = this.budgetsStore.selectedBudgetDetail();

    if (!detail || this.subBudgetForm.invalid || !this.canWrite()) {
      this.subBudgetForm.markAllAsTouched();
      return;
    }

    this.successMessage.set(null);
    const raw = this.subBudgetForm.getRawValue();
    const editing = this.editingSubBudget();
    const request = {
      categoryId: raw.categoryId || null,
      name: raw.name,
      plannedAmount: raw.plannedAmount
    };
    const request$ = editing
      ? this.budgetsStore.updateSubBudget(this.accountId(), detail.budget.id, editing.id, request)
      : this.budgetsStore.createSubBudget(this.accountId(), detail.budget.id, request);

    request$.pipe(take(1)).subscribe({
      next: () => {
        this.successMessage.set(editing ? 'Subpresupuesto actualizado.' : 'Subpresupuesto creado.');
        this.cancelSubBudgetForm();
      },
      error: () => undefined
    });
  }

  deactivateSubBudget(subBudget: SubBudgetResponseDto): void {
    const detail = this.budgetsStore.selectedBudgetDetail();

    if (!detail || !this.canMutateSubBudget(subBudget) || !globalThis.confirm(`Desactivar subpresupuesto "${subBudget.name}"?`)) {
      return;
    }

    this.budgetsStore
      .deactivateSubBudget(this.accountId(), detail.budget.id, subBudget.id)
      .pipe(take(1))
      .subscribe({
        next: () => this.successMessage.set('Subpresupuesto desactivado.'),
        error: () => undefined
      });
  }

  cancelSubBudgetForm(): void {
    this.showSubBudgetForm.set(false);
    this.editingSubBudget.set(null);
  }

  canMutateSubBudget(subBudget: SubBudgetResponseDto): boolean {
    return this.canWrite() && subBudget.sourceType === 'MANUAL';
  }

  subBudgetProgress(subBudget: SubBudgetResponseDto): number {
    if (subBudget.plannedAmount <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round((subBudget.spentAmount / subBudget.plannedAmount) * 100)));
  }

  impactPending(impact: BudgetImpactResponseDto): number {
    return Math.max(0, impact.expectedAmount - impact.paidAmount);
  }

  monthLabel(month: number): string {
    return this.months.find((item) => item.value === month)?.label ?? `Mes ${month}`;
  }

  categoryName(categoryId?: number | null): string {
    if (!categoryId) {
      return 'Sin categoria';
    }

    return this.expenseCategories().find((category) => category.id === categoryId)?.name ?? `Categoria ${categoryId}`;
  }

  twoDigits(value: number): string {
    return value.toString().padStart(2, '0');
  }

  nextPeriod(year: number, month: number): { year: number; month: number } {
    return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  }

  friendlyError(code: string, fallback: string): string {
    const messages: Record<string, string> = {
      BUDGET_TARGET_ALREADY_EXISTS: 'Ya existe un presupuesto para el mes destino.',
      BUDGET_NOT_FOUND: 'No se encontro el presupuesto origen.',
      ACCOUNT_NOT_ACTIVE: 'La cuenta no permite modificar presupuestos.',
      BUDGET_ALREADY_ARCHIVED: 'El presupuesto esta archivado.',
      SUB_BUDGET_NOT_FOUND: 'El subpresupuesto no existe.',
      SUB_BUDGET_DERIVED_NOT_EDITABLE: 'Los subpresupuestos derivados no se editan manualmente.',
      ACCOUNT_ADMIN_REQUIRED: 'Necesitas rol administrador para esta accion.',
      VALIDATION_ERROR: 'Revisa los datos del formulario.'
    };

    return messages[code] ?? fallback;
  }

  private loadCategories(): void {
    this.catalogsApi
      .listCategories(this.accountId(), { type: 'EXPENSE', status: 'ACTIVE', size: 100, sort: 'name,asc' })
      .pipe(take(1))
      .subscribe({
        next: (page) => this.expenseCategories.set(page.content),
        error: () => this.expenseCategories.set([])
      });
  }

  private patchFilters(filters: BudgetPersistedFilters): void {
    this.listFilterForm.patchValue({
      year: filters.year ?? filters.selectedYear,
      status: filters.status ?? ''
    });
    this.periodForm.patchValue({
      year: filters.selectedYear,
      month: filters.selectedMonth
    });
  }
}
