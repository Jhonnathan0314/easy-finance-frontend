import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AccountsApiService } from '../../core/accounts/accounts-api.service';
import { AuthStore } from '../../core/auth/auth.store';
import { CatalogsApiService } from '../../core/catalogs/catalogs-api.service';
import { ExpensesStore } from '../../core/expenses/expenses.store';
import { IncomeStore } from '../../core/income/income.store';
import { AccountStore } from '../../core/state/account.store';
import { AccountMemberResponseDto, CategoryResponseDto, PaymentMethodResponseDto } from '../../shared/models';
import { QuickActionsPageComponent } from './quick-actions-page.component';

describe('QuickActionsPageComponent', () => {
  const expenseCategory: CategoryResponseDto = {
    id: 1,
    accountId: 1,
    name: 'Food',
    description: null,
    type: 'EXPENSE',
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: ''
  };
  const incomeCategory: CategoryResponseDto = {
    id: 2,
    accountId: 1,
    name: 'Salary',
    description: null,
    type: 'INCOME',
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: ''
  };
  const paymentMethod: PaymentMethodResponseDto = {
    id: 3,
    accountId: 1,
    name: 'Cash',
    description: null,
    type: 'CASH',
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: ''
  };
  const member: AccountMemberResponseDto = {
    participantId: 7,
    email: 'owner@example.com',
    displayName: 'Owner',
    role: 'ACCOUNT_ADMIN',
    status: 'ACTIVE',
    joinedAt: ''
  };

  function configure(
    options: {
      role?: 'ACCOUNT_ADMIN' | 'ACCOUNT_MEMBER';
      archived?: boolean;
      hasExpenseCategories?: boolean;
      hasPaymentMethods?: boolean;
      hasIncomeCategories?: boolean;
    } = {}
  ) {
    const role = options.role ?? 'ACCOUNT_ADMIN';
    const archived = options.archived ?? false;
    const hasExpenseCategories = options.hasExpenseCategories ?? true;
    const hasPaymentMethods = options.hasPaymentMethods ?? true;
    const hasIncomeCategories = options.hasIncomeCategories ?? true;
    const account = {
      id: 1,
      name: 'Casa',
      description: null,
      status: archived ? 'ARCHIVED' : 'ACTIVE',
      currentUserRole: role,
      createdAt: '',
      updatedAt: ''
    };

    const createSimpleExpense = jasmine.createSpy('createSimpleExpense').and.returnValue(of([]));
    const createInstallmentExpense = jasmine.createSpy('createInstallmentExpense').and.returnValue(of([]));
    const createIncome = jasmine.createSpy('createIncome').and.returnValue(of([]));

    TestBed.configureTestingModule({
      imports: [QuickActionsPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { user: signal({ participantId: 7 }) } },
        {
          provide: AccountsApiService,
          useValue: {
            listMembers: jasmine.createSpy('listMembers').and.returnValue(of([member]))
          }
        },
        {
          provide: AccountStore,
          useValue: {
            selectedAccountId: signal(1),
            selectedAccount: signal(account),
            selectedAccountArchived: signal(archived)
          }
        },
        {
          provide: CatalogsApiService,
          useValue: {
            listCategories: jasmine.createSpy('listCategories').and.callFake((_accountId: number, filters: { type: string }) => {
              const isExpense = filters.type === 'EXPENSE';
              const content = isExpense ? (hasExpenseCategories ? [expenseCategory] : []) : hasIncomeCategories ? [incomeCategory] : [];
              return of({ content, page: 0, size: 100, totalElements: content.length, totalPages: content.length ? 1 : 0 });
            }),
            listPaymentMethods: jasmine.createSpy('listPaymentMethods').and.returnValue(
              of({
                content: hasPaymentMethods ? [paymentMethod] : [],
                page: 0,
                size: 100,
                totalElements: hasPaymentMethods ? 1 : 0,
                totalPages: hasPaymentMethods ? 1 : 0
              })
            )
          }
        },
        {
          provide: ExpensesStore,
          useValue: {
            isSaving: signal(false),
            error: signal(null),
            createSimpleExpense,
            createInstallmentExpense
          }
        },
        {
          provide: IncomeStore,
          useValue: {
            isSaving: signal(false),
            error: signal(null),
            createIncome
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(QuickActionsPageComponent);
    fixture.detectChanges();
    return { fixture, createSimpleExpense, createInstallmentExpense, createIncome };
  }

  afterEach(() => TestBed.resetTestingModule());

  function findButton(fixture: ComponentFixture<QuickActionsPageComponent>, label: string): HTMLButtonElement | undefined {
    const root = fixture.nativeElement as HTMLElement;

    return Array.from(root.querySelectorAll('button')).find((button) => button.textContent?.trim() === label);
  }

  it('loads expense catalogs, income categories and members on init', () => {
    const { fixture } = configure();
    const component = fixture.componentInstance;

    expect(component.expenseCategories()).toEqual([expenseCategory]);
    expect(component.paymentMethods()).toEqual([paymentMethod]);
    expect(component.incomeCategories()).toEqual([incomeCategory]);
    expect(component.accountMembers()).toEqual([member]);
  });

  it('disables expense buttons when expense catalogs are incomplete', () => {
    const { fixture } = configure({ hasPaymentMethods: false });

    expect(findButton(fixture, 'Gasto simple')?.disabled).toBeTrue();
    expect(findButton(fixture, 'Gasto en cuotas')?.disabled).toBeTrue();
    expect(findButton(fixture, 'Crear ingreso')?.disabled).toBeFalse();
  });

  it('disables the income button when there are no income categories', () => {
    const { fixture } = configure({ hasIncomeCategories: false });

    expect(findButton(fixture, 'Crear ingreso')?.disabled).toBeTrue();
    expect(findButton(fixture, 'Gasto simple')?.disabled).toBeFalse();
  });

  it('opens the simple expense form and creates a simple expense with the same payload shape as Gastos', () => {
    const { fixture, createSimpleExpense } = configure();
    const component = fixture.componentInstance;

    findButton(fixture, 'Gasto simple')?.click();
    fixture.detectChanges();
    expect(component.activeAction()).toBe('simple-expense');

    component.simpleExpenseForm.patchValue({
      categoryId: expenseCategory.id,
      paymentMethodId: paymentMethod.id,
      description: 'Lunch',
      amount: 12000,
      expenseDate: '2026-05-12',
      paymentState: 'PAID'
    });
    component.saveSimpleExpense();

    expect(createSimpleExpense).toHaveBeenCalledWith(1, {
      categoryId: expenseCategory.id,
      paymentMethodId: paymentMethod.id,
      description: 'Lunch',
      amount: 12000,
      expenseDate: '2026-05-12',
      paymentState: 'PAID',
      participantId: 7
    });
    expect(component.activeAction()).toBe('none');
    expect(component.successMessage()).toBe('Gasto creado.');
  });

  it('opens the installment expense form and creates an installment expense', () => {
    const { fixture, createInstallmentExpense } = configure();
    const component = fixture.componentInstance;

    findButton(fixture, 'Gasto en cuotas')?.click();
    fixture.detectChanges();
    expect(component.activeAction()).toBe('installment-expense');

    component.installmentExpenseForm.patchValue({
      categoryId: expenseCategory.id,
      paymentMethodId: paymentMethod.id,
      description: 'Laptop',
      totalAmount: 1200000,
      expenseDate: '2026-05-11',
      installmentCount: 6,
      installmentAmount: 200000,
      firstInstallmentDate: '2026-06-01'
    });
    component.saveInstallmentExpense();

    expect(createInstallmentExpense).toHaveBeenCalledWith(1, jasmine.objectContaining({
      categoryId: expenseCategory.id,
      paymentMethodId: paymentMethod.id,
      description: 'Laptop',
      totalAmount: 1200000,
      installmentCount: 6,
      installmentAmount: 200000
    }));
    expect(component.activeAction()).toBe('none');
  });

  it('opens the income form and creates an income with the same payload shape as Ingresos', () => {
    const { fixture, createIncome } = configure();
    const component = fixture.componentInstance;

    findButton(fixture, 'Crear ingreso')?.click();
    fixture.detectChanges();
    expect(component.activeAction()).toBe('income');

    component.incomeForm.patchValue({
      categoryId: incomeCategory.id,
      description: 'Salary',
      amount: 2500000,
      incomeDate: '2026-05-10'
    });
    component.saveIncome();

    expect(createIncome).toHaveBeenCalledWith(1, {
      categoryId: incomeCategory.id,
      description: 'Salary',
      amount: 2500000,
      incomeDate: '2026-05-10',
      participantId: 7
    });
    expect(component.activeAction()).toBe('none');
    expect(component.successMessage()).toBe('Ingreso creado.');
  });

  it('cancel closes the active form without saving', () => {
    const { fixture, createSimpleExpense } = configure();
    const component = fixture.componentInstance;

    findButton(fixture, 'Gasto simple')?.click();
    fixture.detectChanges();

    findButton(fixture, 'Cancelar')?.click();
    fixture.detectChanges();

    expect(component.activeAction()).toBe('none');
    expect(createSimpleExpense).not.toHaveBeenCalled();
  });
});
