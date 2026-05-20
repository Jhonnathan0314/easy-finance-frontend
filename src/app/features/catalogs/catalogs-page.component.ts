import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';

import { CatalogStore, CategoryFilters, PaymentMethodFilters } from '../../core/catalogs/catalog.store';
import { AccountStore } from '../../core/state/account.store';
import {
  CatalogStatus,
  CategoryResponseDto,
  CategoryType,
  PaymentMethodResponseDto,
  PaymentMethodType
} from '../../shared/models';

type CatalogTab = 'categories' | 'paymentMethods';

@Component({
  selector: 'ef-catalogs-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  styleUrl: './catalogs-page.component.scss',
  template: `
    <section class="page-shell">
      <div class="page-header">
        <div>
          <h1 class="page-title">Catalogos</h1>
          <p class="page-subtitle">Categorias y medios de pago para la cuenta {{ accountId() }}.</p>
        </div>
        @if (!canWrite()) {
          <span class="permission-note">Solo lectura</span>
        }
      </div>

      @if (accountStore.selectedAccountArchived()) {
        <div class="panel warning-panel">La cuenta esta archivada. Las acciones de escritura estan bloqueadas.</div>
      }

      @if (catalogStore.error(); as error) {
        <div class="panel error-panel" role="alert">
          <strong>{{ error.code }}</strong>
          <span>{{ friendlyError(error.code, error.message) }}</span>
        </div>
      }

      <div class="tabs" role="tablist" aria-label="Catalogos">
        <button type="button" [class.active]="activeTab() === 'categories'" (click)="activeTab.set('categories')">
          Categorias
        </button>
        <button type="button" [class.active]="activeTab() === 'paymentMethods'" (click)="activeTab.set('paymentMethods')">
          Medios de pago
        </button>
      </div>

      @if (activeTab() === 'categories') {
        <section class="catalog-section">
          <div class="section-header">
            <h2>Categorias</h2>
            @if (canWrite()) {
              <button class="button" type="button" (click)="startCreateCategory()">Nueva categoria</button>
            }
          </div>

          <form class="filters" [formGroup]="categoryFilterForm" (ngSubmit)="applyCategoryFilters()">
            <label class="search-field">
              <span>Busqueda</span>
              <input type="search" formControlName="search" placeholder="Buscar categoría por nombre o descripción">
            </label>
            <label>
              <span>Tipo</span>
              <select formControlName="type">
                <option value="">Todos</option>
                @for (type of categoryTypes; track type) {
                  <option [value]="type">{{ type }}</option>
                }
              </select>
            </label>
            <label>
              <span>Status</span>
              <select formControlName="status">
                @for (status of catalogStatuses; track status) {
                  <option [value]="status">{{ status }}</option>
                }
              </select>
            </label>
            <div class="filter-actions">
              <button type="submit">Filtrar</button>
              <button type="button" (click)="clearCategoryFilters()">Limpiar filtros</button>
            </div>
          </form>

          @if (showCategoryForm()) {
            <form class="panel form-grid catalog-form" [formGroup]="categoryForm" (ngSubmit)="saveCategory()">
              <h3>{{ editingCategory() ? 'Editar categoria' : 'Crear categoria' }}</h3>
              <label class="field">
                <span>Nombre</span>
                <input type="text" formControlName="name">
                @if (categoryForm.controls.name.touched && categoryForm.controls.name.hasError('required')) {
                  <small>El nombre es requerido.</small>
                }
              </label>
              <label class="field">
                <span>Descripcion</span>
                <textarea rows="3" formControlName="description"></textarea>
              </label>
              <label class="field">
                <span>Tipo</span>
                <select formControlName="type">
                  @for (type of categoryTypes; track type) {
                    <option [value]="type">{{ type }}</option>
                  }
                </select>
                @if (editingCategory()) {
                  <small>El tipo no se cambia despues de crear la categoria.</small>
                }
              </label>
              <div class="form-actions">
                <button class="button" type="submit" [disabled]="categoryForm.invalid || isSaving()">Guardar</button>
                <button type="button" (click)="cancelCategoryForm()">Cancelar</button>
              </div>
            </form>
          }

          @if (catalogStore.isLoadingCategories()) {
            <div class="panel">Cargando categorias...</div>
          } @else if (!catalogStore.categories().length) {
            <div class="panel empty-state">
              {{ hasCategorySearch() ? 'Sin resultados para la búsqueda' : 'No hay categorias para los filtros actuales.' }}
            </div>
          } @else {
            <div class="catalog-list">
              @for (category of catalogStore.categories(); track category.id) {
                <article class="catalog-card">
                  <div>
                    <h3>{{ category.name }}</h3>
                    <p>{{ category.description || 'Sin descripcion.' }}</p>
                  </div>
                  <div class="badges">
                    <span>{{ category.type }}</span>
                    <span [class.inactive]="category.status === 'INACTIVE'">{{ category.status }}</span>
                  </div>
                  @if (canWrite()) {
                    <div class="actions">
                      <button type="button" (click)="startEditCategory(category)">Editar</button>
                      <button type="button" [disabled]="category.status === 'INACTIVE'" (click)="deactivateCategory(category)">
                        Desactivar
                      </button>
                    </div>
                  }
                </article>
              }
            </div>
          }
        </section>
      } @else {
        <section class="catalog-section">
          <div class="section-header">
            <h2>Medios de pago</h2>
            @if (canWrite()) {
              <button class="button" type="button" (click)="startCreatePaymentMethod()">Nuevo medio</button>
            }
          </div>

          <form class="filters" [formGroup]="paymentMethodFilterForm" (ngSubmit)="applyPaymentMethodFilters()">
            <label class="search-field">
              <span>Busqueda</span>
              <input type="search" formControlName="search" placeholder="Buscar medio por nombre o descripción">
            </label>
            <label>
              <span>Tipo</span>
              <select formControlName="type">
                <option value="">Todos</option>
                @for (type of paymentMethodTypes; track type) {
                  <option [value]="type">{{ type }}</option>
                }
              </select>
            </label>
            <label>
              <span>Status</span>
              <select formControlName="status">
                @for (status of catalogStatuses; track status) {
                  <option [value]="status">{{ status }}</option>
                }
              </select>
            </label>
            <div class="filter-actions">
              <button type="submit">Filtrar</button>
              <button type="button" (click)="clearPaymentMethodFilters()">Limpiar filtros</button>
            </div>
          </form>

          @if (showPaymentMethodForm()) {
            <form class="panel form-grid catalog-form" [formGroup]="paymentMethodForm" (ngSubmit)="savePaymentMethod()">
              <h3>{{ editingPaymentMethod() ? 'Editar medio de pago' : 'Crear medio de pago' }}</h3>
              <label class="field">
                <span>Nombre</span>
                <input type="text" formControlName="name">
                @if (paymentMethodForm.controls.name.touched && paymentMethodForm.controls.name.hasError('required')) {
                  <small>El nombre es requerido.</small>
                }
              </label>
              <label class="field">
                <span>Descripcion</span>
                <textarea rows="3" formControlName="description"></textarea>
              </label>
              <label class="field">
                <span>Tipo</span>
                <select formControlName="type">
                  @for (type of paymentMethodTypes; track type) {
                    <option [value]="type">{{ type }}</option>
                  }
                </select>
                @if (editingPaymentMethod()) {
                  <small>El tipo no se cambia despues de crear el medio de pago.</small>
                }
              </label>
              <div class="form-actions">
                <button class="button" type="submit" [disabled]="paymentMethodForm.invalid || isSaving()">Guardar</button>
                <button type="button" (click)="cancelPaymentMethodForm()">Cancelar</button>
              </div>
            </form>
          }

          @if (catalogStore.isLoadingPaymentMethods()) {
            <div class="panel">Cargando medios de pago...</div>
          } @else if (!catalogStore.paymentMethods().length) {
            <div class="panel empty-state">
              {{ hasPaymentMethodSearch() ? 'Sin resultados para la búsqueda' : 'No hay medios de pago para los filtros actuales.' }}
            </div>
          } @else {
            <div class="catalog-list">
              @for (paymentMethod of catalogStore.paymentMethods(); track paymentMethod.id) {
                <article class="catalog-card">
                  <div>
                    <h3>{{ paymentMethod.name }}</h3>
                    <p>{{ paymentMethod.description || 'Sin descripcion.' }}</p>
                  </div>
                  <div class="badges">
                    <span>{{ paymentMethod.type }}</span>
                    <span [class.inactive]="paymentMethod.status === 'INACTIVE'">{{ paymentMethod.status }}</span>
                  </div>
                  @if (canWrite()) {
                    <div class="actions">
                      <button type="button" (click)="startEditPaymentMethod(paymentMethod)">Editar</button>
                      <button
                        type="button"
                        [disabled]="paymentMethod.status === 'INACTIVE'"
                        (click)="deactivatePaymentMethod(paymentMethod)"
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
      }
    </section>
  `
})
export class CatalogsPageComponent implements OnInit {
  protected readonly catalogStore = inject(CatalogStore);
  protected readonly accountStore = inject(AccountStore);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly activeTab = signal<CatalogTab>('categories');
  readonly showCategoryForm = signal(false);
  readonly showPaymentMethodForm = signal(false);
  readonly editingCategory = signal<CategoryResponseDto | null>(null);
  readonly editingPaymentMethod = signal<PaymentMethodResponseDto | null>(null);
  readonly isSaving = signal(false);
  readonly accountId = computed(() => this.accountStore.selectedAccountId() ?? 0);
  readonly canWrite = computed(
    () => this.accountStore.selectedAccount()?.currentUserRole === 'ACCOUNT_ADMIN' && !this.accountStore.selectedAccountArchived()
  );

  readonly categoryTypes: CategoryType[] = ['EXPENSE', 'INCOME'];
  readonly catalogStatuses: CatalogStatus[] = ['ACTIVE', 'INACTIVE'];
  readonly paymentMethodTypes: PaymentMethodType[] = [
    'CASH',
    'BANK_ACCOUNT',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'DIGITAL_WALLET',
    'OTHER'
  ];

  readonly categoryFilterForm = this.fb.group({
    search: [''],
    type: [''],
    status: ['ACTIVE']
  });
  readonly paymentMethodFilterForm = this.fb.group({
    search: [''],
    type: [''],
    status: ['ACTIVE']
  });
  readonly categoryForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]],
    type: ['EXPENSE' as CategoryType, [Validators.required]]
  });
  readonly paymentMethodForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]],
    type: ['CASH' as PaymentMethodType, [Validators.required]]
  });

  ngOnInit(): void {
    this.patchCategoryFilterForm(this.catalogStore.loadPersistedCategoryFilters(this.accountId()));
    this.patchPaymentMethodFilterForm(this.catalogStore.loadPersistedPaymentMethodFilters(this.accountId()));
    this.catalogStore.refreshAll(this.accountId()).pipe(take(1)).subscribe({ error: () => undefined });
  }

  applyCategoryFilters(): void {
    const raw = this.categoryFilterForm.getRawValue();
    this.catalogStore
      .loadCategories(this.accountId(), {
        search: raw.search,
        type: raw.type ? (raw.type as CategoryType) : null,
        status: raw.status as CatalogStatus
      },
      { persist: true })
      .pipe(take(1))
      .subscribe({ error: () => undefined });
  }

  applyPaymentMethodFilters(): void {
    const raw = this.paymentMethodFilterForm.getRawValue();
    this.catalogStore
      .loadPaymentMethods(this.accountId(), {
        search: raw.search,
        type: raw.type ? (raw.type as PaymentMethodType) : null,
        status: raw.status as CatalogStatus
      },
      { persist: true })
      .pipe(take(1))
      .subscribe({ error: () => undefined });
  }

  clearCategoryFilters(): void {
    this.patchCategoryFilterForm(this.catalogStore.clearPersistedCategoryFilters(this.accountId()));
    this.catalogStore.loadCategories(this.accountId()).pipe(take(1)).subscribe({ error: () => undefined });
  }

  clearPaymentMethodFilters(): void {
    this.patchPaymentMethodFilterForm(this.catalogStore.clearPersistedPaymentMethodFilters(this.accountId()));
    this.catalogStore.loadPaymentMethods(this.accountId()).pipe(take(1)).subscribe({ error: () => undefined });
  }

  hasCategorySearch(): boolean {
    return Boolean(this.catalogStore.categoryFilters().search);
  }

  hasPaymentMethodSearch(): boolean {
    return Boolean(this.catalogStore.paymentMethodFilters().search);
  }

  startCreateCategory(): void {
    this.editingCategory.set(null);
    this.categoryForm.reset({ name: '', description: '', type: 'EXPENSE' });
    this.categoryForm.controls.type.enable();
    this.showCategoryForm.set(true);
  }

  startEditCategory(category: CategoryResponseDto): void {
    this.editingCategory.set(category);
    this.categoryForm.reset({
      name: category.name,
      description: category.description ?? '',
      type: category.type
    });
    this.categoryForm.controls.type.disable();
    this.showCategoryForm.set(true);
  }

  cancelCategoryForm(): void {
    this.showCategoryForm.set(false);
    this.editingCategory.set(null);
    this.categoryForm.controls.type.enable();
  }

  saveCategory(): void {
    if (this.categoryForm.invalid || !this.canWrite()) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const raw = this.categoryForm.getRawValue();
    const editing = this.editingCategory();
    const request$ = editing
      ? this.catalogStore.updateCategory(this.accountId(), editing.id, {
          name: raw.name,
          description: raw.description || null
        })
      : this.catalogStore.createCategory(this.accountId(), {
          name: raw.name,
          description: raw.description || null,
          type: raw.type as CategoryType
        });

    request$.pipe(take(1)).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.cancelCategoryForm();
      },
      error: () => this.isSaving.set(false)
    });
  }

  deactivateCategory(category: CategoryResponseDto): void {
    if (!this.canWrite() || !globalThis.confirm(`Desactivar categoria "${category.name}"?`)) {
      return;
    }

    this.catalogStore.deactivateCategory(this.accountId(), category.id).pipe(take(1)).subscribe({ error: () => undefined });
  }

  startCreatePaymentMethod(): void {
    this.editingPaymentMethod.set(null);
    this.paymentMethodForm.reset({ name: '', description: '', type: 'CASH' });
    this.paymentMethodForm.controls.type.enable();
    this.showPaymentMethodForm.set(true);
  }

  startEditPaymentMethod(paymentMethod: PaymentMethodResponseDto): void {
    this.editingPaymentMethod.set(paymentMethod);
    this.paymentMethodForm.reset({
      name: paymentMethod.name,
      description: paymentMethod.description ?? '',
      type: paymentMethod.type
    });
    this.paymentMethodForm.controls.type.disable();
    this.showPaymentMethodForm.set(true);
  }

  cancelPaymentMethodForm(): void {
    this.showPaymentMethodForm.set(false);
    this.editingPaymentMethod.set(null);
    this.paymentMethodForm.controls.type.enable();
  }

  savePaymentMethod(): void {
    if (this.paymentMethodForm.invalid || !this.canWrite()) {
      this.paymentMethodForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const raw = this.paymentMethodForm.getRawValue();
    const editing = this.editingPaymentMethod();
    const request$ = editing
      ? this.catalogStore.updatePaymentMethod(this.accountId(), editing.id, {
          name: raw.name,
          description: raw.description || null
        })
      : this.catalogStore.createPaymentMethod(this.accountId(), {
          name: raw.name,
          description: raw.description || null,
          type: raw.type as PaymentMethodType
        });

    request$.pipe(take(1)).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.cancelPaymentMethodForm();
      },
      error: () => this.isSaving.set(false)
    });
  }

  deactivatePaymentMethod(paymentMethod: PaymentMethodResponseDto): void {
    if (!this.canWrite() || !globalThis.confirm(`Desactivar medio de pago "${paymentMethod.name}"?`)) {
      return;
    }

    this.catalogStore
      .deactivatePaymentMethod(this.accountId(), paymentMethod.id)
      .pipe(take(1))
      .subscribe({ error: () => undefined });
  }

  friendlyError(code: string, fallback: string): string {
    const messages: Record<string, string> = {
      CATEGORY_ALREADY_EXISTS: 'Ya existe una categoria activa con ese nombre.',
      CATEGORY_TYPE_CHANGE_NOT_ALLOWED: 'No se puede cambiar el tipo de una categoria existente.',
      CATEGORY_INACTIVE: 'La categoria esta inactiva.',
      PAYMENT_METHOD_ALREADY_EXISTS: 'Ya existe un medio de pago activo con ese nombre.',
      PAYMENT_METHOD_TYPE_CHANGE_NOT_ALLOWED: 'No se puede cambiar el tipo de un medio de pago existente.',
      PAYMENT_METHOD_INACTIVE: 'El medio de pago esta inactivo.',
      VALIDATION_ERROR: 'Revisa los datos del formulario.'
    };

    return messages[code] ?? fallback;
  }

  private patchCategoryFilterForm(filters: CategoryFilters): void {
    this.categoryFilterForm.patchValue({
      search: filters.search ?? '',
      type: filters.type ?? '',
      status: filters.status
    });
  }

  private patchPaymentMethodFilterForm(filters: PaymentMethodFilters): void {
    this.paymentMethodFilterForm.patchValue({
      search: filters.search ?? '',
      type: filters.type ?? '',
      status: filters.status
    });
  }
}
