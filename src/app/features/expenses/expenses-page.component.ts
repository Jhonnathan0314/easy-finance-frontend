import { CurrencyPipe } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { take } from 'rxjs';

import { AccountsApiService } from '../../core/accounts/accounts-api.service';
import { AuthStore } from '../../core/auth/auth.store';
import { CatalogsApiService } from '../../core/catalogs/catalogs-api.service';
import { ExpensesStore } from '../../core/expenses/expenses.store';
import { AccountStore } from '../../core/state/account.store';
import {
  AccountMemberResponseDto,
  CategoryResponseDto,
  CreateInstallmentExpenseRequest,
  ExpensePaymentState,
  ExpenseResponseDto,
  ExpenseStatus,
  ExpenseType,
  PaymentMethodResponseDto,
  isDebtPaymentExpense
} from '../../shared/models';
import { enumLabel } from '../../shared/ui/enum-labels';

type ExpenseFormMode = 'simple' | 'installment';
type ExpenseDateSort = 'expenseDate,asc' | 'expenseDate,desc';
type ExpenseOriginFilter = '' | 'DEBT_PAYMENT' | 'NOT_DEBT_PAYMENT';

@Component({
  selector: 'ef-expenses-page',
  standalone: true,
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink],
  styleUrl: './expenses-page.component.scss',
  template: `
    <section class="page-shell">
      <div class="page-header">
        <div>
          <h1 class="page-title">Gastos</h1>
          <p class="page-subtitle">Gastos de la cuenta {{ accountId() }}.</p>
        </div>
        @if (canCreate()) {
          <div class="header-actions">
            <button class="button" type="button" [disabled]="!hasRequiredCatalogs()" (click)="startQuickExpense()">
              + Gasto rápido
            </button>
            <button class="button" type="button" [disabled]="!hasRequiredCatalogs()" (click)="startCreateSimple()">
              Gasto simple
            </button>
            <button class="button secondary" type="button" [disabled]="!hasRequiredCatalogs()" (click)="startCreateInstallment()">
              Gasto en cuotas
            </button>
          </div>
        }
      </div>

      @if (accountStore.selectedAccountArchived()) {
        <div class="panel warning-panel">La cuenta esta archivada. Las acciones de escritura estan bloqueadas.</div>
      }

      @if (!hasRequiredCatalogs()) {
        <div class="panel warning-panel">
          Necesitas al menos una categoría de gasto activa y un medio de pago activo.
          <a [routerLink]="['/app/accounts', accountId(), 'catalogs']">Ir a catálogos</a>
        </div>
      }

      @if (successMessage(); as message) {
        <div class="panel success-panel">{{ message }}</div>
      }

      @if (blockedActionMessage(); as message) {
        <div class="panel warning-panel">{{ message }}</div>
      }

      @if (expensesStore.error(); as error) {
        <div class="panel error-panel" role="alert">
          <strong>{{ error.code }}</strong>
          <span>{{ friendlyError(error.code, error.message) }}</span>
        </div>
      }

      <form class="filters" [formGroup]="filterForm" (ngSubmit)="applyFilters()">
        <label class="search-field">
          <span>Buscar descripcion</span>
          <input type="search" formControlName="search" placeholder="Buscar gasto por descripcion">
        </label>
        <label>
          <span>Desde</span>
          <input type="date" formControlName="from">
        </label>
        <label>
          <span>Hasta</span>
          <input type="date" formControlName="to">
        </label>
        <label>
          <span>Categoria</span>
          <select formControlName="categoryId">
            <option value="">Todas</option>
            @for (category of expenseCategories(); track category.id) {
              <option [value]="category.id">{{ category.name }}</option>
            }
          </select>
        </label>
        <label>
          <span>Medio</span>
          <select formControlName="paymentMethodId">
            <option value="">Todos</option>
            @for (method of paymentMethods(); track method.id) {
              <option [value]="method.id">{{ method.name }}</option>
            }
          </select>
        </label>
        <label>
          <span>Pago</span>
          <select formControlName="paymentState">
            <option value="">Todos</option>
            @for (state of paymentStates; track state) {
              <option [value]="state">{{ enumLabel(state) }}</option>
            }
          </select>
        </label>
        <label>
          <span>Tipo de gasto</span>
          <select formControlName="expenseType">
            <option value="">Todos</option>
            @for (type of expenseTypes; track type) {
              <option [value]="type">{{ enumLabel(type) }}</option>
            }
          </select>
        </label>
        <label>
          <span>Origen</span>
          <select formControlName="origin">
            <option value="">Todos</option>
            <option value="DEBT_PAYMENT">Pago de deuda</option>
            <option value="NOT_DEBT_PAYMENT">No pago de deuda</option>
          </select>
        </label>
        <div class="filter-actions">
          <button type="submit">Filtrar</button>
          <button type="button" (click)="clearFilters()">Limpiar filtros</button>
        </div>
      </form>

      <div class="sort-toolbar" aria-label="Orden de gastos por fecha">
        <span>Ordenar por fecha</span>
        <div class="sort-actions">
          @for (option of dateSortOptions; track option.value) {
            <button
              type="button"
              [class.active]="currentDateSort() === option.value"
              [attr.aria-pressed]="currentDateSort() === option.value"
              (click)="changeDateSort(option.value)"
            >
              {{ option.label }}
            </button>
          }
        </div>
      </div>

      @if (showQuickForm()) {
        <form
          class="panel quick-expense-form"
          [formGroup]="quickExpenseForm"
          (ngSubmit)="saveQuickExpense()"
          (keydown.escape)="closeQuickExpense()"
        >
          <div>
            <h2>Gasto rápido</h2>
            <p class="form-note">Se registrara como gasto simple con fecha de hoy.</p>
          </div>
          <label class="field amount-field">
            <span>Monto</span>
            <input #quickAmountInput type="number" min="0.01" step="0.01" inputmode="decimal" formControlName="amount">
          </label>
          <label class="field">
            <span>Categoria</span>
            <select formControlName="categoryId">
              <option [ngValue]="0">Selecciona</option>
              @for (category of expenseCategories(); track category.id) {
                <option [ngValue]="category.id">{{ category.name }}</option>
              }
            </select>
          </label>
          <label class="field">
            <span>Medio</span>
            <select formControlName="paymentMethodId">
              <option [ngValue]="0">Selecciona</option>
              @for (method of paymentMethods(); track method.id) {
                <option [ngValue]="method.id">{{ method.name }}</option>
              }
            </select>
          </label>
          <label class="field">
            <span>Pago</span>
            <select formControlName="paymentState">
              @for (state of paymentStates; track state) {
                <option [value]="state">{{ enumLabel(state) }}</option>
              }
            </select>
          </label>
          <label class="field">
            <span>Participante</span>
            <select formControlName="participantId">
              <option value="">Yo mismo</option>
              @for (member of assignableParticipants(); track member.participantId) {
                <option [value]="member.participantId">{{ participantLabel(member) }}</option>
              }
            </select>
          </label>
          <label class="field wide">
            <span>Descripcion</span>
            <input type="text" formControlName="description" placeholder="Gasto rápido">
          </label>
          <div class="form-actions">
            <button class="button" type="submit" [disabled]="quickExpenseForm.invalid || expensesStore.isSaving()">
              {{ expensesStore.isSaving() ? 'Guardando...' : 'Guardar' }}
            </button>
            <button type="button" [disabled]="expensesStore.isSaving()" (click)="closeQuickExpense()">Cancelar</button>
          </div>
        </form>
      }

      @if (showForm()) {
        <form class="panel form-grid expense-form" [formGroup]="activeForm()" (ngSubmit)="saveExpense()">
          <h2>{{ formTitle() }}</h2>
          <label class="field">
            <span>Categoria</span>
            <select formControlName="categoryId">
              <option [ngValue]="0">Selecciona</option>
              @for (category of expenseCategories(); track category.id) {
                <option [ngValue]="category.id">{{ category.name }}</option>
              }
            </select>
          </label>
          <label class="field">
            <span>Medio de pago</span>
            <select formControlName="paymentMethodId">
              <option [ngValue]="0">Selecciona</option>
              @for (method of paymentMethods(); track method.id) {
                <option [ngValue]="method.id">{{ method.name }}</option>
              }
            </select>
          </label>
          <label class="field wide">
            <span>Descripcion</span>
            <input type="text" formControlName="description">
          </label>
          <label class="field">
            <span>Participante</span>
            <select formControlName="participantId">
              <option value="">Yo mismo</option>
              @for (member of assignableParticipants(); track member.participantId) {
                <option [value]="member.participantId">{{ participantLabel(member) }}</option>
              }
            </select>
          </label>

          @if (formMode() === 'simple') {
            <label class="field">
              <span>Monto</span>
              <input type="number" min="0.01" step="0.01" formControlName="amount">
            </label>
            <label class="field">
              <span>Fecha</span>
              <input type="date" formControlName="expenseDate">
            </label>
            <label class="field">
              <span>Estado de pago</span>
              <select formControlName="paymentState">
                @for (state of paymentStates; track state) {
                  <option [value]="state">{{ enumLabel(state) }}</option>
                }
              </select>
            </label>
          } @else {
            <label class="field">
              <span>Valor original / capital</span>
              <input type="number" min="0.01" step="0.01" formControlName="totalAmount">
            </label>
            <label class="field">
              <span>Fecha gasto</span>
              <input type="date" formControlName="expenseDate">
            </label>
            <label class="field">
              <span>Numero de cuotas</span>
              <input type="number" min="1" step="1" formControlName="installmentCount">
            </label>
            <label class="field">
              <span>Valor cuota</span>
              <input type="number" min="0.01" step="0.01" formControlName="installmentAmount">
            </label>
            <label class="field">
              <span>Primera cuota</span>
              <input type="date" formControlName="firstInstallmentDate">
            </label>
            <label class="field">
              <span>Nombre deuda</span>
              <input type="text" formControlName="debtName">
            </label>
            <label class="field wide">
              <span>Notas</span>
              <textarea rows="3" formControlName="notes"></textarea>
            </label>
            <div class="installment-summary wide">
              <span>Total financiado/programado</span>
              <strong>{{ installmentFinancedTotal() | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
              <p class="hint">El valor original queda en el gasto; el total financiado/programado queda en la deuda.</p>
              <p class="hint">La deuda asociada quedara asignada a {{ selectedInstallmentParticipantLabel() }}.</p>
              @if (installmentFinancingDifference() > 0) {
                <p class="hint">
                  La diferencia corresponde a intereses o costos financieros:
                  {{ installmentFinancingDifference() | currency: 'COP':'symbol-narrow':'1.0-0' }}.
                </p>
              }
            </div>
            @if (installmentForm.hasError('installmentFinancedTotalTooLow')) {
              <p class="form-error">El total financiado no puede ser menor al valor original del gasto.</p>
            }
          }

          <div class="form-actions">
            <button class="button" type="submit" [disabled]="activeForm().invalid || expensesStore.isSaving()">
              Guardar
            </button>
            <button type="button" (click)="cancelForm()">Cancelar</button>
          </div>
        </form>
      }

      @if (showDuplicateForm()) {
        <form class="panel form-grid duplicate-expense-form" [formGroup]="duplicateExpenseForm" (ngSubmit)="saveDuplicateExpense()">
          <h2>Duplicar gasto</h2>
          @if (duplicatingExpense(); as expense) {
            <p class="form-note">Origen: {{ expense.description }} - {{ expense.expenseDate }}</p>
          }
          @if (duplicateExpenseError(); as error) {
            <p class="form-error">{{ error }}</p>
          }
          <label class="field">
            <span>Fecha nueva</span>
            <input type="date" formControlName="expenseDate">
          </label>
          <label class="field">
            <span>Monto</span>
            <input type="number" min="0.01" step="0.01" formControlName="amount">
          </label>
          <label class="field">
            <span>Estado de pago</span>
            <select formControlName="paymentState">
              <option value="">Usar estado origen</option>
              @for (state of paymentStates; track state) {
                <option [value]="state">{{ enumLabel(state) }}</option>
              }
            </select>
          </label>
          <label class="field wide">
            <span>Descripcion</span>
            <input type="text" formControlName="description">
          </label>
          <div class="form-actions">
            <button class="button" type="submit" [disabled]="duplicateExpenseForm.invalid || expensesStore.isSaving()">
              Duplicar gasto
            </button>
            <button type="button" (click)="cancelDuplicateForm()">Cancelar</button>
          </div>
        </form>
      }

      @if (expensesStore.isLoading()) {
        <div class="panel">Cargando gastos...</div>
      } @else if (!expensesStore.expenses().length) {
        <div class="panel empty-state">No hay gastos para los filtros actuales.</div>
      } @else {
        <nav class="pagination pagination-top" aria-label="Paginacion superior de gastos">
          <label class="page-size-field">
            <span>Tamano pagina</span>
            <select [value]="expensesStore.pagination().size" [disabled]="expensesStore.isLoading()" (change)="changePageSize($any($event.target).value)">
              @for (size of pageSizeOptions; track size) {
                <option [value]="size" [selected]="expensesStore.pagination().size === size">{{ size }}</option>
              }
            </select>
          </label>
          <div class="pagination-actions">
            <button type="button" [disabled]="!canGoPreviousPage() || expensesStore.isLoading()" (click)="goToPreviousPage()">
              Anterior
            </button>
            <span>Pagina {{ currentPageNumber() }} de {{ totalPagesNumber() }}</span>
            <span>{{ expensesStore.pagination().totalElements }} registros</span>
            <button type="button" [disabled]="!canGoNextPage() || expensesStore.isLoading()" (click)="goToNextPage()">
              Siguiente
            </button>
            <button type="button" (click)="openTotalModal()">Ver total</button>
          </div>
        </nav>
        <div class="expense-list">
          @for (expense of expensesStore.expenses(); track expense.id) {
            <article class="expense-card">
              <div>
                <h3>{{ expense.description }}</h3>
                <p>{{ expense.expenseDate }} · {{ categoryName(expense.categoryId) }} · {{ paymentMethodName(expense.paymentMethodId) }}</p>
              </div>
              <strong>{{ expense.amount | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
              <div class="badges">
                <span>{{ enumLabel(expense.paymentState) }}</span>
                <span>{{ enumLabel(expense.expenseType) }}</span>
                @if (isDebtPaymentExpense(expense)) {
                  <span class="badge-debt-payment">{{ enumLabel('DEBT_PAYMENT') }}</span>
                }
              </div>
              <div class="actions">
                @if (isDebtPaymentExpense(expense) && expense.sourceDebtId) {
                  <button type="button" (click)="goToRelatedDebt(expense)">Ir a deuda</button>
                }
                @if (canMutateExpense(expense)) {
                  <button type="button" (click)="startEditSimple(expense)">Editar</button>
                  <button type="button" (click)="cancelExpense(expense)">Cancelar</button>
                }
                @if (canDuplicateExpense(expense)) {
                  <button type="button" (click)="startDuplicateExpense(expense)">Duplicar</button>
                }
              </div>
            </article>
          }
        </div>
        <nav class="pagination pagination-bottom" aria-label="Paginacion inferior de gastos">
          <div class="pagination-actions">
            <button type="button" [disabled]="!canGoPreviousPage() || expensesStore.isLoading()" (click)="goToPreviousPage()">
              Anterior
            </button>
            <span>Pagina {{ currentPageNumber() }} de {{ totalPagesNumber() }}</span>
            <span>{{ expensesStore.pagination().totalElements }} registros</span>
            <button type="button" [disabled]="!canGoNextPage() || expensesStore.isLoading()" (click)="goToNextPage()">
              Siguiente
            </button>
          </div>
        </nav>
      }

      @if (showTotalModal()) {
        <div class="modal-backdrop" (click)="closeTotalModal()">
          <div class="modal-panel" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
            <h2>Total de gastos mostrados</h2>
            <p class="hint">Suma de los {{ expensesStore.expenses().length }} gastos visibles en esta página.</p>
            <strong class="modal-total">{{ visiblePageTotal() | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
            <div class="form-actions">
              <button type="button" (click)="closeTotalModal()">Cerrar</button>
            </div>
          </div>
        </div>
      }
    </section>
  `
})
export class ExpensesPageComponent implements OnInit {
  protected readonly expensesStore = inject(ExpensesStore);
  protected readonly accountStore = inject(AccountStore);
  protected readonly enumLabel = enumLabel;
  protected readonly isDebtPaymentExpense = isDebtPaymentExpense;
  private readonly authStore = inject(AuthStore);
  private readonly accountsApi = inject(AccountsApiService);
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);

  @ViewChild('quickAmountInput') private quickAmountInput?: ElementRef<HTMLInputElement>;

  readonly expenseCategories = signal<CategoryResponseDto[]>([]);
  readonly paymentMethods = signal<PaymentMethodResponseDto[]>([]);
  readonly accountMembers = signal<AccountMemberResponseDto[]>([]);
  readonly selectedDetail = signal<ExpenseResponseDto | null>(null);
  readonly showQuickForm = signal(false);
  readonly showForm = signal(false);
  readonly showDuplicateForm = signal(false);
  readonly showTotalModal = signal(false);
  readonly formMode = signal<ExpenseFormMode>('simple');
  readonly editingExpense = signal<ExpenseResponseDto | null>(null);
  readonly duplicatingExpense = signal<ExpenseResponseDto | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly duplicateExpenseError = signal<string | null>(null);
  readonly blockedActionMessage = signal<string | null>(null);
  readonly accountId = computed(() => this.accountStore.selectedAccountId() ?? 0);
  readonly hasRequiredCatalogs = computed(() => this.expenseCategories().length > 0 && this.paymentMethods().length > 0);
  readonly canCreate = computed(() => this.accountStore.selectedAccount()?.status === 'ACTIVE');
  readonly canUseQuickExpense = computed(() => this.canCreate() && this.hasRequiredCatalogs());
  readonly assignableParticipants = computed(() => {
    const activeMembers = this.accountMembers().filter((member) => member.status === 'ACTIVE');
    const account = this.accountStore.selectedAccount();
    const currentParticipantId = this.authStore.user()?.participantId;

    if (account?.currentUserRole === 'ACCOUNT_ADMIN') {
      return activeMembers;
    }

    return activeMembers.filter((member) => member.participantId === currentParticipantId);
  });
  readonly currentPageNumber = computed(() => (this.expensesStore.pagination().totalPages ? this.expensesStore.pagination().page + 1 : 1));
  readonly totalPagesNumber = computed(() => Math.max(this.expensesStore.pagination().totalPages, 1));
  readonly canGoPreviousPage = computed(() => this.expensesStore.pagination().page > 0);
  readonly canGoNextPage = computed(() => {
    const pagination = this.expensesStore.pagination();

    return pagination.totalPages > 0 && pagination.page + 1 < pagination.totalPages;
  });
  readonly visiblePageTotal = computed(() =>
    this.expensesStore.expenses().reduce((sum, expense) => sum + expense.amount, 0)
  );
  readonly formTitle = computed(() => {
    if (this.editingExpense()) {
      return 'Editar gasto simple';
    }

    return this.formMode() === 'simple' ? 'Crear gasto simple' : 'Crear gasto en cuotas';
  });

  readonly paymentStates: ExpensePaymentState[] = ['PENDING', 'PARTIAL', 'PAID'];
  readonly expenseTypes: ExpenseType[] = ['SIMPLE', 'INSTALLMENT'];
  readonly pageSizeOptions = [10, 20, 50, 100];
  readonly dateSortOptions: Array<{ label: string; value: ExpenseDateSort }> = [
    { label: 'Fecha descendente', value: 'expenseDate,desc' },
    { label: 'Fecha ascendente', value: 'expenseDate,asc' }
  ];
  readonly currentDateSort = computed<ExpenseDateSort>(() =>
    this.expensesStore.filters().sort === 'expenseDate,asc' ? 'expenseDate,asc' : 'expenseDate,desc'
  );

  readonly filterForm = this.fb.group({
    search: [''],
    from: [''],
    to: [''],
    categoryId: [''],
    paymentMethodId: [''],
    paymentState: [''],
    expenseType: [''],
    origin: ['' as ExpenseOriginFilter]
  });

  readonly quickExpenseForm = this.fb.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    categoryId: [0, [Validators.required, Validators.min(1)]],
    paymentMethodId: [0, [Validators.required, Validators.min(1)]],
    description: ['', [Validators.maxLength(500)]],
    paymentState: ['PAID' as ExpensePaymentState],
    expenseDate: [today(), [Validators.required]],
    participantId: ['']
  });

  readonly simpleForm = this.fb.group({
    categoryId: [0, [Validators.required, Validators.min(1)]],
    paymentMethodId: [0, [Validators.required, Validators.min(1)]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    expenseDate: [today(), [Validators.required]],
    paymentState: ['PAID' as ExpensePaymentState, [Validators.required]],
    participantId: ['']
  });

  readonly duplicateExpenseForm = this.fb.group({
    expenseDate: [today(), [Validators.required]],
    amount: [null as number | null, [Validators.min(0.01)]],
    description: ['', [Validators.maxLength(500)]],
    paymentState: ['' as ExpensePaymentState | '']
  });

  readonly installmentForm = this.fb.group(
    {
      categoryId: [0, [Validators.required, Validators.min(1)]],
      paymentMethodId: [0, [Validators.required, Validators.min(1)]],
      description: ['', [Validators.required, Validators.maxLength(500)]],
      totalAmount: [0, [Validators.required, Validators.min(0.01)]],
      expenseDate: [today(), [Validators.required]],
      installmentCount: [1, [Validators.required, Validators.min(1)]],
      installmentAmount: [0, [Validators.required, Validators.min(0.01)]],
      firstInstallmentDate: [today(), [Validators.required]],
      debtName: [''],
      notes: [''],
      participantId: ['']
    },
    { validators: installmentTotalValidator }
  );

  ngOnInit(): void {
    this.loadCatalogs();
    this.loadMembers();
    const filters = this.expensesStore.loadPersistedFilters(this.accountId());
    this.patchFilterForm(filters);
    this.expensesStore.loadExpenses(this.accountId(), filters).pipe(take(1)).subscribe({ error: () => undefined });
  }

  activeForm() {
    return this.formMode() === 'simple' ? this.simpleForm : this.installmentForm;
  }

  applyFilters(): void {
    const raw = this.filterForm.getRawValue();
    this.expensesStore
      .loadExpenses(this.accountId(), {
        search: raw.search.trim() || null,
        from: raw.from || null,
        to: raw.to || null,
        categoryId: toNumberOrNull(raw.categoryId),
        paymentMethodId: toNumberOrNull(raw.paymentMethodId),
        paymentState: raw.paymentState ? (raw.paymentState as ExpensePaymentState) : null,
        expenseType: raw.expenseType ? (raw.expenseType as ExpenseType) : null,
        debtPaymentOrigin: originFilterToBoolean(raw.origin),
        status: 'ACTIVE',
        page: 0
      }, { persist: true })
      .pipe(take(1))
      .subscribe({ error: () => undefined });
  }

  clearFilters(): void {
    const filters = this.expensesStore.clearPersistedFilters(this.accountId());
    this.patchFilterForm(filters);
    this.expensesStore.loadExpenses(this.accountId(), filters).pipe(take(1)).subscribe({ error: () => undefined });
  }

  goToPreviousPage(): void {
    if (!this.canGoPreviousPage()) {
      return;
    }

    this.loadPage(this.expensesStore.pagination().page - 1);
  }

  goToNextPage(): void {
    if (!this.canGoNextPage()) {
      return;
    }

    this.loadPage(this.expensesStore.pagination().page + 1);
  }

  changePageSize(value: string): void {
    const size = Number(value);

    if (!this.pageSizeOptions.includes(size) || size === this.expensesStore.pagination().size) {
      return;
    }

    this.expensesStore.loadExpenses(this.accountId(), { size, page: 0 }).pipe(take(1)).subscribe({ error: () => undefined });
  }

  changeDateSort(sort: ExpenseDateSort): void {
    if (this.currentDateSort() === sort) {
      return;
    }

    this.expensesStore.loadExpenses(this.accountId(), { sort, page: 0 }, { persist: true }).pipe(take(1)).subscribe({ error: () => undefined });
  }

  startCreateSimple(): void {
    if (!this.hasRequiredCatalogs() || !this.canCreate()) {
      return;
    }

    this.closeQuickExpense();
    this.formMode.set('simple');
    this.cancelDuplicateForm();
    this.editingExpense.set(null);
    this.simpleForm.reset({
      categoryId: this.expenseCategories()[0]?.id ?? 0,
      paymentMethodId: this.paymentMethods()[0]?.id ?? 0,
      description: '',
      amount: 0,
      expenseDate: today(),
      paymentState: 'PAID',
      participantId: ''
    });
    this.showForm.set(true);
  }

  startCreateInstallment(): void {
    if (!this.hasRequiredCatalogs() || !this.canCreate()) {
      return;
    }

    this.closeQuickExpense();
    this.formMode.set('installment');
    this.cancelDuplicateForm();
    this.editingExpense.set(null);
    this.installmentForm.reset({
      categoryId: this.expenseCategories()[0]?.id ?? 0,
      paymentMethodId: this.paymentMethods()[0]?.id ?? 0,
      description: '',
      totalAmount: 0,
      expenseDate: today(),
      installmentCount: 1,
      installmentAmount: 0,
      firstInstallmentDate: today(),
      debtName: '',
      notes: '',
      participantId: ''
    });
    this.showForm.set(true);
  }

  startEditSimple(expense: ExpenseResponseDto): void {
    if (isDebtPaymentExpense(expense)) {
      this.blockedActionMessage.set('Este gasto fue generado por un pago de deuda y debe gestionarse desde la deuda asociada.');
      return;
    }

    if (!this.canMutateExpense(expense)) {
      return;
    }

    this.blockedActionMessage.set(null);
    this.closeQuickExpense();
    this.formMode.set('simple');
    this.cancelDuplicateForm();
    this.editingExpense.set(expense);
    this.simpleForm.reset({
      categoryId: expense.categoryId,
      paymentMethodId: expense.paymentMethodId,
      description: expense.description,
      amount: expense.amount,
      expenseDate: expense.expenseDate,
      paymentState: expense.paymentState,
      participantId: expense.participantId.toString()
    });
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingExpense.set(null);
  }

  startQuickExpense(): void {
    if (!this.canUseQuickExpense()) {
      return;
    }

    this.successMessage.set(null);
    this.blockedActionMessage.set(null);
    this.showForm.set(false);
    this.cancelDuplicateForm();
    this.editingExpense.set(null);
    this.quickExpenseForm.reset({
      amount: 0,
      categoryId: this.expenseCategories()[0]?.id ?? 0,
      paymentMethodId: this.paymentMethods()[0]?.id ?? 0,
      description: '',
      paymentState: 'PAID',
      expenseDate: today(),
      participantId: ''
    });
    this.showQuickForm.set(true);
    setTimeout(() => this.quickAmountInput?.nativeElement.focus());
  }

  saveQuickExpense(): void {
    if (this.quickExpenseForm.invalid || !this.canUseQuickExpense() || this.expensesStore.isSaving()) {
      this.quickExpenseForm.markAllAsTouched();
      return;
    }

    const raw = this.quickExpenseForm.getRawValue();

    this.successMessage.set(null);
    this.blockedActionMessage.set(null);
    this.expensesStore
      .createSimpleExpense(this.accountId(), {
        categoryId: raw.categoryId,
        paymentMethodId: raw.paymentMethodId,
        description: raw.description.trim() || 'Gasto rápido',
        amount: raw.amount,
        expenseDate: raw.expenseDate,
        paymentState: raw.paymentState,
        participantId: this.selectedParticipantId(raw.participantId)
      })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.successMessage.set('Gasto registrado correctamente.');
          this.resetQuickExpenseForm();
          this.showQuickForm.set(false);
        },
        error: () => undefined
      });
  }

  closeQuickExpense(): void {
    if (this.expensesStore.isSaving()) {
      return;
    }

    this.showQuickForm.set(false);
  }

  startDuplicateExpense(expense: ExpenseResponseDto): void {
    if (!this.canDuplicateExpense(expense)) {
      return;
    }

    this.successMessage.set(null);
    this.blockedActionMessage.set(null);
    this.closeQuickExpense();
    this.showForm.set(false);
    this.editingExpense.set(null);
    this.duplicatingExpense.set(expense);
    this.duplicateExpenseError.set(null);
    this.duplicateExpenseForm.reset({
      expenseDate: nextMonthDate(expense.expenseDate),
      amount: expense.amount,
      description: expense.description,
      paymentState: expense.paymentState
    });
    this.showDuplicateForm.set(true);
  }

  saveDuplicateExpense(): void {
    const source = this.duplicatingExpense();

    if (!source || this.duplicateExpenseForm.invalid || !this.canDuplicateExpense(source)) {
      this.duplicateExpenseForm.markAllAsTouched();
      return;
    }

    const raw = this.duplicateExpenseForm.getRawValue();

    this.successMessage.set(null);
    this.blockedActionMessage.set(null);
    this.duplicateExpenseError.set(null);

    this.expensesStore
      .duplicateExpense(this.accountId(), source.id, {
        expenseDate: raw.expenseDate,
        amount: optionalNumber(raw.amount),
        description: raw.description.trim() || undefined,
        paymentState: raw.paymentState || undefined
      })
      .pipe(take(1))
      .subscribe({
        next: (expense) => {
          this.selectedDetail.set(expense);
          this.successMessage.set('Gasto duplicado correctamente.');
          this.cancelDuplicateForm();
        },
        error: () => undefined
      });
  }

  openTotalModal(): void {
    this.showTotalModal.set(true);
  }

  closeTotalModal(): void {
    this.showTotalModal.set(false);
  }

  cancelDuplicateForm(): void {
    this.showDuplicateForm.set(false);
    this.duplicatingExpense.set(null);
    this.duplicateExpenseError.set(null);
  }

  saveExpense(): void {
    this.successMessage.set(null);
    this.blockedActionMessage.set(null);

    if (this.formMode() === 'simple') {
      this.saveSimpleExpense();
      return;
    }

    this.saveInstallmentExpense();
  }

  saveSimpleExpense(): void {
    if (this.simpleForm.invalid || !this.canCreate()) {
      this.simpleForm.markAllAsTouched();
      return;
    }

    const raw = this.simpleForm.getRawValue();
    const editing = this.editingExpense();
    const request = {
      categoryId: raw.categoryId,
      paymentMethodId: raw.paymentMethodId,
      description: raw.description,
      amount: raw.amount,
      expenseDate: raw.expenseDate,
      paymentState: raw.paymentState,
      participantId: this.selectedParticipantId(raw.participantId)
    };
    const request$ = editing
      ? this.expensesStore.updateExpense(this.accountId(), editing.id, request)
      : this.expensesStore.createSimpleExpense(this.accountId(), request);

    request$.pipe(take(1)).subscribe({
      next: () => {
        this.successMessage.set(editing ? 'Gasto actualizado.' : 'Gasto creado.');
        this.cancelForm();
      },
      error: () => undefined
    });
  }

  saveInstallmentExpense(): void {
    if (this.installmentForm.invalid || !this.canCreate()) {
      this.installmentForm.markAllAsTouched();
      return;
    }

    const raw = this.installmentForm.getRawValue();
    const request: CreateInstallmentExpenseRequest = {
      categoryId: raw.categoryId,
      paymentMethodId: raw.paymentMethodId,
      description: raw.description,
      totalAmount: raw.totalAmount,
      expenseDate: raw.expenseDate,
      installmentCount: raw.installmentCount,
      installmentAmount: raw.installmentAmount,
      firstInstallmentDate: raw.firstInstallmentDate,
      debtName: raw.debtName || null,
      notes: raw.notes || null,
      participantId: this.selectedParticipantId(raw.participantId)
    };

    this.expensesStore
      .createInstallmentExpense(this.accountId(), request)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.successMessage.set('Gasto en cuotas creado con deuda asociada.');
          this.cancelForm();
        },
        error: () => undefined
      });
  }

  installmentFinancedTotal(): number {
    const raw = this.installmentForm.getRawValue();

    return Number(raw.installmentCount ?? 0) * Number(raw.installmentAmount ?? 0);
  }

  installmentFinancingDifference(): number {
    return Math.max(0, this.installmentFinancedTotal() - Number(this.installmentForm.controls.totalAmount.value ?? 0));
  }

  cancelExpense(expense: ExpenseResponseDto): void {
    if (isDebtPaymentExpense(expense)) {
      this.blockedActionMessage.set('Este gasto fue generado por un pago de deuda y debe gestionarse desde la deuda asociada.');
      return;
    }

    if (!this.canMutateExpense(expense) || !globalThis.confirm(`Cancelar gasto "${expense.description}"?`)) {
      return;
    }

    this.blockedActionMessage.set(null);
    this.expensesStore.cancelExpense(this.accountId(), expense.id).pipe(take(1)).subscribe({ error: () => undefined });
  }

  goToRelatedDebt(expense: ExpenseResponseDto): void {
    if (!isDebtPaymentExpense(expense) || !expense.sourceDebtId) {
      return;
    }

    this.router.navigate(['/app/accounts', this.accountId(), 'debts'], { queryParams: { openDebtId: expense.sourceDebtId } });
  }

  canMutateExpense(expense: ExpenseResponseDto): boolean {
    if (
      this.accountStore.selectedAccountArchived() ||
      expense.expenseType === 'INSTALLMENT' ||
      expense.status !== 'ACTIVE' ||
      isDebtPaymentExpense(expense)
    ) {
      return false;
    }

    return this.hasWriteAccessToExpense(expense);
  }

  canDuplicateExpense(expense: ExpenseResponseDto): boolean {
    if (this.accountStore.selectedAccountArchived() || expense.expenseType === 'INSTALLMENT' || expense.status !== 'ACTIVE') {
      return false;
    }

    return this.hasWriteAccessToExpense(expense);
  }

  private hasWriteAccessToExpense(expense: ExpenseResponseDto): boolean {
    const account = this.accountStore.selectedAccount();
    const participantId = this.authStore.user()?.participantId;

    return account?.currentUserRole === 'ACCOUNT_ADMIN' || expense.participantId === participantId;
  }

  categoryName(categoryId: number): string {
    return this.expenseCategories().find((category) => category.id === categoryId)?.name ?? `Categoria ${categoryId}`;
  }

  paymentMethodName(paymentMethodId: number): string {
    return this.paymentMethods().find((method) => method.id === paymentMethodId)?.name ?? `Medio ${paymentMethodId}`;
  }

  participantLabel(member: AccountMemberResponseDto): string {
    return member.displayName ? `${member.displayName} (${member.email})` : member.email;
  }

  selectedInstallmentParticipantLabel(): string {
    const participantId = this.selectedParticipantId(this.installmentForm.controls.participantId.value);
    const member = this.assignableParticipants().find((item) => item.participantId === participantId);

    return member ? this.participantLabel(member) : 'el usuario logueado';
  }

  friendlyError(code: string, fallback: string): string {
    const messages: Record<string, string> = {
      EXPENSE_CATEGORY_NOT_FOUND: 'La categoria no existe.',
      EXPENSE_CATEGORY_INACTIVE: 'La categoria esta inactiva.',
      EXPENSE_CATEGORY_INVALID_TYPE: 'La categoria debe ser de tipo EXPENSE.',
      EXPENSE_PAYMENT_METHOD_NOT_FOUND: 'El medio de pago no existe.',
      EXPENSE_PAYMENT_METHOD_INACTIVE: 'El medio de pago esta inactivo.',
      EXPENSE_AMOUNT_INVALID: 'El monto debe ser mayor que cero.',
      EXPENSE_DUPLICATE_NOT_ALLOWED: 'Solo se pueden duplicar gastos simples activos.',
      EXPENSE_NOT_FOUND: 'No se encontro el gasto origen.',
      EXPENSE_UPDATE_NOT_ALLOWED: 'No se puede actualizar este gasto.',
      ACCOUNT_NOT_ACTIVE: 'La cuenta no permite modificar gastos.',
      INSTALLMENT_FINANCED_TOTAL_INVALID: 'El total financiado no puede ser menor al valor original del gasto.',
      INSTALLMENT_EXPENSE_UPDATE_NOT_ALLOWED: 'Los gastos en cuotas no se actualizan desde esta pantalla.',
      INSTALLMENT_EXPENSE_CANCEL_NOT_ALLOWED: 'Los gastos en cuotas no se cancelan desde esta pantalla.',
      EXPENSE_DEBT_PAYMENT_UPDATE_NOT_ALLOWED: 'Este gasto fue generado por un pago de deuda y debe gestionarse desde la deuda asociada.',
      EXPENSE_DEBT_PAYMENT_CANCEL_NOT_ALLOWED: 'Este gasto fue generado por un pago de deuda y debe gestionarse desde la deuda asociada.',
      VALIDATION_ERROR: 'Revisa los datos del formulario.'
    };

    return messages[code] ?? fallback;
  }

  private loadCatalogs(): void {
    this.catalogsApi
      .listCategories(this.accountId(), { type: 'EXPENSE', status: 'ACTIVE', size: 100, sort: 'name,asc' })
      .pipe(take(1))
      .subscribe({
        next: (page) => this.expenseCategories.set(page.content),
        error: () => this.expenseCategories.set([])
      });

    this.catalogsApi
      .listPaymentMethods(this.accountId(), { status: 'ACTIVE', size: 100, sort: 'name,asc' })
      .pipe(take(1))
      .subscribe({
        next: (page) => this.paymentMethods.set(page.content),
        error: () => this.paymentMethods.set([])
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

  private resetQuickExpenseForm(): void {
    this.quickExpenseForm.reset({
      amount: 0,
      categoryId: this.expenseCategories()[0]?.id ?? 0,
      paymentMethodId: this.paymentMethods()[0]?.id ?? 0,
      description: '',
      paymentState: 'PAID',
      expenseDate: today(),
      participantId: ''
    });
  }

  private loadPage(page: number): void {
    this.expensesStore.loadExpenses(this.accountId(), { page }).pipe(take(1)).subscribe({ error: () => undefined });
  }

  private selectedParticipantId(value: string): number | null {
    const selectedParticipantId = toNumberOrNull(value);
    const currentParticipantId = this.authStore.user()?.participantId ?? null;

    if (!selectedParticipantId) {
      return currentParticipantId;
    }

    const canAssign = this.assignableParticipants().some((member) => member.participantId === selectedParticipantId);

    return canAssign ? selectedParticipantId : currentParticipantId;
  }

  private patchFilterForm(filters: {
    from: string | null;
    to: string | null;
    search: string | null;
    categoryId: number | null;
    paymentMethodId: number | null;
    paymentState: ExpensePaymentState | null;
    expenseType: ExpenseType | null;
    status: ExpenseStatus;
    debtPaymentOrigin: boolean | null;
  }): void {
    this.filterForm.patchValue({
      search: filters.search ?? '',
      from: filters.from ?? '',
      to: filters.to ?? '',
      categoryId: filters.categoryId ? String(filters.categoryId) : '',
      paymentMethodId: filters.paymentMethodId ? String(filters.paymentMethodId) : '',
      paymentState: filters.paymentState ?? '',
      expenseType: filters.expenseType ?? '',
      origin: booleanToOriginFilter(filters.debtPaymentOrigin)
    });
  }
}

function originFilterToBoolean(value: ExpenseOriginFilter): boolean | null {
  if (value === 'DEBT_PAYMENT') {
    return true;
  }

  if (value === 'NOT_DEBT_PAYMENT') {
    return false;
  }

  return null;
}

function booleanToOriginFilter(value: boolean | null | undefined): ExpenseOriginFilter {
  if (value === true) {
    return 'DEBT_PAYMENT';
  }

  if (value === false) {
    return 'NOT_DEBT_PAYMENT';
  }

  return '';
}

export function installmentTotalValidator(control: { get(path: string): { value: unknown } | null }) {
  const totalAmount = Number(control.get('totalAmount')?.value ?? 0);
  const installmentCount = Number(control.get('installmentCount')?.value ?? 0);
  const installmentAmount = Number(control.get('installmentAmount')?.value ?? 0);
  const originalTotalInCents = Math.round(totalAmount * 100);
  const financedTotalInCents = Math.round(installmentCount * installmentAmount * 100);

  if (totalAmount <= 0 || installmentCount <= 0 || installmentAmount <= 0) {
    return null;
  }

  return financedTotalInCents >= originalTotalInCents
    ? null
    : { installmentFinancedTotalTooLow: true };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextMonthDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return today();
  }

  const targetYear = month === 12 ? year + 1 : year;
  const targetMonth = month === 12 ? 1 : month + 1;
  const lastDay = new Date(targetYear, targetMonth, 0).getDate();
  const targetDay = Math.min(day, lastDay);

  return `${targetYear}-${targetMonth.toString().padStart(2, '0')}-${targetDay.toString().padStart(2, '0')}`;
}

function toNumberOrNull(value: string): number | null {
  return value ? Number(value) : null;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  return Number(value);
}
