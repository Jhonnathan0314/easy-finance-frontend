import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { CreditCardClosingPreviewResponseDto, CreditCardClosingResultResponseDto } from '../../shared/models';
import { CreditCardClosingApiService } from './credit-card-closing-api.service';
import { CreditCardClosingStore } from './credit-card-closing.store';

describe('CreditCardClosingStore', () => {
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

  let service: jasmine.SpyObj<CreditCardClosingApiService>;
  let store: CreditCardClosingStore;

  beforeEach(() => {
    service = jasmine.createSpyObj<CreditCardClosingApiService>('CreditCardClosingApiService', ['preview', 'confirm']);
    service.preview.and.returnValue(of(preview));
    service.confirm.and.returnValue(of(result));

    TestBed.configureTestingModule({
      providers: [CreditCardClosingStore, { provide: CreditCardClosingApiService, useValue: service }]
    });

    store = TestBed.inject(CreditCardClosingStore);
  });

  it('calculates a preview and stores it', () => {
    store.calculate(3, 5, '2026-05-01', '2026-05-31').subscribe();

    expect(store.preview()).toEqual(preview);
    expect(store.isLoadingPreview()).toBeFalse();
  });

  it('clears the preview on calculate error', (done) => {
    service.preview.and.returnValue(throwError(() => ({ error: { code: 'EXPENSE_PAYMENT_METHOD_NOT_FOUND', message: 'Not found' } })));

    store.calculate(3, 5, '2026-05-01', '2026-05-31').subscribe({
      error: () => {
        expect(store.preview()).toBeNull();
        expect(store.error()?.code).toBe('EXPENSE_PAYMENT_METHOD_NOT_FOUND');
        done();
      }
    });
  });

  it('confirms the closing and clears the preview', () => {
    store.preview.set(preview);

    store.confirm(3, 5, '2026-05-01', '2026-05-31').subscribe();

    expect(store.result()).toEqual(result);
    expect(store.preview()).toBeNull();
    expect(store.isConfirming()).toBeFalse();
  });

  it('resets preview, result and error', () => {
    store.preview.set(preview);
    store.result.set(result);

    store.reset();

    expect(store.preview()).toBeNull();
    expect(store.result()).toBeNull();
    expect(store.error()).toBeNull();
  });
});
