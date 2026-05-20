import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { take } from 'rxjs';

import { AuthStore } from '../../core/auth/auth.store';
import { CatalogsApiService } from '../../core/catalogs/catalogs-api.service';
import { IncomeFilters, IncomeStore } from '../../core/income/income.store';
import { AccountStore } from '../../core/state/account.store';
import { CategoryResponseDto, IncomeResponseDto } from '../../shared/models';

type IncomeDateSort = 'incomeDate,asc' | 'incomeDate,desc';

@Component({
  selector: 'ef-income-page',
  standalone: true,
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink],
  styleUrl: './income-page.component.scss',
  template: `
    <section class="page-shell">
      <div class="page-header">
        <div>
          <h1 class="page-title">Ingresos</h1>
          <p class="page-subtitle">Ingresos de la cuenta {{ accountId() }}.</p>
        </div>
        @if (canCreate()) {
          <button class="button" type="button" [disabled]="!hasRequiredCatalogs()" (click)="startCreateIncome()">
            Crear ingreso
          </button>
        }
      </div>

      @if (accountStore.selectedAccountArchived()) {
        <div class="panel warning-panel">La cuenta esta archivada. Las acciones de escritura estan bloqueadas.</div>
      }

      @if (!hasRequiredCatalogs()) {
        <div class="panel warning-panel">
          Necesitas al menos una categoria INCOME activa.
          <a [routerLink]="['/app/accounts', accountId(), 'catalogs']">Ir a catalogos</a>
        </div>
      }

      @if (successMessage(); as message) {
        <div class="panel success-panel">{{ message }}</div>
      }

      @if (incomeStore.error(); as error) {
        <div class="panel error-panel" role="alert">
          <strong>{{ error.code }}</strong>
          <span>{{ friendlyError(error.code, error.message) }}</span>
        </div>
      }

      <form class="filters" [formGroup]="filterForm" (ngSubmit)="applyFilters()">
        <label class="search-field">
          <span>Buscar descripcion</span>
          <input type="search" formControlName="search" placeholder="Buscar ingreso por descripcion">
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
            @for (category of incomeCategories(); track category.id) {
              <option [value]="category.id">{{ category.name }}</option>
            }
          </select>
        </label>
        <div class="filter-actions">
          <button type="submit">Filtrar</button>
          <button type="button" (click)="clearFilters()">Limpiar filtros</button>
        </div>
      </form>

      <div class="sort-toolbar" aria-label="Orden de ingresos por fecha">
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

      @if (showForm()) {
        <form class="panel form-grid income-form" [formGroup]="incomeForm" (ngSubmit)="saveIncome()">
          <h2>{{ editingIncome() ? 'Editar ingreso' : 'Crear ingreso' }}</h2>
          <label class="field">
            <span>Categoria</span>
            <select formControlName="categoryId">
              <option [ngValue]="0">Selecciona</option>
              @for (category of incomeCategories(); track category.id) {
                <option [ngValue]="category.id">{{ category.name }}</option>
              }
            </select>
          </label>
          <label class="field">
            <span>Monto</span>
            <input type="number" min="0.01" step="0.01" formControlName="amount">
          </label>
          <label class="field">
            <span>Fecha</span>
            <input type="date" formControlName="incomeDate">
          </label>
          <label class="field wide">
            <span>Descripcion</span>
            <input type="text" formControlName="description">
          </label>
          <div class="form-actions">
            <button class="button" type="submit" [disabled]="incomeForm.invalid || incomeStore.isSaving()">Guardar</button>
            <button type="button" (click)="cancelForm()">Cancelar</button>
          </div>
        </form>
      }

      @if (showDuplicateForm()) {
        <form class="panel form-grid duplicate-income-form" [formGroup]="duplicateIncomeForm" (ngSubmit)="saveDuplicateIncome()">
          <h2>Duplicar ingreso</h2>
          @if (duplicatingIncome(); as income) {
            <p class="form-note">Origen: {{ income.description }} - {{ income.incomeDate }}</p>
          }
          @if (duplicateIncomeError(); as error) {
            <p class="form-error">{{ error }}</p>
          }
          <label class="field">
            <span>Fecha nueva</span>
            <input type="date" formControlName="incomeDate">
          </label>
          <label class="field">
            <span>Monto</span>
            <input type="number" min="0.01" step="0.01" formControlName="amount">
          </label>
          <label class="field wide">
            <span>Descripcion</span>
            <input type="text" formControlName="description">
          </label>
          <div class="form-actions">
            <button class="button" type="submit" [disabled]="duplicateIncomeForm.invalid || incomeStore.isSaving()">
              Duplicar ingreso
            </button>
            <button type="button" (click)="cancelDuplicateForm()">Cancelar</button>
          </div>
        </form>
      }

      @if (selectedDetail(); as income) {
        <section class="panel detail-panel">
          <div>
            <h2>{{ income.description }}</h2>
            <p>{{ income.incomeDate }} - {{ categoryName(income.categoryId) }} - Participante {{ income.participantId }}</p>
          </div>
          <strong>{{ income.amount | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
          <div class="badges">
            <span>{{ income.status }}</span>
          </div>
          <button type="button" (click)="selectedDetail.set(null)">Cerrar detalle</button>
        </section>
      }

      @if (incomeStore.isLoading()) {
        <div class="panel">Cargando ingresos...</div>
      } @else if (!incomeStore.incomes().length) {
        <div class="panel empty-state">
          <h2>No hay ingresos para los filtros actuales</h2>
          @if (canCreate() && hasRequiredCatalogs()) {
            <button class="button" type="button" (click)="startCreateIncome()">Crear ingreso</button>
          }
        </div>
      } @else {
        <nav class="pagination pagination-top" aria-label="Paginacion superior de ingresos">
          <label class="page-size-field">
            <span>Tamano pagina</span>
            <select [value]="incomeStore.pagination().size" [disabled]="incomeStore.isLoading()" (change)="changePageSize($any($event.target).value)">
              @for (size of pageSizeOptions; track size) {
                <option [value]="size" [selected]="incomeStore.pagination().size === size">{{ size }}</option>
              }
            </select>
          </label>
          <div class="pagination-actions">
            <button type="button" [disabled]="!canGoPreviousPage() || incomeStore.isLoading()" (click)="goToPreviousPage()">
              Anterior
            </button>
            <span>Pagina {{ currentPageNumber() }} de {{ totalPagesNumber() }}</span>
            <span>{{ incomeStore.pagination().totalElements }} registros</span>
            <button type="button" [disabled]="!canGoNextPage() || incomeStore.isLoading()" (click)="goToNextPage()">
              Siguiente
            </button>
          </div>
        </nav>
        <div class="income-list">
          @for (income of incomeStore.incomes(); track income.id) {
            <article class="income-card">
              <div>
                <h3>{{ income.description }}</h3>
                <p>{{ income.incomeDate }} - {{ categoryName(income.categoryId) }} - Participante {{ income.participantId }}</p>
              </div>
              <strong>{{ income.amount | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
              <div class="badges">
                <span [class.cancelled]="income.status === 'CANCELLED'">{{ income.status }}</span>
              </div>
              <div class="actions">
                @if (canMutateIncome(income)) {
                  <button type="button" (click)="startEditIncome(income)">Editar</button>
                  <button type="button" (click)="startDuplicateIncome(income)">Duplicar</button>
                  <button type="button" (click)="cancelIncome(income)">Cancelar</button>
                }
              </div>
            </article>
          }
        </div>
        <nav class="pagination pagination-bottom" aria-label="Paginacion inferior de ingresos">
          <div class="pagination-actions">
            <button type="button" [disabled]="!canGoPreviousPage() || incomeStore.isLoading()" (click)="goToPreviousPage()">
              Anterior
            </button>
            <span>Pagina {{ currentPageNumber() }} de {{ totalPagesNumber() }}</span>
            <span>{{ incomeStore.pagination().totalElements }} registros</span>
            <button type="button" [disabled]="!canGoNextPage() || incomeStore.isLoading()" (click)="goToNextPage()">
              Siguiente
            </button>
          </div>
        </nav>
      }
    </section>
  `
})
export class IncomePageComponent implements OnInit {
  protected readonly incomeStore = inject(IncomeStore);
  protected readonly accountStore = inject(AccountStore);
  private readonly authStore = inject(AuthStore);
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly incomeCategories = signal<CategoryResponseDto[]>([]);
  readonly selectedDetail = signal<IncomeResponseDto | null>(null);
  readonly showForm = signal(false);
  readonly showDuplicateForm = signal(false);
  readonly editingIncome = signal<IncomeResponseDto | null>(null);
  readonly duplicatingIncome = signal<IncomeResponseDto | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly duplicateIncomeError = signal<string | null>(null);
  readonly accountId = computed(() => this.accountStore.selectedAccountId() ?? 0);
  readonly canCreate = computed(() => this.accountStore.selectedAccount()?.status === 'ACTIVE');
  readonly hasRequiredCatalogs = computed(() => this.incomeCategories().length > 0);
  readonly currentPageNumber = computed(() => (this.incomeStore.pagination().totalPages ? this.incomeStore.pagination().page + 1 : 1));
  readonly totalPagesNumber = computed(() => Math.max(this.incomeStore.pagination().totalPages, 1));
  readonly canGoPreviousPage = computed(() => this.incomeStore.pagination().page > 0);
  readonly canGoNextPage = computed(() => {
    const pagination = this.incomeStore.pagination();

    return pagination.totalPages > 0 && pagination.page + 1 < pagination.totalPages;
  });
  readonly dateSortOptions: Array<{ label: string; value: IncomeDateSort }> = [
    { label: 'Fecha descendente', value: 'incomeDate,desc' },
    { label: 'Fecha ascendente', value: 'incomeDate,asc' }
  ];
  readonly pageSizeOptions = [10, 20, 50, 100];
  readonly currentDateSort = computed<IncomeDateSort>(() =>
    this.incomeStore.filters().sort === 'incomeDate,asc' ? 'incomeDate,asc' : 'incomeDate,desc'
  );

  readonly filterForm = this.fb.group({
    search: [''],
    from: [''],
    to: [''],
    categoryId: ['']
  });

  readonly incomeForm = this.fb.group({
    categoryId: [0, [Validators.required, Validators.min(1)]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    incomeDate: [today(), [Validators.required]]
  });
  readonly duplicateIncomeForm = this.fb.group({
    incomeDate: [today(), [Validators.required]],
    amount: [null as number | null, [Validators.min(0.01)]],
    description: ['', [Validators.maxLength(500)]]
  });

  ngOnInit(): void {
    this.loadCategories();
    this.patchFilterForm(this.incomeStore.loadPersistedFilters(this.accountId()));
    this.incomeStore.loadIncomes(this.accountId()).pipe(take(1)).subscribe({ error: () => undefined });
  }

  applyFilters(): void {
    const raw = this.filterForm.getRawValue();
    this.incomeStore
      .loadIncomes(this.accountId(), {
        search: raw.search.trim() || null,
        from: raw.from || null,
        to: raw.to || null,
        categoryId: toNumberOrNull(raw.categoryId),
        page: 0
      },
      { persist: true })
      .pipe(take(1))
      .subscribe({ error: () => undefined });
  }

  clearFilters(): void {
    const filters = this.incomeStore.clearPersistedFilters(this.accountId());

    this.patchFilterForm(filters);
    this.incomeStore.loadIncomes(this.accountId(), visibleFilterRequest(filters)).pipe(take(1)).subscribe({ error: () => undefined });
  }

  goToPreviousPage(): void {
    if (!this.canGoPreviousPage()) {
      return;
    }

    this.loadPage(this.incomeStore.pagination().page - 1);
  }

  goToNextPage(): void {
    if (!this.canGoNextPage()) {
      return;
    }

    this.loadPage(this.incomeStore.pagination().page + 1);
  }

  changePageSize(value: string): void {
    const size = Number(value);

    if (!this.pageSizeOptions.includes(size) || size === this.incomeStore.pagination().size) {
      return;
    }

    this.incomeStore.loadIncomes(this.accountId(), { size, page: 0 }).pipe(take(1)).subscribe({ error: () => undefined });
  }

  changeDateSort(sort: IncomeDateSort): void {
    if (this.currentDateSort() === sort) {
      return;
    }

    this.incomeStore.loadIncomes(this.accountId(), { sort, page: 0 }, { persist: true }).pipe(take(1)).subscribe({ error: () => undefined });
  }

  startCreateIncome(): void {
    if (!this.canCreate() || !this.hasRequiredCatalogs()) {
      return;
    }

    this.successMessage.set(null);
    this.cancelDuplicateForm();
    this.editingIncome.set(null);
    this.incomeForm.reset({
      categoryId: this.incomeCategories()[0]?.id ?? 0,
      description: '',
      amount: 0,
      incomeDate: today()
    });
    this.showForm.set(true);
  }

  startEditIncome(income: IncomeResponseDto): void {
    if (!this.canMutateIncome(income)) {
      return;
    }

    this.successMessage.set(null);
    this.cancelDuplicateForm();
    this.editingIncome.set(income);
    this.incomeForm.reset({
      categoryId: income.categoryId,
      description: income.description,
      amount: income.amount,
      incomeDate: income.incomeDate
    });
    this.showForm.set(true);
  }

  startDuplicateIncome(income: IncomeResponseDto): void {
    if (!this.canDuplicateIncome(income)) {
      return;
    }

    this.successMessage.set(null);
    this.showForm.set(false);
    this.editingIncome.set(null);
    this.duplicatingIncome.set(income);
    this.duplicateIncomeError.set(null);
    this.duplicateIncomeForm.reset({
      incomeDate: nextMonthDate(income.incomeDate),
      amount: income.amount,
      description: income.description
    });
    this.showDuplicateForm.set(true);
  }

  saveDuplicateIncome(): void {
    const source = this.duplicatingIncome();

    if (!source || this.duplicateIncomeForm.invalid || !this.canDuplicateIncome(source)) {
      this.duplicateIncomeForm.markAllAsTouched();
      return;
    }

    const raw = this.duplicateIncomeForm.getRawValue();
    const amount = optionalNumber(raw.amount);

    this.successMessage.set(null);
    this.duplicateIncomeError.set(null);

    this.incomeStore
      .duplicateIncome(this.accountId(), source.id, {
        incomeDate: raw.incomeDate,
        amount,
        description: raw.description.trim() || null
      })
      .pipe(take(1))
      .subscribe({
        next: (income) => {
          this.selectedDetail.set(income);
          this.successMessage.set('Ingreso duplicado correctamente.');
          this.cancelDuplicateForm();
        },
        error: () => undefined
      });
  }

  saveIncome(): void {
    if (this.incomeForm.invalid || !this.canCreate()) {
      this.incomeForm.markAllAsTouched();
      return;
    }

    const raw = this.incomeForm.getRawValue();
    const editing = this.editingIncome();
    const request = {
      categoryId: raw.categoryId,
      description: raw.description,
      amount: raw.amount,
      incomeDate: raw.incomeDate
    };
    const request$ = editing
      ? this.incomeStore.updateIncome(this.accountId(), editing.id, request)
      : this.incomeStore.createIncome(this.accountId(), request);

    request$.pipe(take(1)).subscribe({
      next: () => {
        this.successMessage.set(editing ? 'Ingreso actualizado.' : 'Ingreso creado.');
        this.cancelForm();
      },
      error: () => undefined
    });
  }

  cancelIncome(income: IncomeResponseDto): void {
    if (!this.canMutateIncome(income) || !globalThis.confirm(`Cancelar ingreso "${income.description}"?`)) {
      return;
    }

    this.incomeStore.cancelIncome(this.accountId(), income.id).pipe(take(1)).subscribe({
      next: () => this.successMessage.set('Ingreso cancelado.'),
      error: () => undefined
    });
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingIncome.set(null);
  }

  cancelDuplicateForm(): void {
    this.showDuplicateForm.set(false);
    this.duplicatingIncome.set(null);
    this.duplicateIncomeError.set(null);
  }

  canDuplicateIncome(income: IncomeResponseDto): boolean {
    return this.canMutateIncome(income);
  }

  canMutateIncome(income: IncomeResponseDto): boolean {
    if (this.accountStore.selectedAccountArchived() || income.status !== 'ACTIVE') {
      return false;
    }

    const account = this.accountStore.selectedAccount();
    const participantId = this.authStore.user()?.participantId;

    return account?.currentUserRole === 'ACCOUNT_ADMIN' || income.participantId === participantId;
  }

  categoryName(categoryId: number): string {
    return this.incomeCategories().find((category) => category.id === categoryId)?.name ?? `Categoria ${categoryId}`;
  }

  friendlyError(code: string, fallback: string): string {
    const messages: Record<string, string> = {
      INCOME_CATEGORY_NOT_FOUND: 'La categoria no existe.',
      INCOME_CATEGORY_INACTIVE: 'La categoria esta inactiva.',
      INCOME_CATEGORY_INVALID_TYPE: 'La categoria debe ser de tipo INCOME.',
      INCOME_AMOUNT_INVALID: 'El monto debe ser mayor que cero.',
      INCOME_NOT_ACTIVE: 'El ingreso no esta activo.',
      INCOME_DUPLICATE_NOT_ALLOWED: 'No se puede duplicar un ingreso cancelado.',
      INCOME_NOT_FOUND: 'No se encontro el ingreso origen.',
      INCOME_UPDATE_NOT_ALLOWED: 'No se puede actualizar este ingreso.',
      INCOME_CANCEL_NOT_ALLOWED: 'No se puede cancelar este ingreso.',
      ACCOUNT_NOT_ACTIVE: 'La cuenta no permite modificar ingresos.',
      VALIDATION_ERROR: 'Revisa los datos del formulario.'
    };

    return messages[code] ?? fallback;
  }

  private loadCategories(): void {
    this.catalogsApi
      .listCategories(this.accountId(), { type: 'INCOME', status: 'ACTIVE', size: 100, sort: 'name,asc' })
      .pipe(take(1))
      .subscribe({
        next: (page) => this.incomeCategories.set(page.content),
        error: () => this.incomeCategories.set([])
      });
  }

  private patchFilterForm(filters: IncomeFilters): void {
    this.filterForm.patchValue({
      search: filters.search ?? '',
      from: filters.from ?? '',
      to: filters.to ?? '',
      categoryId: filters.categoryId?.toString() ?? ''
    });
  }

  private loadPage(page: number): void {
    this.incomeStore.loadIncomes(this.accountId(), { page }).pipe(take(1)).subscribe({ error: () => undefined });
  }
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

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return Number(value);
}

function visibleFilterRequest(filters: IncomeFilters): Partial<IncomeFilters> {
  return {
    search: filters.search,
    from: filters.from,
    to: filters.to,
    categoryId: filters.categoryId,
    page: 0,
    sort: filters.sort
  };
}
