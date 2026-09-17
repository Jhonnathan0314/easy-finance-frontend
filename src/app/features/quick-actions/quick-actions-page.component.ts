import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { take } from 'rxjs';

import { AccountsApiService } from '../../core/accounts/accounts-api.service';
import { AuthStore } from '../../core/auth/auth.store';
import { CatalogsApiService } from '../../core/catalogs/catalogs-api.service';
import { ExpensesStore } from '../../core/expenses/expenses.store';
import { IncomeStore } from '../../core/income/income.store';
import { AccountStore } from '../../core/state/account.store';
import {
  AccountMemberResponseDto,
  CategoryResponseDto,
  CreateInstallmentExpenseRequest,
  ExpensePaymentState,
  PaymentMethodResponseDto
} from '../../shared/models';
import { enumLabel } from '../../shared/ui/enum-labels';
import { installmentTotalValidator } from '../expenses/expenses-page.component';

type QuickAction = 'none' | 'simple-expense' | 'installment-expense' | 'income';

@Component({
  selector: 'ef-quick-actions-page',
  standalone: true,
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink],
  styleUrl: './quick-actions-page.component.scss',
  template: `
    <section class="page-shell">
      <div class="page-header">
        <div>
          <h1 class="page-title">Acciones rápidas</h1>
          <p class="page-subtitle">Registra gastos e ingresos sin salir de esta pantalla.</p>
        </div>
      </div>

      @if (accountStore.selectedAccountArchived()) {
        <div class="panel warning-panel">La cuenta esta archivada. Las acciones de escritura estan bloqueadas.</div>
      }

      @if (!hasExpenseCatalogs()) {
        <div class="panel warning-panel">
          Necesitas al menos una categoría de gasto activa y un medio de pago activo para registrar gastos.
          <a [routerLink]="['/app/accounts', accountId(), 'catalogs']">Ir a catálogos</a>
        </div>
      }

      @if (!hasIncomeCatalogs()) {
        <div class="panel warning-panel">
          Necesitas al menos una categoría de ingreso activa para registrar ingresos.
          <a [routerLink]="['/app/accounts', accountId(), 'catalogs']">Ir a catálogos</a>
        </div>
      }

      @if (successMessage(); as message) {
        <div class="panel success-panel">{{ message }}</div>
      }

      @if (expensesStore.error(); as error) {
        <div class="panel error-panel" role="alert">
          <strong>{{ error.code }}</strong>
          <span>{{ expenseFriendlyError(error.code, error.message) }}</span>
        </div>
      }

      @if (incomeStore.error(); as error) {
        <div class="panel error-panel" role="alert">
          <strong>{{ error.code }}</strong>
          <span>{{ incomeFriendlyError(error.code, error.message) }}</span>
        </div>
      }

      <div class="quick-action-buttons">
        <button class="button" type="button" [disabled]="!canCreateExpense()" (click)="startCreateSimpleExpense()">
          Gasto simple
        </button>
        <button class="button secondary" type="button" [disabled]="!canCreateExpense()" (click)="startCreateInstallmentExpense()">
          Gasto en cuotas
        </button>
        <button class="button" type="button" [disabled]="!canCreateIncome()" (click)="startCreateIncome()">
          Crear ingreso
        </button>
      </div>

      @if (activeAction() === 'simple-expense') {
        <form class="panel form-grid quick-action-form" [formGroup]="simpleExpenseForm" (ngSubmit)="saveSimpleExpense()">
          <h2>Gasto simple</h2>
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
          <div class="form-actions">
            <button class="button" type="submit" [disabled]="simpleExpenseForm.invalid || expensesStore.isSaving()">
              Guardar
            </button>
            <button type="button" (click)="closeActiveForm()">Cancelar</button>
          </div>
        </form>
      }

      @if (activeAction() === 'installment-expense') {
        <form class="panel form-grid quick-action-form" [formGroup]="installmentExpenseForm" (ngSubmit)="saveInstallmentExpense()">
          <h2>Gasto en cuotas</h2>
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
          @if (installmentExpenseForm.hasError('installmentFinancedTotalTooLow')) {
            <p class="form-error">El total financiado no puede ser menor al valor original del gasto.</p>
          }
          <div class="form-actions">
            <button class="button" type="submit" [disabled]="installmentExpenseForm.invalid || expensesStore.isSaving()">
              Guardar
            </button>
            <button type="button" (click)="closeActiveForm()">Cancelar</button>
          </div>
        </form>
      }

      @if (activeAction() === 'income') {
        <form class="panel form-grid quick-action-form" [formGroup]="incomeForm" (ngSubmit)="saveIncome()">
          <h2>Crear ingreso</h2>
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
            <input type="text" formControlName="description">
          </label>
          <div class="form-actions">
            <button class="button" type="submit" [disabled]="incomeForm.invalid || incomeStore.isSaving()">Guardar</button>
            <button type="button" (click)="closeActiveForm()">Cancelar</button>
          </div>
        </form>
      }
    </section>
  `
})
export class QuickActionsPageComponent implements OnInit {
  protected readonly expensesStore = inject(ExpensesStore);
  protected readonly incomeStore = inject(IncomeStore);
  protected readonly accountStore = inject(AccountStore);
  protected readonly enumLabel = enumLabel;
  private readonly authStore = inject(AuthStore);
  private readonly accountsApi = inject(AccountsApiService);
  private readonly catalogsApi = inject(CatalogsApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly expenseCategories = signal<CategoryResponseDto[]>([]);
  readonly paymentMethods = signal<PaymentMethodResponseDto[]>([]);
  readonly incomeCategories = signal<CategoryResponseDto[]>([]);
  readonly accountMembers = signal<AccountMemberResponseDto[]>([]);
  readonly activeAction = signal<QuickAction>('none');
  readonly successMessage = signal<string | null>(null);

  readonly accountId = computed(() => this.accountStore.selectedAccountId() ?? 0);
  readonly canCreateAccount = computed(() => this.accountStore.selectedAccount()?.status === 'ACTIVE');
  readonly hasExpenseCatalogs = computed(() => this.expenseCategories().length > 0 && this.paymentMethods().length > 0);
  readonly hasIncomeCatalogs = computed(() => this.incomeCategories().length > 0);
  readonly canCreateExpense = computed(() => this.canCreateAccount() && this.hasExpenseCatalogs());
  readonly canCreateIncome = computed(() => this.canCreateAccount() && this.hasIncomeCatalogs());
  readonly assignableParticipants = computed(() => {
    const activeMembers = this.accountMembers().filter((member) => member.status === 'ACTIVE');
    const account = this.accountStore.selectedAccount();
    const currentParticipantId = this.authStore.user()?.participantId;

    if (account?.currentUserRole === 'ACCOUNT_ADMIN') {
      return activeMembers;
    }

    return activeMembers.filter((member) => member.participantId === currentParticipantId);
  });

  readonly paymentStates: ExpensePaymentState[] = ['PENDING', 'PARTIAL', 'PAID'];

  readonly simpleExpenseForm = this.fb.group({
    categoryId: [0, [Validators.required, Validators.min(1)]],
    paymentMethodId: [0, [Validators.required, Validators.min(1)]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    expenseDate: [today(), [Validators.required]],
    paymentState: ['PAID' as ExpensePaymentState, [Validators.required]],
    participantId: ['']
  });

  readonly installmentExpenseForm = this.fb.group(
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

  readonly incomeForm = this.fb.group({
    categoryId: [0, [Validators.required, Validators.min(1)]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    incomeDate: [today(), [Validators.required]],
    participantId: ['']
  });

  ngOnInit(): void {
    this.loadExpenseCatalogs();
    this.loadIncomeCategories();
    this.loadMembers();
  }

  startCreateSimpleExpense(): void {
    if (!this.canCreateExpense()) {
      return;
    }

    this.successMessage.set(null);
    this.simpleExpenseForm.reset({
      categoryId: this.expenseCategories()[0]?.id ?? 0,
      paymentMethodId: this.paymentMethods()[0]?.id ?? 0,
      description: '',
      amount: 0,
      expenseDate: today(),
      paymentState: 'PAID',
      participantId: ''
    });
    this.activeAction.set('simple-expense');
  }

  startCreateInstallmentExpense(): void {
    if (!this.canCreateExpense()) {
      return;
    }

    this.successMessage.set(null);
    this.installmentExpenseForm.reset({
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
    this.activeAction.set('installment-expense');
  }

  startCreateIncome(): void {
    if (!this.canCreateIncome()) {
      return;
    }

    this.successMessage.set(null);
    this.incomeForm.reset({
      categoryId: this.incomeCategories()[0]?.id ?? 0,
      description: '',
      amount: 0,
      incomeDate: today(),
      participantId: ''
    });
    this.activeAction.set('income');
  }

  closeActiveForm(): void {
    this.activeAction.set('none');
  }

  saveSimpleExpense(): void {
    if (this.simpleExpenseForm.invalid || !this.canCreateExpense()) {
      this.simpleExpenseForm.markAllAsTouched();
      return;
    }

    const raw = this.simpleExpenseForm.getRawValue();
    this.successMessage.set(null);
    this.expensesStore
      .createSimpleExpense(this.accountId(), {
        categoryId: raw.categoryId,
        paymentMethodId: raw.paymentMethodId,
        description: raw.description,
        amount: raw.amount,
        expenseDate: raw.expenseDate,
        paymentState: raw.paymentState,
        participantId: this.selectedParticipantId(raw.participantId)
      })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.successMessage.set('Gasto creado.');
          this.closeActiveForm();
        },
        error: () => undefined
      });
  }

  saveInstallmentExpense(): void {
    if (this.installmentExpenseForm.invalid || !this.canCreateExpense()) {
      this.installmentExpenseForm.markAllAsTouched();
      return;
    }

    const raw = this.installmentExpenseForm.getRawValue();
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

    this.successMessage.set(null);
    this.expensesStore
      .createInstallmentExpense(this.accountId(), request)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.successMessage.set('Gasto en cuotas creado con deuda asociada.');
          this.closeActiveForm();
        },
        error: () => undefined
      });
  }

  saveIncome(): void {
    if (this.incomeForm.invalid || !this.canCreateIncome()) {
      this.incomeForm.markAllAsTouched();
      return;
    }

    const raw = this.incomeForm.getRawValue();
    this.successMessage.set(null);
    this.incomeStore
      .createIncome(this.accountId(), {
        categoryId: raw.categoryId,
        description: raw.description,
        amount: raw.amount,
        incomeDate: raw.incomeDate,
        participantId: this.selectedParticipantId(raw.participantId)
      })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.successMessage.set('Ingreso creado.');
          this.closeActiveForm();
        },
        error: () => undefined
      });
  }

  installmentFinancedTotal(): number {
    const raw = this.installmentExpenseForm.getRawValue();

    return Number(raw.installmentCount ?? 0) * Number(raw.installmentAmount ?? 0);
  }

  installmentFinancingDifference(): number {
    return Math.max(0, this.installmentFinancedTotal() - Number(this.installmentExpenseForm.controls.totalAmount.value ?? 0));
  }

  selectedInstallmentParticipantLabel(): string {
    const participantId = this.selectedParticipantId(this.installmentExpenseForm.controls.participantId.value);
    const member = this.assignableParticipants().find((item) => item.participantId === participantId);

    return member ? this.participantLabel(member) : 'el usuario logueado';
  }

  participantLabel(member: AccountMemberResponseDto): string {
    return member.displayName ? `${member.displayName} (${member.email})` : member.email;
  }

  expenseFriendlyError(code: string, fallback: string): string {
    const messages: Record<string, string> = {
      EXPENSE_CATEGORY_NOT_FOUND: 'La categoria no existe.',
      EXPENSE_CATEGORY_INACTIVE: 'La categoria esta inactiva.',
      EXPENSE_CATEGORY_INVALID_TYPE: 'La categoria debe ser de tipo EXPENSE.',
      EXPENSE_PAYMENT_METHOD_NOT_FOUND: 'El medio de pago no existe.',
      EXPENSE_PAYMENT_METHOD_INACTIVE: 'El medio de pago esta inactivo.',
      EXPENSE_AMOUNT_INVALID: 'El monto debe ser mayor que cero.',
      ACCOUNT_NOT_ACTIVE: 'La cuenta no permite modificar gastos.',
      INSTALLMENT_FINANCED_TOTAL_INVALID: 'El total financiado no puede ser menor al valor original del gasto.',
      VALIDATION_ERROR: 'Revisa los datos del formulario.'
    };

    return messages[code] ?? fallback;
  }

  incomeFriendlyError(code: string, fallback: string): string {
    const messages: Record<string, string> = {
      INCOME_CATEGORY_NOT_FOUND: 'La categoria no existe.',
      INCOME_CATEGORY_INACTIVE: 'La categoria esta inactiva.',
      INCOME_CATEGORY_INVALID_TYPE: 'La categoria debe ser de tipo INCOME.',
      INCOME_AMOUNT_INVALID: 'El monto debe ser mayor que cero.',
      ACCOUNT_NOT_ACTIVE: 'La cuenta no permite modificar ingresos.',
      VALIDATION_ERROR: 'Revisa los datos del formulario.'
    };

    return messages[code] ?? fallback;
  }

  private loadExpenseCatalogs(): void {
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

  private loadIncomeCategories(): void {
    this.catalogsApi
      .listCategories(this.accountId(), { type: 'INCOME', status: 'ACTIVE', size: 100, sort: 'name,asc' })
      .pipe(take(1))
      .subscribe({
        next: (page) => this.incomeCategories.set(page.content),
        error: () => this.incomeCategories.set([])
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

  private selectedParticipantId(value: string): number | null {
    const selectedParticipantId = value ? Number(value) : null;
    const currentParticipantId = this.authStore.user()?.participantId ?? null;

    if (!selectedParticipantId) {
      return currentParticipantId;
    }

    const canAssign = this.assignableParticipants().some((member) => member.participantId === selectedParticipantId);

    return canAssign ? selectedParticipantId : currentParticipantId;
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
