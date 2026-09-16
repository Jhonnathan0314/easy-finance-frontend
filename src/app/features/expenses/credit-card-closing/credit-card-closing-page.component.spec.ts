import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CatalogsApiService } from '../../../core/catalogs/catalogs-api.service';
import { CreditCardClosingStore } from '../../../core/expenses/credit-card-closing.store';
import { AccountStore } from '../../../core/state/account.store';
import { CreditCardClosingPreviewResponseDto, CreditCardClosingResultResponseDto, PaymentMethodResponseDto } from '../../../shared/models';
import { CreditCardClosingPageComponent } from './credit-card-closing-page.component';

describe('CreditCardClosingPageComponent', () => {
  const creditCard: PaymentMethodResponseDto = {
    id: 5,
    accountId: 1,
    name: 'Visa',
    description: null,
    type: 'CREDIT_CARD',
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: ''
  };
  const preview: CreditCardClosingPreviewResponseDto = {
    paymentMethodId: 5,
    from: '2026-05-01',
    to: '2026-05-31',
    totalAmount: 35000,
    totalCount: 2,
    byCategory: [{ categoryId: 2, categoryName: 'Groceries', amount: 35000, count: 2 }],
    expenses: []
  };
  const result: CreditCardClosingResultResponseDto = {
    paymentMethodId: 5,
    from: '2026-05-01',
    to: '2026-05-31',
    totalAmount: 35000,
    updatedCount: 2
  };

  function configure(
    options: {
      role?: 'ACCOUNT_ADMIN' | 'ACCOUNT_MEMBER';
      preview?: CreditCardClosingPreviewResponseDto | null;
      result?: CreditCardClosingResultResponseDto | null;
      error?: { code: string; message: string } | null;
    } = {}
  ) {
    const account = {
      id: 1,
      name: 'Casa',
      description: null,
      status: 'ACTIVE',
      currentUserRole: options.role ?? 'ACCOUNT_ADMIN',
      createdAt: '',
      updatedAt: ''
    };

    TestBed.configureTestingModule({
      imports: [CreditCardClosingPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: AccountStore,
          useValue: {
            selectedAccountId: signal(1),
            selectedAccount: signal(account)
          }
        },
        {
          provide: CatalogsApiService,
          useValue: {
            listPaymentMethods: jasmine.createSpy('listPaymentMethods').and.returnValue(
              of({ content: [creditCard], page: 0, size: 100, totalElements: 1, totalPages: 1 })
            )
          }
        },
        {
          provide: CreditCardClosingStore,
          useValue: {
            preview: signal(options.preview ?? null),
            result: signal(options.result ?? null),
            isLoadingPreview: signal(false),
            isConfirming: signal(false),
            error: signal(options.error ?? null),
            calculate: jasmine.createSpy('calculate').and.returnValue(of(preview)),
            confirm: jasmine.createSpy('confirm').and.returnValue(of(result)),
            reset: jasmine.createSpy('reset')
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(CreditCardClosingPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  function findButton(fixture: ComponentFixture<CreditCardClosingPageComponent>, label: string): HTMLButtonElement | undefined {
    const root = fixture.nativeElement as HTMLElement;

    return Array.from(root.querySelectorAll('button')).find((button) => button.textContent?.includes(label));
  }

  it('loads active credit cards on init', () => {
    const fixture = configure();
    const component = fixture.componentInstance;

    expect(component.creditCards()).toEqual([creditCard]);
  });

  it('shows a warning instead of the form for non-admin users', () => {
    const fixture = configure({ role: 'ACCOUNT_MEMBER' });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Solo un administrador de la cuenta puede hacer el cierre de tarjeta.');
    expect(fixture.componentInstance.filterForm).toBeTruthy();
  });

  it('does not calculate when the filter form is invalid', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    const store = TestBed.inject(CreditCardClosingStore);

    component.filterForm.patchValue({ paymentMethodId: 0, from: '', to: '' });
    component.calculate();

    expect(store.calculate).not.toHaveBeenCalled();
  });

  it('calculates the preview when the form is valid', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    const store = TestBed.inject(CreditCardClosingStore);

    component.filterForm.patchValue({ paymentMethodId: 5, from: '2026-05-01', to: '2026-05-31' });
    component.calculate();

    expect(store.calculate).toHaveBeenCalledWith(1, 5, '2026-05-01', '2026-05-31');
  });

  it('renders the category breakdown and total when a preview is available', () => {
    const fixture = configure({ preview });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Groceries');
    expect(findButton(fixture, 'Marcar como pagado')).toBeTruthy();
  });

  it('confirms the closing after user confirmation', () => {
    spyOn(globalThis, 'confirm').and.returnValue(true);
    const fixture = configure({ preview });
    const component = fixture.componentInstance;
    const store = TestBed.inject(CreditCardClosingStore);

    component.confirmClosing(preview.paymentMethodId, preview.from, preview.to);

    expect(store.confirm).toHaveBeenCalledWith(1, 5, '2026-05-01', '2026-05-31');
  });

  it('does not confirm the closing when the user cancels the dialog', () => {
    spyOn(globalThis, 'confirm').and.returnValue(false);
    const fixture = configure({ preview });
    const component = fixture.componentInstance;
    const store = TestBed.inject(CreditCardClosingStore);

    component.confirmClosing(preview.paymentMethodId, preview.from, preview.to);

    expect(store.confirm).not.toHaveBeenCalled();
  });

  it('shows the result summary after a successful closing', () => {
    const fixture = configure({ result });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('2');
    expect(findButton(fixture, 'Hacer otro cierre')).toBeTruthy();
  });
});
