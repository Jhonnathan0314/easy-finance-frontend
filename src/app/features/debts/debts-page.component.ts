import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { take } from 'rxjs';

import { AuthStore } from '../../core/auth/auth.store';
import { DebtFilters, DebtsPersistedFilters, DebtsStore, PaymentFilters } from '../../core/debts/debts.store';
import { AccountStore } from '../../core/state/account.store';
import {
  CreateManualDebtRequest,
  DebtPaymentStatus,
  DebtPaymentType,
  DebtResponseDto,
  DebtSourceType,
  DebtState,
  RegisterDebtPaymentRequest
} from '../../shared/models';

@Component({
  selector: 'ef-debts-page',
  standalone: true,
  imports: [CurrencyPipe, ReactiveFormsModule],
  styleUrl: './debts-page.component.scss',
  template: `
    <section class="page-shell">
      <div class="page-header">
        <div>
          <h1 class="page-title">Deudas</h1>
          <p class="page-subtitle">Deudas manuales, derivadas y pagos de la cuenta {{ accountId() }}.</p>
        </div>
        @if (canCreateDebt()) {
          <button class="button" type="button" (click)="startCreateDebt()">Crear deuda manual</button>
        }
      </div>

      @if (accountStore.selectedAccountArchived()) {
        <div class="panel warning-panel">La cuenta esta archivada. Las acciones de escritura estan bloqueadas.</div>
      }

      @if (successMessage(); as message) {
        <div class="panel success-panel">{{ message }}</div>
      }

      @if (paymentFormError(); as message) {
        <div class="panel error-panel" role="alert">{{ message }}</div>
      }

      @if (debtsStore.error(); as error) {
        <div class="panel error-panel" role="alert">
          <strong>{{ error.code }}</strong>
          <span>{{ friendlyError(error.code, error.message) }}</span>
        </div>
      }

      <form class="filters" [formGroup]="debtFilterForm" (ngSubmit)="applyDebtFilters()">
        <label>
          <span>Estado</span>
          <select formControlName="state">
            @for (state of debtStates; track state) {
              <option [value]="state">{{ state }}</option>
            }
          </select>
        </label>
        <label>
          <span>Origen</span>
          <select formControlName="sourceType">
            <option value="">Todos</option>
            @for (sourceType of sourceTypes; track sourceType) {
              <option [value]="sourceType">{{ sourceType }}</option>
            }
          </select>
        </label>
        <label>
          <span>Participante</span>
          <input type="number" min="1" formControlName="participantId">
        </label>
        <label>
          <span>Desde</span>
          <input type="date" formControlName="from">
        </label>
        <label>
          <span>Hasta</span>
          <input type="date" formControlName="to">
        </label>
        <button type="submit">Filtrar</button>
        <button type="button" (click)="clearFilters()">Limpiar filtros</button>
      </form>

      @if (showDebtForm()) {
        <form class="panel form-grid debt-form" [formGroup]="manualDebtForm" (ngSubmit)="saveManualDebt()">
          <h2>Crear deuda manual</h2>
          <label class="field">
            <span>Nombre</span>
            <input type="text" formControlName="name">
          </label>
          <label class="field">
            <span>Monto total</span>
            <input type="number" min="0.01" step="0.01" formControlName="totalAmount">
          </label>
          <label class="field">
            <span>Fecha inicio</span>
            <input type="date" formControlName="startDate">
          </label>
          <label class="field">
            <span>Fecha vencimiento</span>
            <input type="date" formControlName="dueDate">
          </label>
          <label class="field">
            <span>Numero de cuotas</span>
            <input type="number" min="1" step="1" formControlName="installmentCount">
          </label>
          <label class="field">
            <span>Valor cuota</span>
            <input type="number" min="0.01" step="0.01" formControlName="installmentAmount">
          </label>
          <label class="field wide">
            <span>Descripcion</span>
            <textarea rows="3" formControlName="description"></textarea>
          </label>
          <label class="field wide">
            <span>Notas</span>
            <textarea rows="3" formControlName="notes"></textarea>
          </label>
          <p class="hint wide">Si registras numero de cuotas, tambien debes indicar valor de cuota. No se exige que coincidan con el total.</p>
          @if (manualDebtForm.hasError('installmentsPairRequired')) {
            <p class="form-error">Numero de cuotas y valor cuota deben completarse juntos.</p>
          }
          <div class="form-actions">
            <button class="button" type="submit" [disabled]="manualDebtForm.invalid || debtsStore.isSaving()">Guardar</button>
            <button type="button" (click)="cancelDebtForm()">Cancelar</button>
          </div>
        </form>
      }

      <div class="content-grid">
        <section>
          @if (debtsStore.isLoadingDebts()) {
            <div class="panel">Cargando deudas...</div>
          } @else if (!debtsStore.debts().length) {
            <div class="panel empty-state">
              <h2>Aun no tienes deudas</h2>
              <p>Tambien se crean deudas al registrar gastos en cuotas.</p>
              @if (canCreateDebt()) {
                <button class="button" type="button" (click)="startCreateDebt()">Crear deuda manual</button>
              }
            </div>
          } @else {
            <div class="debt-list">
              @for (debt of debtsStore.debts(); track debt.id) {
                <article class="debt-card" [class.selected]="selectedDebt()?.id === debt.id">
                  <div>
                    <h3>{{ debt.name }}</h3>
                    <p>{{ debt.startDate }} @if (debt.endDate) { <span>hasta {{ debt.endDate }}</span> }</p>
                  </div>
                  <strong>{{ debt.remainingAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}</strong>
                  <div class="progress">
                    <div class="progress-label">
                      <span>Pagado {{ paidPercent(debt) }}%</span>
                      <span>{{ debt.totalAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}</span>
                    </div>
                    <div class="progress-track">
                      <span [style.width.%]="paidPercent(debt)"></span>
                    </div>
                  </div>
                  <div class="badges">
                    <span>{{ debt.state }}</span>
                    <span>{{ debt.sourceType }}</span>
                    @if (debt.sourceType === 'INSTALLMENT_EXPENSE') {
                      <span>Desde gasto en cuotas</span>
                    }
                  </div>
                  <div class="actions">
                    <button type="button" (click)="selectDebt(debt)">Detalle</button>
                    @if (canRegisterPayment(debt)) {
                      <button type="button" (click)="startPayment(debt)">Registrar pago</button>
                    }
                    @if (canCancelDebt(debt)) {
                      <button type="button" (click)="cancelDebt(debt)">Cancelar</button>
                    }
                  </div>
                </article>
              }
            </div>
          }
        </section>

        @if (selectedDebt(); as debt) {
          <aside class="panel detail-panel">
            <div class="detail-heading">
              <div>
                <h2>{{ debt.name }}</h2>
                <p>{{ debt.description || 'Sin descripcion' }}</p>
              </div>
              <button type="button" (click)="closeDetail()">Cerrar</button>
            </div>

            @if (debt.sourceType === 'INSTALLMENT_EXPENSE') {
              <p class="hint">Creada desde gasto en cuotas.</p>
            }

            <dl class="summary-grid">
              <div>
                <dt>Total</dt>
                <dd>{{ debt.totalAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}</dd>
              </div>
              <div>
                <dt>Pendiente</dt>
                <dd>{{ debt.remainingAmount | currency: 'COP':'symbol-narrow':'1.0-0' }}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{{ debt.state }}</dd>
              </div>
              <div>
                <dt>Origen</dt>
                <dd>{{ debt.sourceType }}</dd>
              </div>
            </dl>

            @if (showPaymentForm()) {
              <form class="payment-form" [formGroup]="paymentForm" (ngSubmit)="savePayment()">
                <h3>Registrar pago</h3>
                <label class="field">
                  <span>Tipo</span>
                  <select formControlName="paymentType">
                    @for (type of paymentTypes; track type) {
                      <option [value]="type">{{ type }}</option>
                    }
                  </select>
                </label>
                <label class="field">
                  <span>Monto</span>
                  <input type="number" min="0.01" step="0.01" formControlName="amount">
                </label>
                <label class="field">
                  <span>Fecha pago</span>
                  <input type="date" formControlName="paymentDate">
                </label>
                <label class="field wide">
                  <span>Notas</span>
                  <textarea rows="3" formControlName="notes"></textarea>
                </label>
                <div class="form-actions">
                  <button class="button" type="submit" [disabled]="paymentForm.invalid || debtsStore.isSaving()">Guardar pago</button>
                  <button type="button" (click)="showPaymentForm.set(false)">Cancelar</button>
                </div>
              </form>
            } @else if (canRegisterPayment(debt)) {
              <button class="button" type="button" (click)="startPayment(debt)">Registrar pago</button>
            }

            <form class="filters compact" [formGroup]="paymentFilterForm" (ngSubmit)="applyPaymentFilters()">
              <label>
                <span>Desde</span>
                <input type="date" formControlName="from">
              </label>
              <label>
                <span>Hasta</span>
                <input type="date" formControlName="to">
              </label>
              <label>
                <span>Tipo</span>
                <select formControlName="paymentType">
                  <option value="">Todos</option>
                  @for (type of paymentTypes; track type) {
                    <option [value]="type">{{ type }}</option>
                  }
                </select>
              </label>
              <label>
                <span>Status</span>
                <select formControlName="status">
                  @for (status of paymentStatuses; track status) {
                    <option [value]="status">{{ status }}</option>
                  }
                </select>
              </label>
              <button type="submit">Filtrar pagos</button>
              <button type="button" (click)="clearFilters()">Limpiar filtros</button>
            </form>

            @if (debtsStore.isLoadingPayments()) {
              <p class="muted">Cargando pagos...</p>
            } @else if (!debtsStore.payments().length) {
              <p class="muted">Sin pagos registrados para esta deuda.</p>
            } @else {
              <div class="payment-list">
                @for (payment of debtsStore.payments(); track payment.id) {
                  <article class="payment-row">
                    <div>
                      <strong>{{ payment.paymentDate }}</strong>
                      <span>{{ payment.paymentType }} - {{ payment.status }}</span>
                    </div>
                    <span>{{ payment.amount | currency: 'COP':'symbol-narrow':'1.0-0' }}</span>
                  </article>
                }
              </div>
            }
          </aside>
        }
      </div>
    </section>
  `
})
export class DebtsPageComponent implements OnInit {
  protected readonly debtsStore = inject(DebtsStore);
  protected readonly accountStore = inject(AccountStore);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly accountId = computed(() => this.accountStore.selectedAccountId() ?? 0);
  readonly selectedDebt = computed(() => this.debtsStore.selectedDebt());
  readonly canCreateDebt = computed(() => this.accountStore.selectedAccount()?.status === 'ACTIVE');
  readonly showDebtForm = signal(false);
  readonly showPaymentForm = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly paymentFormError = signal<string | null>(null);

  readonly debtStates: DebtState[] = ['ACTIVE', 'PAID', 'CANCELLED'];
  readonly sourceTypes: DebtSourceType[] = ['MANUAL', 'INSTALLMENT_EXPENSE'];
  readonly paymentTypes: DebtPaymentType[] = ['INSTALLMENT', 'CAPITAL_PAYMENT'];
  readonly paymentStatuses: DebtPaymentStatus[] = ['ACTIVE', 'CANCELLED'];

  readonly debtFilterForm = this.fb.group({
    state: ['ACTIVE' as DebtState],
    sourceType: [''],
    participantId: [''],
    from: [''],
    to: ['']
  });

  readonly manualDebtForm = this.fb.group(
    {
      name: ['', [Validators.required, Validators.maxLength(150)]],
      description: ['', [Validators.maxLength(500)]],
      totalAmount: [0, [Validators.required, Validators.min(0.01)]],
      installmentCount: [null as number | null, [Validators.min(1)]],
      installmentAmount: [null as number | null, [Validators.min(0.01)]],
      startDate: [today(), [Validators.required]],
      dueDate: [''],
      notes: ['', [Validators.maxLength(1000)]]
    },
    { validators: installmentPairValidator }
  );

  readonly paymentFilterForm = this.fb.group({
    from: [''],
    to: [''],
    paymentType: [''],
    status: ['ACTIVE' as DebtPaymentStatus]
  });

  readonly paymentForm = this.fb.group({
    paymentType: ['INSTALLMENT' as DebtPaymentType, [Validators.required]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    paymentDate: [today(), [Validators.required]],
    notes: ['', [Validators.maxLength(1000)]]
  });

  ngOnInit(): void {
    this.patchFilterForms(this.debtsStore.loadPersistedFilters(this.accountId()));
    this.debtsStore.loadDebts(this.accountId()).pipe(take(1)).subscribe({ error: () => undefined });
  }

  applyDebtFilters(): void {
    const raw = this.debtFilterForm.getRawValue();

    this.debtsStore
      .loadDebts(this.accountId(), {
        state: raw.state,
        sourceType: raw.sourceType ? (raw.sourceType as DebtSourceType) : null,
        participantId: toNumberOrNull(raw.participantId),
        from: raw.from || null,
        to: raw.to || null
      },
      { persist: true })
      .pipe(take(1))
      .subscribe({ error: () => undefined });
  }

  clearFilters(): void {
    this.patchFilterForms(this.debtsStore.clearPersistedFilters(this.accountId()));
    this.debtsStore.loadDebts(this.accountId()).pipe(take(1)).subscribe({ error: () => undefined });

    const debt = this.selectedDebt();
    if (debt) {
      this.debtsStore.loadPayments(this.accountId(), debt.id).pipe(take(1)).subscribe({ error: () => undefined });
    }
  }

  startCreateDebt(): void {
    if (!this.canCreateDebt()) {
      return;
    }

    this.successMessage.set(null);
    this.manualDebtForm.reset({
      name: '',
      description: '',
      totalAmount: 0,
      installmentCount: null,
      installmentAmount: null,
      startDate: today(),
      dueDate: '',
      notes: ''
    });
    this.showDebtForm.set(true);
  }

  saveManualDebt(): void {
    if (this.manualDebtForm.invalid || !this.canCreateDebt()) {
      this.manualDebtForm.markAllAsTouched();
      return;
    }

    const raw = this.manualDebtForm.getRawValue();
    const request: CreateManualDebtRequest = {
      name: raw.name,
      description: raw.description || null,
      totalAmount: raw.totalAmount,
      installmentCount: raw.installmentCount,
      installmentAmount: raw.installmentAmount,
      startDate: raw.startDate,
      dueDate: raw.dueDate || null,
      notes: raw.notes || null
    };

    this.debtsStore
      .createManualDebt(this.accountId(), request)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.successMessage.set('Deuda manual creada.');
          this.showDebtForm.set(false);
        },
        error: () => undefined
      });
  }

  cancelDebtForm(): void {
    this.showDebtForm.set(false);
  }

  selectDebt(debt: DebtResponseDto): void {
    this.paymentFormError.set(null);
    this.showPaymentForm.set(false);
    this.debtsStore.getDebt(this.accountId(), debt.id).pipe(take(1)).subscribe({ error: () => undefined });
    this.debtsStore.loadPayments(this.accountId(), debt.id).pipe(take(1)).subscribe({ error: () => undefined });
  }

  closeDetail(): void {
    this.debtsStore.selectedDebt.set(null);
    this.debtsStore.payments.set([]);
    this.showPaymentForm.set(false);
  }

  startPayment(debt: DebtResponseDto): void {
    if (!this.canRegisterPayment(debt)) {
      return;
    }

    if (this.selectedDebt()?.id !== debt.id) {
      this.selectDebt(debt);
    }

    this.paymentFormError.set(null);
    this.paymentForm.reset({
      paymentType: 'INSTALLMENT',
      amount: 0,
      paymentDate: today(),
      notes: ''
    });
    this.showPaymentForm.set(true);
  }

  savePayment(): void {
    const debt = this.selectedDebt();

    if (!debt || this.paymentForm.invalid || !this.canRegisterPayment(debt)) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const raw = this.paymentForm.getRawValue();

    if (toCents(raw.amount) > toCents(debt.remainingAmount)) {
      this.paymentFormError.set('El pago no puede superar el saldo pendiente.');
      return;
    }

    const request: RegisterDebtPaymentRequest = {
      paymentType: raw.paymentType,
      amount: raw.amount,
      paymentDate: raw.paymentDate,
      notes: raw.notes || null
    };

    this.debtsStore
      .registerPayment(this.accountId(), debt.id, request)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.successMessage.set('Pago registrado.');
          this.paymentFormError.set(null);
          this.showPaymentForm.set(false);
        },
        error: () => undefined
      });
  }

  applyPaymentFilters(): void {
    const debt = this.selectedDebt();

    if (!debt) {
      return;
    }

    const raw = this.paymentFilterForm.getRawValue();
    this.debtsStore
      .loadPayments(this.accountId(), debt.id, {
        from: raw.from || null,
        to: raw.to || null,
        paymentType: raw.paymentType ? (raw.paymentType as DebtPaymentType) : null,
        status: raw.status
      },
      { persist: true })
      .pipe(take(1))
      .subscribe({ error: () => undefined });
  }

  cancelDebt(debt: DebtResponseDto): void {
    if (!this.canCancelDebt(debt) || !globalThis.confirm(`Cancelar deuda "${debt.name}"?`)) {
      return;
    }

    this.debtsStore
      .cancelDebt(this.accountId(), debt.id)
      .pipe(take(1))
      .subscribe({
        next: () => this.successMessage.set('Deuda cancelada.'),
        error: () => undefined
      });
  }

  canRegisterPayment(debt: DebtResponseDto): boolean {
    return this.accountStore.selectedAccount()?.status === 'ACTIVE' && debt.state === 'ACTIVE';
  }

  canCancelDebt(debt: DebtResponseDto): boolean {
    if (this.accountStore.selectedAccountArchived() || debt.sourceType !== 'MANUAL' || debt.state !== 'ACTIVE') {
      return false;
    }

    const account = this.accountStore.selectedAccount();
    const participantId = this.authStore.user()?.participantId;

    return account?.currentUserRole === 'ACCOUNT_ADMIN' || debt.participantId === participantId;
  }

  paidPercent(debt: DebtResponseDto): number {
    if (debt.totalAmount <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(((debt.totalAmount - debt.remainingAmount) / debt.totalAmount) * 100)));
  }

  friendlyError(code: string, fallback: string): string {
    const messages: Record<string, string> = {
      DEBT_PAYMENT_EXCEEDS_REMAINING_BALANCE: 'El pago supera el saldo pendiente.',
      DEBT_ALREADY_PAID: 'La deuda ya esta pagada.',
      DEBT_CANCELLED: 'La deuda esta cancelada.',
      DEBT_NOT_FOUND: 'La deuda no existe o no pertenece a esta cuenta.',
      DEBT_PAYMENT_AMOUNT_INVALID: 'El monto del pago debe ser mayor que cero.',
      VALIDATION_ERROR: 'Revisa los datos del formulario.'
    };

    return messages[code] ?? fallback;
  }

  private patchFilterForms(filters: DebtsPersistedFilters): void {
    this.patchDebtFilterForm(filters.debtFilters);
    this.patchPaymentFilterForm(filters.paymentFilters);
  }

  private patchDebtFilterForm(filters: Omit<DebtFilters, 'page' | 'size'>): void {
    this.debtFilterForm.patchValue({
      state: filters.state,
      sourceType: filters.sourceType ?? '',
      participantId: filters.participantId?.toString() ?? '',
      from: filters.from ?? '',
      to: filters.to ?? ''
    });
  }

  private patchPaymentFilterForm(filters: Omit<PaymentFilters, 'page' | 'size'>): void {
    this.paymentFilterForm.patchValue({
      from: filters.from ?? '',
      to: filters.to ?? '',
      paymentType: filters.paymentType ?? '',
      status: filters.status
    });
  }
}

export function installmentPairValidator(control: AbstractControl): ValidationErrors | null {
  const installmentCount = control.get('installmentCount')?.value;
  const installmentAmount = control.get('installmentAmount')?.value;
  const hasCount = installmentCount !== null && installmentCount !== undefined && installmentCount !== '';
  const hasAmount = installmentAmount !== null && installmentAmount !== undefined && installmentAmount !== '';

  return hasCount === hasAmount ? null : { installmentsPairRequired: true };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

function toNumberOrNull(value: string): number | null {
  return value ? Number(value) : null;
}
