import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthStore } from '../../core/auth/auth.store';
import { CatalogsApiService } from '../../core/catalogs/catalogs-api.service';
import { DebtsPersistedFilters, DebtsStore } from '../../core/debts/debts.store';
import { AccountStore } from '../../core/state/account.store';
import { AccountResponseDto, CategoryResponseDto, DebtPaymentResponseDto, DebtResponseDto, PaymentMethodResponseDto } from '../../shared/models';
import { DebtsPageComponent } from './debts-page.component';

describe('DebtsPageComponent', () => {
  const debt: DebtResponseDto = {
    id: 1,
    accountId: 1,
    participantId: 7,
    originExpenseId: null,
    sourceType: 'MANUAL',
    name: 'Laptop',
    description: null,
    totalAmount: 1200000,
    totalCurrency: 'COP',
    scheduledTotalAmount: 1440000,
    remainingAmount: 800000,
    remainingCurrency: 'COP',
    installmentCount: 12,
    installmentAmount: 100000,
    installmentCurrency: 'COP',
    startDate: '2026-05-12',
    endDate: null,
    state: 'ACTIVE',
    notes: null,
    createdAt: '',
    updatedAt: ''
  };
  const payment: DebtPaymentResponseDto = {
    id: 2,
    accountId: 1,
    debtId: 1,
    participantId: 7,
    paymentType: 'INSTALLMENT',
    amount: 100000,
    currency: 'COP',
    paymentDate: '2026-05-12',
    notes: null,
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: ''
  };
  const category: CategoryResponseDto = {
    id: 3,
    accountId: 1,
    name: 'Mercado',
    description: null,
    type: 'EXPENSE',
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: ''
  };
  const paymentMethod: PaymentMethodResponseDto = {
    id: 4,
    accountId: 1,
    name: 'Tarjeta',
    description: null,
    type: 'CREDIT_CARD',
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: ''
  };
  const defaultPersistedFilters: DebtsPersistedFilters = {
    debtFilters: {
      state: 'ACTIVE',
      sourceType: null,
      participantId: null,
      from: null,
      to: null,
      sort: 'startDate,desc'
    },
    paymentFilters: {
      from: null,
      to: null,
      paymentType: null,
      status: 'ACTIVE',
      sort: 'paymentDate,desc'
    }
  };

  function configure(
    options: {
      role?: 'ACCOUNT_ADMIN' | 'ACCOUNT_MEMBER';
      archived?: boolean;
      debts?: DebtResponseDto[];
      selectedDebt?: DebtResponseDto | null;
      persistedFilters?: DebtsPersistedFilters;
      createdExpenseId?: number | null;
      categories?: CategoryResponseDto[];
      paymentMethods?: PaymentMethodResponseDto[];
    } = {}
  ): ComponentFixture<DebtsPageComponent> {
    const account: AccountResponseDto = {
      id: 1,
      name: 'Casa',
      description: null,
      status: options.archived ? 'ARCHIVED' : 'ACTIVE',
      currentUserRole: options.role ?? 'ACCOUNT_ADMIN',
      createdAt: '',
      updatedAt: ''
    };
    const debts = options.debts ?? [debt];
    const selectedDebt = signal<DebtResponseDto | null>(options.selectedDebt ?? null);
    const payments = signal<DebtPaymentResponseDto[]>([]);

    TestBed.configureTestingModule({
      imports: [DebtsPageComponent],
      providers: [
        { provide: AuthStore, useValue: { user: signal({ participantId: 7 }) } },
        {
          provide: AccountStore,
          useValue: {
            selectedAccountId: signal(1),
            selectedAccount: signal(account),
            selectedAccountArchived: signal(options.archived ?? false)
          }
        },
        {
          provide: DebtsStore,
          useValue: {
            debts: signal(debts),
            selectedDebt,
            payments,
            isLoadingDebts: signal(false),
            isLoadingPayments: signal(false),
            isSaving: signal(false),
            error: signal(null),
            loadPersistedFilters: jasmine.createSpy('loadPersistedFilters').and.returnValue(options.persistedFilters ?? defaultPersistedFilters),
            clearPersistedFilters: jasmine.createSpy('clearPersistedFilters').and.returnValue(defaultPersistedFilters),
            loadDebts: jasmine.createSpy('loadDebts').and.returnValue(of(debts)),
            getDebt: jasmine.createSpy('getDebt').and.callFake((_accountId: number, debtId: number) => {
              const found = debts.find((item) => item.id === debtId) ?? debt;
              selectedDebt.set(found);
              return of(found);
            }),
            createManualDebt: jasmine.createSpy('createManualDebt').and.returnValue(of(debts)),
            cancelDebt: jasmine.createSpy('cancelDebt').and.returnValue(of([])),
            loadPayments: jasmine.createSpy('loadPayments').and.callFake(() => {
              payments.set([payment]);
              return of([payment]);
            }),
            registerPayment: jasmine
              .createSpy('registerPayment')
              .and.returnValue(of({ payment, debt: { ...debt, remainingAmount: 700000 }, createdExpenseId: options.createdExpenseId ?? null }))
          }
        },
        {
          provide: CatalogsApiService,
          useValue: {
            listCategories: jasmine
              .createSpy('listCategories')
              .and.returnValue(of({ content: options.categories ?? [category], page: 0, size: 100, totalElements: 1, totalPages: 1 })),
            listPaymentMethods: jasmine
              .createSpy('listPaymentMethods')
              .and.returnValue(of({ content: options.paymentMethods ?? [paymentMethod], page: 0, size: 100, totalElements: 1, totalPages: 1 }))
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(DebtsPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('validates required fields and minimum amount for manual debt', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startCreateDebt();
    component.manualDebtForm.patchValue({ name: '', totalAmount: 0, startDate: '' });

    expect(component.manualDebtForm.valid).toBeFalse();
    expect(component.manualDebtForm.controls.name.hasError('required')).toBeTrue();
    expect(component.manualDebtForm.controls.totalAmount.hasError('min')).toBeTrue();
  });

  it('requires installment fields as a pair for manual debt', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    component.startCreateDebt();
    component.manualDebtForm.patchValue({ installmentCount: 3, installmentAmount: null });

    expect(component.manualDebtForm.hasError('installmentsPairRequired')).toBeTrue();
  });

  it('validates payment amount does not exceed remaining balance', () => {
    const fixture = configure({ selectedDebt: debt });
    const component = fixture.componentInstance;

    component.startPayment(debt);
    component.paymentForm.patchValue({ amount: debt.remainingAmount + 1 });
    component.savePayment();

    expect(component.paymentFormError()).toContain('saldo pendiente');
  });

  it('shows debt capital and scheduled total in list and detail', () => {
    const fixture = configure({ selectedDebt: debt });

    expect(fixture.nativeElement.textContent).toContain('Capital pendiente');
    expect(fixture.nativeElement.textContent).toContain('Capital original');
    expect(fixture.nativeElement.textContent).toContain('Total programado');
  });

  it('shows estimated financing cost when scheduled total is greater than original capital', () => {
    const fixture = configure({ selectedDebt: debt });
    const component = fixture.componentInstance;

    expect(component.scheduledTotal(debt)).toBe(1440000);
    expect(component.financingCost(debt)).toBe(240000);
    expect(fixture.nativeElement.textContent).toContain('Intereses/costos estimados');
  });

  it('does not show estimated financing cost when scheduled total equals original capital', () => {
    const debtWithoutFinancingCost = { ...debt, scheduledTotalAmount: debt.totalAmount };
    const fixture = configure({ debts: [debtWithoutFinancingCost], selectedDebt: debtWithoutFinancingCost });

    expect(fixture.componentInstance.financingCost(debtWithoutFinancingCost)).toBe(0);
    expect(fixture.nativeElement.textContent).not.toContain('Intereses/costos estimados');
  });

  it('keeps current payment behavior when associated expense is disabled', () => {
    const fixture = configure({ selectedDebt: debt });
    const component = fixture.componentInstance;
    const store = TestBed.inject(DebtsStore) as jasmine.SpyObj<DebtsStore>;

    component.startPayment(debt);
    component.paymentForm.patchValue({ amount: 100000 });
    component.savePayment();

    expect(store.registerPayment).toHaveBeenCalledWith(
      1,
      1,
      jasmine.objectContaining({
        paymentType: 'INSTALLMENT',
        amount: 100000,
        createExpense: false
      })
    );
    expect(store.registerPayment.calls.mostRecent().args[2].categoryId).toBeUndefined();
    expect(store.registerPayment.calls.mostRecent().args[2].paymentMethodId).toBeUndefined();
    expect(store.registerPayment.calls.mostRecent().args[2].expenseDescription).toBeUndefined();
  });

  it('shows associated expense fields when checkbox is enabled', () => {
    const fixture = configure({ selectedDebt: debt });
    const component = fixture.componentInstance;

    component.startPayment(debt);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Categoria del gasto');

    component.paymentForm.patchValue({ createExpense: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Categoria del gasto');
    expect(fixture.nativeElement.textContent).toContain('Medio de pago del gasto');
    expect(fixture.nativeElement.textContent).toContain('Descripcion del gasto');
  });

  it('requires associated expense fields when checkbox is enabled', () => {
    const fixture = configure({ selectedDebt: debt });
    const component = fixture.componentInstance;

    component.startPayment(debt);
    component.paymentForm.patchValue({ amount: 100000, createExpense: true });

    expect(component.paymentForm.hasError('associatedExpenseRequired')).toBeTrue();
    expect(component.paymentForm.valid).toBeFalse();
  });

  it('sends associated expense fields when registering a debt payment', () => {
    const fixture = configure({ selectedDebt: debt });
    const component = fixture.componentInstance;
    const store = TestBed.inject(DebtsStore) as jasmine.SpyObj<DebtsStore>;

    component.startPayment(debt);
    component.paymentForm.patchValue({
      amount: 100000,
      createExpense: true,
      categoryId: 3,
      paymentMethodId: 4,
      expenseDescription: 'Pago deuda laptop'
    });
    component.savePayment();

    expect(store.registerPayment).toHaveBeenCalledWith(
      1,
      1,
      jasmine.objectContaining({
        createExpense: true,
        categoryId: 3,
        paymentMethodId: 4,
        expenseDescription: 'Pago deuda laptop'
      })
    );
  });

  it('shows success message when backend creates associated expense', () => {
    const fixture = configure({ selectedDebt: debt, createdExpenseId: 21 });
    const component = fixture.componentInstance;

    component.startPayment(debt);
    component.paymentForm.patchValue({
      amount: 100000,
      createExpense: true,
      categoryId: 3,
      paymentMethodId: 4,
      expenseDescription: 'Pago deuda laptop'
    });
    component.savePayment();

    expect(component.successMessage()).toBe('Pago registrado y gasto asociado creado.');
  });

  it('blocks payment actions for paid or cancelled debts', () => {
    const fixture = configure({ debts: [{ ...debt, state: 'PAID' }] });

    expect(fixture.nativeElement.textContent).not.toContain('Registrar pago');
  });

  it('blocks write actions when account is archived', () => {
    const fixture = configure({ archived: true });

    expect(fixture.nativeElement.textContent).toContain('La cuenta esta archivada');
    expect(fixture.nativeElement.textContent).not.toContain('Crear deuda manual');
    expect(fixture.nativeElement.textContent).not.toContain('Registrar pago');
  });

  it('shows cancel for active installment expense debts', () => {
    const fixture = configure({ debts: [{ ...debt, sourceType: 'INSTALLMENT_EXPENSE' }] });

    expect(fixture.nativeElement.textContent).toContain('Cancelar');
  });

  it('allows owner or admin to cancel manual debt', () => {
    const fixture = configure({ role: 'ACCOUNT_MEMBER' });

    expect(fixture.nativeElement.textContent).toContain('Cancelar');
  });

  it('hides cancel for member viewing another participant debt', () => {
    const fixture = configure({ role: 'ACCOUNT_MEMBER', debts: [{ ...debt, participantId: 99 }] });

    expect(fixture.nativeElement.textContent).not.toContain('Cancelar');
  });

  it('hides cancel for paid or cancelled debts', () => {
    const fixture = configure({ debts: [{ ...debt, state: 'PAID' }] });

    expect(fixture.nativeElement.textContent).not.toContain('Cancelar');
  });

  it('asks for confirmation before cancelling debt', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const fixture = configure();
    const store = TestBed.inject(DebtsStore) as jasmine.SpyObj<DebtsStore>;

    fixture.componentInstance.cancelDebt(debt);

    expect(window.confirm).toHaveBeenCalled();
    expect(store.cancelDebt).toHaveBeenCalledWith(1, 1);
  });

  it('warns before cancelling an installment expense debt', () => {
    const installmentDebt: DebtResponseDto = { ...debt, sourceType: 'INSTALLMENT_EXPENSE', originExpenseId: 55 };
    spyOn(window, 'confirm').and.returnValue(true);
    const fixture = configure({ debts: [installmentDebt] });
    const store = TestBed.inject(DebtsStore) as jasmine.SpyObj<DebtsStore>;

    fixture.componentInstance.cancelDebt(installmentDebt);

    expect(window.confirm).toHaveBeenCalledWith(
      'Esta deuda viene de un gasto en cuotas. Al cancelarla tambien se cancelara el gasto origen y sus impactos de presupuesto. Deseas continuar?'
    );
    expect(store.cancelDebt).toHaveBeenCalledWith(1, 1);
  });

  it('shows a friendly error when a derived debt already has payments', () => {
    const fixture = configure();

    expect(fixture.componentInstance.friendlyError('DERIVED_DEBT_HAS_PAYMENTS', '')).toBe(
      'No se puede cancelar esta deuda porque ya tiene pagos registrados.'
    );
  });

  it('refreshes selected debt after successful cancellation', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const fixture = configure({ selectedDebt: debt });
    const store = TestBed.inject(DebtsStore) as jasmine.SpyObj<DebtsStore>;

    fixture.componentInstance.cancelDebt(debt);

    expect(store.cancelDebt).toHaveBeenCalledWith(1, 1);
    expect(store.getDebt).toHaveBeenCalledWith(1, 1);
  });

  it('loads persisted filters on init', () => {
    const fixture = configure({
      persistedFilters: {
        debtFilters: {
          state: 'PAID',
          sourceType: 'MANUAL',
          participantId: 7,
          from: '2026-05-01',
          to: '2026-05-31',
          sort: 'startDate,desc'
        },
        paymentFilters: {
          from: '2026-05-10',
          to: '2026-05-20',
          paymentType: 'INSTALLMENT',
          status: 'CANCELLED',
          sort: 'paymentDate,desc'
        }
      }
    });
    const component = fixture.componentInstance;
    const store = TestBed.inject(DebtsStore) as jasmine.SpyObj<DebtsStore>;

    expect(store.loadPersistedFilters).toHaveBeenCalledWith(1);
    expect(component.debtFilterForm.getRawValue()).toEqual({
      state: 'PAID',
      sourceType: 'MANUAL',
      participantId: '7',
      from: '2026-05-01',
      to: '2026-05-31'
    });
    expect(component.paymentFilterForm.getRawValue()).toEqual({
      from: '2026-05-10',
      to: '2026-05-20',
      paymentType: 'INSTALLMENT',
      status: 'CANCELLED'
    });
  });

  it('persists and clears debt filters without losing selected debt', () => {
    const fixture = configure({ selectedDebt: debt });
    const component = fixture.componentInstance;
    const store = TestBed.inject(DebtsStore) as jasmine.SpyObj<DebtsStore>;

    store.loadDebts.calls.reset();
    component.debtFilterForm.patchValue({ state: 'PAID', sourceType: 'MANUAL', participantId: '7' });
    component.applyDebtFilters();

    expect(store.loadDebts).toHaveBeenCalledWith(
      1,
      jasmine.objectContaining({ state: 'PAID', sourceType: 'MANUAL', participantId: 7 }),
      { persist: true }
    );

    store.loadDebts.calls.reset();
    component.clearFilters();

    expect(store.clearPersistedFilters).toHaveBeenCalledWith(1);
    expect(store.loadDebts).toHaveBeenCalledWith(1);
    expect(store.loadPayments).toHaveBeenCalledWith(1, 1);
  });

  it('shows empty state when there are no debts', () => {
    const fixture = configure({ debts: [] });

    expect(fixture.nativeElement.textContent).toContain('Aun no tienes deudas');
  });
});
