import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { take } from 'rxjs';

import { AccountsApiService } from '../../core/accounts/accounts-api.service';
import { AuthStore } from '../../core/auth/auth.store';
import { BudgetPersistedFilters, BudgetsStore } from '../../core/budgets/budgets.store';
import { CatalogsApiService } from '../../core/catalogs/catalogs-api.service';
import { AccountStore } from '../../core/state/account.store';
import {
  AccountMemberResponseDto,
  BudgetImpactResponseDto,
  BudgetResponseDto,
  BudgetStatus,
  CategoryResponseDto,
  CreateAnnualBudgetRequest,
  SubBudgetResponseDto
} from '../../shared/models';
import { enumLabel } from '../../shared/ui/enum-labels';

type BudgetPeriodSort = 'month,desc' | 'month,asc';

interface BudgetCategorySummary {
  categoryId: number;
  categoryName: string;
  totalPlannedAmount: number;
  subBudgetCount: number;
}

interface BudgetSubBudgetFilters {
  search: string;
  categoryId: number | null;
}

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
          <div class="header-actions">
            <button class="button" type="button" (click)="startUpsertBudget()">Crear/actualizar presupuesto</button>
            <button class="button" type="button" [disabled]="!expenseCategories().length" (click)="startAnnualBudget()">
              Crear presupuesto anual
            </button>
          </div>
        } @else {
          <span class="permission-note">Solo lectura</span>
        }
      </div>

      @if (accountStore.selectedAccountArchived()) {
        <div class="panel warning-panel">La cuenta esta archivada. Las acciones de escritura estan bloqueadas.</div>
      }

      @if (!expenseCategories().length) {
        <div class="panel warning-panel">
          No hay categorías de gasto activas para subpresupuestos manuales.
          <a [routerLink]="['/app/accounts', accountId(), 'catalogs']">Ir a catálogos</a>
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
        <form class="filters budget-list-filters" [formGroup]="listFilterForm" (ngSubmit)="loadBudgets()">
          <label>
            <span>Año</span>
            <input type="number" min="2000" max="2100" formControlName="year">
          </label>
          <label>
            <span>Estado</span>
            <select formControlName="status">
              <option value="">Todos</option>
              @for (status of budgetStatuses; track status) {
                <option [value]="status">{{ enumLabel(status) }}</option>
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

        @if (viewMode() === 'monthlyDetail') {
          <form class="filters compact-period-filters" [formGroup]="periodForm" (ngSubmit)="loadSelectedBudgetDetail()">
            <label>
              <span>Mes detalle</span>
              <select formControlName="month">
                @for (month of months; track month.value) {
                  <option [ngValue]="month.value">{{ month.label }}</option>
                }
              </select>
            </label>
            <div class="filter-actions">
              <button type="submit">Ver detalle</button>
            </div>
          </form>
        }
      </section>

      @if (showBudgetForm()) {
        <form class="panel form-grid budget-form" [formGroup]="budgetForm" (ngSubmit)="saveBudget()">
          <h2>Presupuesto mensual</h2>
          <label class="field">
            <span>Año</span>
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
                <option [value]="status">{{ enumLabel(status) }}</option>
              }
            </select>
          </label>
          <div class="form-actions">
            <button class="button" type="submit" [disabled]="budgetForm.invalid || budgetsStore.isSaving()">Guardar</button>
            <button type="button" (click)="cancelBudgetForm()">Cancelar</button>
          </div>
        </form>
      }

      @if (showAnnualBudgetForm()) {
        <form class="panel form-grid annual-form" [formGroup]="annualBudgetForm" (ngSubmit)="saveAnnualBudget()">
          <h2>Presupuesto anual</h2>
          @if (annualBudgetError(); as error) {
            <p class="form-error">{{ error }}</p>
          }
          <label class="field">
            <span>Año</span>
            <input type="number" min="2000" max="2100" formControlName="year">
          </label>
          <label class="field">
            <span>Nombre base</span>
            <input type="text" formControlName="name">
          </label>
          <label class="field">
            <span>Status</span>
            <select formControlName="status">
              @for (status of budgetStatuses; track status) {
                <option [value]="status">{{ enumLabel(status) }}</option>
              }
            </select>
          </label>
          <div class="annual-subbudget-grid">
            <div class="section-heading">
              <h3>Subpresupuestos base</h3>
              <button class="button" type="button" (click)="addAnnualSubBudget()">Agregar base</button>
            </div>
            <div class="annual-subbudget-list" formArrayName="subBudgets">
              @for (group of annualSubBudgets.controls; track $index) {
                <div class="annual-subbudget-row" [formGroupName]="$index">
                  <label class="field">
                    <span>Nombre</span>
                    <input type="text" formControlName="name">
                  </label>
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
                    <span>Presupuestado</span>
                    <input type="number" min="0.01" step="0.01" formControlName="plannedAmount">
                  </label>
                  <div class="annual-subbudget-actions">
                    <button type="button" (click)="removeAnnualSubBudget($index)" [disabled]="annualSubBudgets.length <= 1">
                      Quitar
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
          <div class="form-actions">
            <button class="button" type="submit" [disabled]="annualBudgetForm.invalid || budgetsStore.isSaving()">Crear anual</button>
            <button type="button" (click)="cancelAnnualBudgetForm()">Cancelar</button>
          </div>
        </form>
      }

      @if (viewMode() === 'annualList') {
        <section class="budget-list-panel panel">
          <div class="section-heading">
            <h2>Presupuestos del año</h2>
            <span>{{ budgetsStore.pagination().totalElements }} registros</span>
          </div>

          @if (budgetsStore.isLoading() && !budgetsStore.budgets().length) {
            <div class="panel">Cargando presupuestos...</div>
          } @else if (!budgetsStore.budgets().length) {
            <div class="panel empty-state">
              <h2>No hay presupuestos para este año</h2>
              @if (canWrite()) {
                <button class="button" type="button" (click)="startUpsertBudget()">Crear presupuesto mensual</button>
              }
            </div>
          } @else {
            <div class="budget-list annual-budget-list">
              @for (budget of budgetsStore.budgets(); track budget.id) {
                <article
                  class="budget-card annual-budget-row"
                  [class.selected]="budgetsStore.selectedBudgetDetail()?.budget?.id === budget.id || editingBudgetId() === budget.id"
                >
                  <div>
                    <h3>{{ budget.name || monthLabel(budget.month) }}</h3>
                    <p>{{ monthLabel(budget.month) }} {{ budget.year }}</p>
                  </div>
                  <div class="actions">
                    <button type="button" (click)="openBudgetDetail(budget)">Ver detalle</button>
                    @if (canWrite()) {
                      <button type="button" (click)="startUpsertBudget(budget)">Editar</button>
                    }
                  </div>
                </article>
              }
            </div>
          }
        </section>
      } @else {
        <section class="detail-column">
          @if (budgetsStore.selectedBudgetDetail(); as detail) {
            <div class="panel detail-panel">
              <div class="detail-heading">
                <div>
                  <h2>{{ detail.budget.name || monthLabel(detail.budget.month) }}</h2>
                  <p>{{ monthLabel(detail.budget.month) }} {{ detail.budget.year }}</p>
                </div>
                <div class="detail-actions">
                  <button class="secondary-button" type="button" (click)="backToAnnualList()">Volver al listado</button>
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
                  <dd [class.form-error]="impactTotals().pending < 0">
                    {{ impactTotals().pending | currency: 'COP':'symbol-narrow':'1.0-0' }}
                  </dd>
                </div>
                <div>
                  <dt>Avance total</dt>
                  <dd>{{ impactProgress() }}%</dd>
                </div>
              </dl>

              <div class="progress">
                <div class="progress-label">
                  <span>Paid / expected total</span>
                  <span>{{ impactProgress() }}%</span>
                </div>
                <div class="progress-track"><span [style.width.%]="impactProgress()"></span></div>
              </div>
            </div>
            <section class="panel detail-tabs-panel">
              <div class="detail-tabs" role="tablist" aria-label="Detalle de presupuesto mensual">
                <button
                  type="button"
                  role="tab"
                  [class.active]="selectedDetailTab() === 'categorySummary'"
                  [attr.aria-selected]="selectedDetailTab() === 'categorySummary'"
                  (click)="changeDetailTab('categorySummary')">
                  Presupuesto por categoria
                </button>
                <button
                  type="button"
                  role="tab"
                  [class.active]="selectedDetailTab() === 'subBudgets'"
                  [attr.aria-selected]="selectedDetailTab() === 'subBudgets'"
                  (click)="changeDetailTab('subBudgets')">
                  Subpresupuestos
                </button>
              </div>
            </section>

            @if (selectedDetailTab() === 'categorySummary') {
              <section class="panel category-budget-section">
                <div class="section-heading">
                  <h2>Presupuesto por categoria</h2>
                  <span>{{ budgetByCategory().length }} categorias</span>
                </div>

                @if (!budgetByCategory().length) {
                  <p class="muted">No hay categorias con presupuesto para este mes.</p>
                } @else {
                  <div class="category-budget-list compact-grid">
                    @for (item of budgetByCategory(); track item.categoryId) {
                      <article
                        class="budget-card compact-row"
                        [class.selected]="expandedCategoryId() === item.categoryId">
                        <div class="category-summary-info">
                          <strong>{{ item.categoryName }}</strong>
                          <span>{{ item.subBudgetCount }} {{ item.subBudgetCount === 1 ? 'subpresupuesto' : 'subpresupuestos' }}</span>
                          <div class="amount-block">
                            <span>Total presupuestado</span>
                            <strong>{{ item.totalPlannedAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
                          </div>
                        </div>
                        <div class="actions category-actions">
                          <button type="button" (click)="toggleCategorySubBudgets(item.categoryId)">
                            {{ expandedCategoryId() === item.categoryId ? 'Ocultar subpresupuestos' : 'Ver subpresupuestos' }}
                          </button>
                        </div>
                        @if (expandedCategoryId() === item.categoryId) {
                          <div class="category-subbudgets">
                            @for (subBudget of subBudgetsByCategory(item.categoryId); track subBudget.id) {
                              <article class="subbudget-card compact-row">
                                <div>
                                  <h3>{{ subBudget.name }}</h3>
                                  <p>{{ categoryName(subBudget.categoryId) }}</p>
                                  <p>{{ subBudgetParticipantLabel(subBudget.participantId) }}</p>
                                </div>
                                <div class="amount-block">
                                  <span>Presupuestado</span>
                                  <strong>{{ subBudget.plannedAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
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
                      </article>
                    }
                  </div>
                }
              </section>
            } @else {
              <section class="panel subbudget-section">
                <div class="section-heading">
                  <h2>Subpresupuestos</h2>
                  @if (canWrite()) {
                    <button class="button" type="button" (click)="startCreateSubBudget()" [disabled]="!expenseCategories().length">
                      Nuevo subpresupuesto
                    </button>
                  }
                </div>

                <div class="subbudget-filters">
                  <label>
                    <span>Buscar</span>
                    <input
                      type="text"
                      [value]="subBudgetFilters().search"
                      placeholder="Nombre del subpresupuesto"
                      (input)="setSubBudgetSearch($any($event.target).value)"
                    >
                  </label>
                  <label>
                    <span>Categoria</span>
                    <select
                      [value]="subBudgetFilters().categoryId ?? ''"
                      (change)="setSubBudgetCategory($any($event.target).value)"
                    >
                      <option value="">Todas</option>
                      @for (category of subBudgetCategories(); track category.id) {
                        <option [value]="category.id">{{ category.name }}</option>
                      }
                    </select>
                  </label>
                  <button type="button" (click)="clearSubBudgetFilters()">Limpiar</button>
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
                  <span>Año destino</span>
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
                    <label class="field">
                      <span>Participante</span>
                      <select formControlName="participantId">
                        @if (canAssignGlobalSubBudget()) {
                          <option value="">Global</option>
                        }
                        @for (member of assignableParticipants(); track member.participantId) {
                          <option [value]="member.participantId">{{ participantLabel(member) }}</option>
                        }
                      </select>
                    </label>
                    <div class="form-actions">
                      <button class="button" type="submit" [disabled]="subBudgetForm.invalid || budgetsStore.isSaving()">Guardar</button>
                      <button type="button" (click)="cancelSubBudgetForm()">Cancelar</button>
                    </div>
                  </form>
                }

                @if (!filteredSubBudgets().length) {
                  <p class="muted">No hay subpresupuestos para este mes.</p>
                } @else {
                  <div class="subbudget-list compact-grid">
                    @for (subBudget of filteredSubBudgets(); track subBudget.id) {
                      <article
                        class="subbudget-card compact-row"
                        [class.selected]="editingSubBudget()?.id === subBudget.id">
                        <div>
                          <h3>{{ subBudget.name }}</h3>
                          <p>{{ categoryName(subBudget.categoryId) }}</p>
                          <p>{{ subBudgetParticipantLabel(subBudget.participantId) }}</p>
                        </div>
                        <div class="amount-block">
                          <span>Presupuestado</span>
                          <strong>{{ subBudget.plannedAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
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
                <p class="muted">Estos impacts corresponden a cuotas/deudas asociadas al presupuesto mensual.</p>

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
                          <span>{{ enumLabel(impact.status) }}</span>
                          <span>{{ enumLabel(impact.sourceType) }}</span>
                        </div>
                      </article>
                    }
                  </div>
                }
              </section>
            }
          } @else {
            <div class="detail-empty-state">
              <div class="section-heading detail-empty-heading">
                <h2>Detalle mensual</h2>
              </div>
              <div class="panel empty-state">
                <h2>No hay presupuesto para este mes</h2>
                <p>Selecciona otro periodo o crea el presupuesto mensual para comenzar.</p>
                <button class="secondary-button" type="button" (click)="backToAnnualList()">Volver al listado</button>
                @if (canWrite()) {
                  <button class="button" type="button" (click)="startUpsertBudget()">Crear presupuesto mensual</button>
                }
              </div>
            </div>
          }
        </section>
      }
    </section>
  `
})
export class BudgetsPageComponent implements OnInit {
  protected readonly budgetsStore = inject(BudgetsStore);
  protected readonly accountStore = inject(AccountStore);
  protected readonly enumLabel = enumLabel;
  private readonly accountsApi = inject(AccountsApiService);
  private readonly authStore = inject(AuthStore);
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly currentDate = new Date();
  readonly expenseCategories = signal<CategoryResponseDto[]>([]);
  readonly accountMembers = signal<AccountMemberResponseDto[]>([]);
  readonly showBudgetForm = signal(false);
  readonly showAnnualBudgetForm = signal(false);
  readonly showDuplicateBudgetForm = signal(false);
  readonly showSubBudgetForm = signal(false);
  readonly editingSubBudget = signal<SubBudgetResponseDto | null>(null);
  readonly editingBudgetId = signal<number | null>(null);
  readonly viewMode = signal<'annualList' | 'monthlyDetail'>('annualList');
  readonly selectedDetailTab = signal<'categorySummary' | 'subBudgets'>('categorySummary');
  readonly expandedCategoryId = signal<number | null>(null);
  readonly subBudgetFilters = signal<BudgetSubBudgetFilters>({ search: '', categoryId: null });
  readonly successMessage = signal<string | null>(null);
  readonly duplicateBudgetError = signal<string | null>(null);
  readonly annualBudgetError = signal<string | null>(null);
  readonly accountId = computed(() => this.accountStore.selectedAccountId() ?? 0);
  readonly canWrite = computed(
    () => this.accountStore.selectedAccount()?.currentUserRole === 'ACCOUNT_ADMIN' && !this.accountStore.selectedAccountArchived()
  );
  readonly canAssignGlobalSubBudget = computed(() => this.accountStore.selectedAccount()?.currentUserRole === 'ACCOUNT_ADMIN');
  readonly assignableParticipants = computed(() => {
    const activeMembers = this.accountMembers().filter((member) => member.status === 'ACTIVE');
    const account = this.accountStore.selectedAccount();
    const currentParticipantId = this.authStore.user()?.participantId;

    if (account?.currentUserRole === 'ACCOUNT_ADMIN') {
      return activeMembers;
    }

    return activeMembers.filter((member) => member.participantId === currentParticipantId);
  });
  readonly impactTotals = computed(() => {
    const summary = this.budgetsStore.budgetSummary();

    if (summary) {
      return {
        expected: summary.expectedAmount,
        paid: summary.paidAmount,
        pending: summary.pendingAmount
      };
    }

    const impacts = this.budgetsStore.selectedBudgetDetail()?.impacts ?? [];
    const expected = impacts.reduce((total, impact) => total + impact.expectedAmount, 0);
    const paid = impacts.reduce((total, impact) => total + impact.paidAmount, 0);

    return {
      expected,
      paid,
      pending: expected - paid
    };
  });
  readonly impactProgress = computed(() => {
    const totals = this.impactTotals();

    return totals.expected > 0 ? Math.min(100, Math.round((totals.paid / totals.expected) * 100)) : 0;
  });
  readonly budgetByCategory = computed<BudgetCategorySummary[]>(() => {
    const detail = this.budgetsStore.selectedBudgetDetail();
    const grouped = new Map<number, { totalPlannedAmount: number; subBudgetCount: number }>();

    for (const subBudget of detail?.subBudgets ?? []) {
      if (subBudget.status !== 'ACTIVE' || subBudget.categoryId == null) {
        continue;
      }

      const current = grouped.get(subBudget.categoryId) ?? { totalPlannedAmount: 0, subBudgetCount: 0 };

      grouped.set(subBudget.categoryId, {
        totalPlannedAmount: current.totalPlannedAmount + subBudget.plannedAmount,
        subBudgetCount: current.subBudgetCount + 1
      });
    }

    return Array.from(grouped.entries())
      .map(([categoryId, value]) => ({
        categoryId,
        categoryName: this.categoryName(categoryId),
        totalPlannedAmount: value.totalPlannedAmount,
        subBudgetCount: value.subBudgetCount
      }))
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  });
  readonly subBudgetCategories = computed(() => {
    const categories = new Map<number, CategoryResponseDto>();

    for (const subBudget of this.budgetsStore.selectedBudgetDetail()?.subBudgets ?? []) {
      if (subBudget.categoryId == null) {
        continue;
      }

      const category = this.expenseCategories().find((item) => item.id === subBudget.categoryId);
      if (category) {
        categories.set(category.id, category);
      }
    }

    return Array.from(categories.values()).sort((a, b) => a.name.localeCompare(b.name));
  });
  readonly filteredSubBudgets = computed(() => {
    const { search, categoryId } = this.subBudgetFilters();
    const normalizedSearch = search.trim().toLowerCase();

    return (this.budgetsStore.selectedBudgetDetail()?.subBudgets ?? []).filter((subBudget) => {
      const matchesSearch = !normalizedSearch || subBudget.name.toLowerCase().includes(normalizedSearch);
      const matchesCategory = categoryId == null || subBudget.categoryId === categoryId;

      return matchesSearch && matchesCategory;
    });
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
    status: ['ACTIVE' as BudgetStatus | '']
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
    plannedAmount: [0, [Validators.required, Validators.min(0)]],
    participantId: ['']
  });
  readonly annualBudgetForm = this.fb.group({
    year: [this.currentDate.getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]],
    name: ['', [Validators.maxLength(120)]],
    status: ['ACTIVE' as BudgetStatus, [Validators.required]],
    subBudgets: this.fb.array([this.createAnnualSubBudgetGroup()])
  });

  get annualSubBudgets(): FormArray {
    return this.annualBudgetForm.controls.subBudgets;
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadMembers();
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
      .subscribe({
        next: () => {
          this.selectedDetailTab.set('categorySummary');
          this.viewMode.set('monthlyDetail');
        },
        error: () => undefined
      });
  }

  openBudgetDetail(budget: BudgetResponseDto): void {
    this.periodForm.patchValue({ year: budget.year, month: budget.month });
    this.budgetsStore
      .getBudgetDetail(this.accountId(), budget.year, budget.month, { persist: true })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.selectedDetailTab.set('categorySummary');
          this.viewMode.set('monthlyDetail');
        },
        error: () => undefined
      });
  }

  backToAnnualList(): void {
    this.viewMode.set('annualList');
    this.expandedCategoryId.set(null);
  }

  changeDetailTab(tab: 'categorySummary' | 'subBudgets'): void {
    this.selectedDetailTab.set(tab);
    if (tab === 'subBudgets') {
      this.expandedCategoryId.set(null);
    }
  }

  clearFilters(): void {
    this.patchFilters(this.budgetsStore.clearPersistedFilters(this.accountId()));
    this.viewMode.set('annualList');
    this.budgetsStore.selectedBudgetDetail.set(null);
    const raw = this.listFilterForm.getRawValue();
    this.budgetsStore
      .loadBudgets(
        this.accountId(),
        {
          year: raw.year,
          status: raw.status ? (raw.status as BudgetStatus) : null,
          page: 0
        },
        { persist: true }
      )
      .pipe(take(1))
      .subscribe({ error: () => undefined });
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
    this.editingBudgetId.set(source?.id ?? null);
    this.showBudgetForm.set(true);
    this.showAnnualBudgetForm.set(false);
  }

  cancelBudgetForm(): void {
    this.showBudgetForm.set(false);
    this.editingBudgetId.set(null);
  }

  startAnnualBudget(): void {
    if (!this.canWrite() || !this.expenseCategories().length) {
      return;
    }

    this.successMessage.set(null);
    this.annualBudgetError.set(null);
    this.showBudgetForm.set(false);
    this.editingBudgetId.set(null);
    this.showAnnualBudgetForm.set(true);
    this.resetAnnualBudgetForm();
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

  saveAnnualBudget(): void {
    if (this.annualBudgetForm.invalid || !this.canWrite()) {
      this.annualBudgetForm.markAllAsTouched();
      return;
    }

    this.successMessage.set(null);
    this.annualBudgetError.set(null);
    const raw = this.annualBudgetForm.getRawValue();
    const request: CreateAnnualBudgetRequest = {
      year: raw.year,
      name: raw.name || null,
      status: raw.status,
      subBudgets: raw.subBudgets.map((item) => ({
        name: item.name,
        categoryId: item.categoryId || null,
        plannedAmount: item.plannedAmount
      }))
    };

    this.budgetsStore
      .createAnnualBudget(this.accountId(), request)
      .pipe(take(1))
      .subscribe({
        next: () => {
          const monthToShow = raw.year === this.currentDate.getFullYear() ? this.currentDate.getMonth() + 1 : 1;
          this.periodForm.patchValue({ year: raw.year, month: monthToShow });
          this.listFilterForm.patchValue({ year: raw.year });
          this.viewMode.set('annualList');
          this.successMessage.set('Presupuesto anual creado correctamente.');
          this.cancelAnnualBudgetForm();
        },
        error: () => undefined
      });
  }

  addAnnualSubBudget(): void {
    this.annualSubBudgets.push(this.createAnnualSubBudgetGroup());
  }

  removeAnnualSubBudget(index: number): void {
    if (this.annualSubBudgets.length <= 1) {
      return;
    }

    this.annualSubBudgets.removeAt(index);
  }

  cancelAnnualBudgetForm(): void {
    this.showAnnualBudgetForm.set(false);
    this.annualBudgetError.set(null);
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
          this.viewMode.set('annualList');
          this.budgetsStore.selectedBudgetDetail.set(null);
          this.editingBudgetId.set(null);
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
      plannedAmount: 0,
      participantId: this.canAssignGlobalSubBudget() ? '' : this.currentParticipantIdValue()
    });
    this.showSubBudgetForm.set(true);
  }

  toggleCategorySubBudgets(categoryId: number): void {
    this.expandedCategoryId.set(this.expandedCategoryId() === categoryId ? null : categoryId);
  }

  subBudgetsByCategory(categoryId: number): SubBudgetResponseDto[] {
    return (this.budgetsStore.selectedBudgetDetail()?.subBudgets ?? []).filter(
      (subBudget) => subBudget.status === 'ACTIVE' && subBudget.categoryId === categoryId
    );
  }

  setSubBudgetSearch(search: string): void {
    this.subBudgetFilters.update((current) => ({ ...current, search }));
  }

  setSubBudgetCategory(rawCategoryId: string): void {
    const categoryId = rawCategoryId ? Number(rawCategoryId) : null;
    this.subBudgetFilters.update((current) => ({ ...current, categoryId }));
  }

  clearSubBudgetFilters(): void {
    this.subBudgetFilters.set({ search: '', categoryId: null });
  }

  startEditSubBudget(subBudget: SubBudgetResponseDto): void {
    if (!this.canMutateSubBudget(subBudget)) {
      return;
    }

    this.editingSubBudget.set(subBudget);
    this.subBudgetForm.reset({
      categoryId: subBudget.categoryId ?? null,
      name: subBudget.name,
      plannedAmount: subBudget.plannedAmount,
      participantId: subBudget.participantId?.toString() ?? ''
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
      plannedAmount: raw.plannedAmount,
      participantId: this.selectedParticipantId(raw.participantId)
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
      return subBudget.spentAmount > 0 ? 100 : 0;
    }

    return Math.max(0, Math.min(100, Math.round((subBudget.spentAmount / subBudget.plannedAmount) * 100)));
  }

  subBudgetPending(subBudget: SubBudgetResponseDto): number {
    return subBudget.plannedAmount - subBudget.spentAmount;
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

  participantLabel(member: AccountMemberResponseDto): string {
    return member.displayName ? `${member.displayName} (${member.email})` : member.email;
  }

  subBudgetParticipantLabel(participantId?: number | null): string {
    if (!participantId) {
      return 'Global';
    }

    const member = this.accountMembers().find((item) => item.participantId === participantId);

    return member ? this.participantLabel(member) : `Participante ${participantId}`;
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
      ANNUAL_BUDGET_MONTH_ALREADY_EXISTS: 'Ya existe al menos un presupuesto para este año.',
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

  private loadMembers(): void {
    this.accountsApi
      .listMembers(this.accountId())
      .pipe(take(1))
      .subscribe({
        next: (members) => this.accountMembers.set(members),
        error: () => this.accountMembers.set([])
      });
  }

  private patchFilters(filters: BudgetPersistedFilters): void {
    this.listFilterForm.patchValue({
      year: filters.year ?? filters.selectedYear,
      status: filters.status ?? 'ACTIVE'
    });
    this.periodForm.patchValue({
      year: filters.selectedYear,
      month: filters.selectedMonth
    });
  }

  private createAnnualSubBudgetGroup() {
    return this.fb.group({
      categoryId: [null as number | null],
      name: ['', [Validators.required, Validators.maxLength(150)]],
      plannedAmount: [0, [Validators.required, Validators.min(0.01)]]
    });
  }

  private resetAnnualBudgetForm(): void {
    this.annualBudgetForm.patchValue({
      year: this.currentDate.getFullYear(),
      name: '',
      status: 'ACTIVE'
    });
    this.annualSubBudgets.clear();
    this.annualSubBudgets.push(this.createAnnualSubBudgetGroup());
  }

  private selectedParticipantId(value: string): number | null {
    const selectedParticipantId = value ? Number(value) : null;

    if (!selectedParticipantId) {
      return this.canAssignGlobalSubBudget() ? null : this.currentParticipantId();
    }

    const canAssign = this.assignableParticipants().some((member) => member.participantId === selectedParticipantId);

    return canAssign ? selectedParticipantId : this.currentParticipantId();
  }

  private currentParticipantIdValue(): string {
    return this.currentParticipantId()?.toString() ?? '';
  }

  private currentParticipantId(): number | null {
    return this.authStore.user()?.participantId ?? null;
  }
}
