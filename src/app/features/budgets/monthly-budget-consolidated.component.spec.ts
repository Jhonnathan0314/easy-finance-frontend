import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AccountsApiService } from '../../core/accounts/accounts-api.service';
import { BudgetsApiService } from '../../core/budgets/budgets-api.service';
import { CatalogsApiService } from '../../core/catalogs/catalogs-api.service';
import { AccountStore } from '../../core/state/account.store';
import {
  AccountMemberResponseDto,
  BudgetDetailResponseDto,
  BudgetResponseDto,
  CategoryResponseDto,
  SubBudgetResponseDto
} from '../../shared/models';
import { MonthlyBudgetConsolidatedComponent } from './monthly-budget-consolidated.component';

describe('MonthlyBudgetConsolidatedComponent', () => {
  const budget: BudgetResponseDto = {
    id: 1,
    accountId: 1,
    year: 2026,
    month: 5,
    name: 'Mayo',
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
  const member: AccountMemberResponseDto = {
    participantId: 9,
    email: 'member@example.com',
    displayName: 'Member',
    role: 'ACCOUNT_MEMBER',
    status: 'ACTIVE',
    joinedAt: ''
  };
  const baseSubBudget: SubBudgetResponseDto = {
    id: 2,
    accountId: 1,
    budgetId: 1,
    categoryId: 3,
    debtId: null,
    name: 'Mercado',
    plannedAmount: 500000,
    plannedCurrency: 'COP',
    spentAmount: 0,
    spentCurrency: 'COP',
    status: 'ACTIVE',
    sourceType: 'MANUAL',
    createdAt: '',
    updatedAt: ''
  };

  function configure(options: {
    subBudgets?: SubBudgetResponseDto[];
    categories?: CategoryResponseDto[];
    members?: AccountMemberResponseDto[];
    getBudgetDetailError?: boolean;
  } = {}): ComponentFixture<MonthlyBudgetConsolidatedComponent> {
    const detail: BudgetDetailResponseDto = { budget, subBudgets: options.subBudgets ?? [baseSubBudget], impacts: [] };

    TestBed.configureTestingModule({
      imports: [MonthlyBudgetConsolidatedComponent],
      providers: [
        { provide: AccountStore, useValue: { selectedAccountId: signal(1) } },
        {
          provide: BudgetsApiService,
          useValue: {
            getBudgetDetail: jasmine
              .createSpy('getBudgetDetail')
              .and.returnValue(options.getBudgetDetailError ? throwError(() => new Error('not found')) : of(detail))
          }
        },
        {
          provide: CatalogsApiService,
          useValue: {
            listCategories: jasmine
              .createSpy('listCategories')
              .and.returnValue(of({ content: options.categories ?? [category], page: 0, size: 100, totalElements: 1, totalPages: 1 }))
          }
        },
        {
          provide: AccountsApiService,
          useValue: {
            listMembers: jasmine.createSpy('listMembers').and.returnValue(of(options.members ?? [member]))
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(MonthlyBudgetConsolidatedComponent);
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('month', 5);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('groups active sub budgets into one table per participant and excludes inactive ones', () => {
    const fixture = configure({
      subBudgets: [
        baseSubBudget,
        { ...baseSubBudget, id: 5, name: 'Supermercado', plannedAmount: 200000 },
        { ...baseSubBudget, id: 6, name: 'Aseo del hogar', participantId: 9, plannedAmount: 150000 },
        { ...baseSubBudget, id: 7, name: 'Inactivo', plannedAmount: 900000, status: 'INACTIVE' }
      ]
    });

    expect(fixture.componentInstance.monthlyConsolidatedByParticipant()).toEqual([
      {
        participantId: null,
        participantLabel: 'Global',
        rows: [{ categoryId: 3, totalPlannedAmount: 700000, subBudgetCount: 2 }],
        totalPlannedAmount: 700000
      },
      {
        participantId: 9,
        participantLabel: 'Member (member@example.com)',
        rows: [{ categoryId: 3, totalPlannedAmount: 150000, subBudgetCount: 1 }],
        totalPlannedAmount: 150000
      }
    ]);
    expect(fixture.componentInstance.monthlyConsolidatedByCategory()).toEqual([
      { categoryId: 3, totalPlannedAmount: 850000, subBudgetCount: 3 }
    ]);
    expect(fixture.componentInstance.monthlyConsolidatedGrandTotal()).toBe(850000);
  });

  it('reloads when the year or month input changes', () => {
    const fixture = configure({ subBudgets: [baseSubBudget] });
    const api = TestBed.inject(BudgetsApiService) as jasmine.SpyObj<BudgetsApiService>;

    fixture.componentRef.setInput('month', 6);
    fixture.detectChanges();

    expect(api.getBudgetDetail).toHaveBeenCalledWith(1, 2026, 6);
  });

  it('shows a message when the month has no budget yet', () => {
    const fixture = configure({ getBudgetDetailError: true });

    expect(fixture.nativeElement.textContent).toContain('No hay presupuesto para este mes.');
  });

  it('emits close when the close button is clicked', () => {
    const fixture = configure();
    const closeSpy = jasmine.createSpy('close');
    fixture.componentInstance.close.subscribe(closeSpy);

    const closeButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (button) => (button as HTMLButtonElement).textContent?.includes('Cerrar')
    ) as HTMLButtonElement | undefined;
    closeButton?.click();

    expect(closeSpy).toHaveBeenCalled();
  });
});
