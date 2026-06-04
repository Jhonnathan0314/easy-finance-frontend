import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import {
  AnnualBudgetImportResponseDto,
  CategoryImportResponseDto,
  ExpenseImportBatchResponseDto,
  IncomeImportResponseDto,
  PaymentMethodImportResponseDto
} from '../../shared/models';
import { ImportsApiService } from './imports-api.service';
import { ImportsStore } from './imports.store';

describe('ImportsStore', () => {
  const file = new File(['excel'], 'expenses.xlsx');
  const batch: ExpenseImportBatchResponseDto = {
    batchId: 1,
    accountId: 10,
    participantId: 7,
    originalFilename: 'expenses.xlsx',
    status: 'PREVIEW',
    totalRows: 2,
    validRows: 1,
    invalidRows: 1,
    confirmedAt: null,
    rows: []
  };
  const incomeResult: IncomeImportResponseDto = {
    accountId: 10,
    participantId: 7,
    originalFilename: 'incomes.xlsx',
    totalRows: 2,
    createdCount: 2,
    invalidRows: 0,
    rows: []
  };
  const categoryResult: CategoryImportResponseDto = {
    accountId: 10,
    participantId: 7,
    originalFilename: 'categories.xlsx',
    totalRows: 2,
    createdCount: 2,
    invalidRows: 0,
    rows: []
  };
  const paymentMethodResult: PaymentMethodImportResponseDto = {
    accountId: 10,
    participantId: 7,
    originalFilename: 'payment-methods.xlsx',
    totalRows: 2,
    createdCount: 2,
    invalidRows: 0,
    rows: []
  };
  const annualBudgetResult: AnnualBudgetImportResponseDto = {
    accountId: 10,
    participantId: 7,
    originalFilename: 'annual-budgets.xlsx',
    totalRows: 2,
    createdBudgetsCount: 12,
    createdSubBudgetsCount: 24,
    invalidRows: 0,
    rows: []
  };

  let service: jasmine.SpyObj<ImportsApiService>;
  let store: ImportsStore;

  beforeEach(() => {
    service = jasmine.createSpyObj<ImportsApiService>('ImportsApiService', [
      'previewExpenseImport',
      'confirmExpenseImport',
      'getExpenseImportBatch',
      'downloadExpenseImportTemplate',
      'downloadIncomeImportTemplate',
      'previewIncomeImport',
      'importIncomes',
      'downloadCategoryImportTemplate',
      'previewCategoryImport',
      'importCategories',
      'downloadPaymentMethodImportTemplate',
      'previewPaymentMethodImport',
      'importPaymentMethods',
      'downloadAnnualBudgetImportTemplate',
      'previewAnnualBudgetImport',
      'importAnnualBudget'
    ]);
    service.previewExpenseImport.and.returnValue(of(batch));
    service.confirmExpenseImport.and.returnValue(of({ ...batch, status: 'CONFIRMED', confirmedAt: '2026-05-14T00:00:00Z' }));
    service.getExpenseImportBatch.and.returnValue(of(batch));
    service.downloadExpenseImportTemplate.and.returnValue(of(new Blob(['template'])));
    service.downloadIncomeImportTemplate.and.returnValue(of(new Blob(['template'])));
    service.previewIncomeImport.and.returnValue(of(incomeResult));
    service.importIncomes.and.returnValue(of(incomeResult));
    service.downloadCategoryImportTemplate.and.returnValue(of(new Blob(['template'])));
    service.previewCategoryImport.and.returnValue(of(categoryResult));
    service.importCategories.and.returnValue(of(categoryResult));
    service.downloadPaymentMethodImportTemplate.and.returnValue(of(new Blob(['template'])));
    service.previewPaymentMethodImport.and.returnValue(of(paymentMethodResult));
    service.importPaymentMethods.and.returnValue(of(paymentMethodResult));
    service.downloadAnnualBudgetImportTemplate.and.returnValue(of(new Blob(['template'])));
    service.previewAnnualBudgetImport.and.returnValue(of(annualBudgetResult));
    service.importAnnualBudget.and.returnValue(of(annualBudgetResult));

    TestBed.configureTestingModule({
      providers: [ImportsStore, { provide: ImportsApiService, useValue: service }]
    });

    store = TestBed.inject(ImportsStore);
  });

  it('previews and stores the current batch', (done) => {
    store.selectFile(file);

    store.preview(10).subscribe(() => {
      expect(service.previewExpenseImport).toHaveBeenCalledWith(10, file);
      expect(store.currentBatch()).toEqual(batch);
      done();
    });
  });

  it('confirms and updates the current batch', (done) => {
    store.selectFile(file);
    store.preview(10).subscribe(() => {
      store.confirm(10, 1).subscribe(() => {
        expect(service.confirmExpenseImport).toHaveBeenCalledWith(10, 1);
        expect(store.currentBatch()?.status).toBe('CONFIRMED');
        done();
      });
    });
  });

  it('clears stale batch and file when account changes', (done) => {
    store.selectFile(file);
    store.preview(10).subscribe(() => {
      expect(store.currentBatch()).not.toBeNull();

      store.getBatch(11, 2).subscribe(() => {
        expect(store.selectedFile()).toBeNull();
        expect(store.currentBatch()).toEqual(batch);
        done();
      });
    });
  });

  it('rejects confirm when confirmation is already in progress', (done) => {
    store.currentBatch.set(batch);
    store.isConfirming.set(true);

    store.confirm(10, 1).subscribe({
      error: () => {
        expect(service.confirmExpenseImport).not.toHaveBeenCalled();
        done();
      }
    });
  });

  it('downloads template without clearing batch or selected file', (done) => {
    const download$ = new Subject<Blob>();
    service.downloadExpenseImportTemplate.and.returnValue(download$.asObservable());
    store.selectFile(file);
    store.currentBatch.set(batch);
    let downloadedBlob: Blob | null = null;

    store.downloadTemplate(10).subscribe((blob) => (downloadedBlob = blob));

    expect(store.isDownloadingTemplate()).toBeTrue();
    download$.next(new Blob(['template']));
    download$.complete();

    expect(downloadedBlob).toEqual(jasmine.any(Blob));
    expect(service.downloadExpenseImportTemplate).toHaveBeenCalledWith(10);
    expect(store.currentBatch()).toEqual(batch);
    expect(store.selectedFile()).toBe(file);
    expect(store.isDownloadingTemplate()).toBeFalse();
    expect(store.templateDownloadError()).toBeNull();
    done();
  });

  it('clears file, batch, errors and loading state', () => {
    store.selectFile(file);
    store.currentBatch.set(batch);
    store.isPreviewing.set(true);
    store.isConfirming.set(true);
    store.isLoading.set(true);
    store.error.set({
      timestamp: '',
      status: 400,
      error: 'Bad Request',
      code: 'IMPORT_TEMPLATE_INVALID',
      message: 'Invalid',
      path: '',
      correlationId: null,
      details: []
    });
    store.templateDownloadError.set('No se pudo descargar la plantilla. Intenta nuevamente.');

    store.clear();

    expect(store.selectedFile()).toBeNull();
    expect(store.currentBatch()).toBeNull();
    expect(store.isPreviewing()).toBeFalse();
    expect(store.isConfirming()).toBeFalse();
    expect(store.isLoading()).toBeFalse();
    expect(store.error()).toBeNull();
    expect(store.templateDownloadError()).toBeNull();
  });

  it('sets template download error when download fails', (done) => {
    service.downloadExpenseImportTemplate.and.returnValue(throwError(() => new Error('network')));

    store.downloadTemplate(10).subscribe({
      error: () => {
        setTimeout(() => {
          expect(store.isDownloadingTemplate()).toBeFalse();
          expect(store.templateDownloadError()).toBe('No se pudo descargar la plantilla. Intenta nuevamente.');
          done();
        });
      }
    });
  });

  it('downloads income template', (done) => {
    store.downloadIncomeTemplate(10).subscribe((blob) => {
      expect(blob).toEqual(jasmine.any(Blob));
      expect(service.downloadIncomeImportTemplate).toHaveBeenCalledWith(10);
      expect(store.incomeTemplateDownloadError()).toBeNull();
      done();
    });
  });

  it('imports incomes and stores the result', (done) => {
    const incomeFile = new File(['excel'], 'incomes.xlsx');
    store.selectIncomeFile(incomeFile);

    store.importIncomeFile(10).subscribe(() => {
      expect(service.importIncomes).toHaveBeenCalledWith(10, incomeFile);
      expect(store.currentIncomeImportResult()).toEqual(incomeResult);
      setTimeout(() => {
        expect(store.isImportingIncome()).toBeFalse();
        done();
      });
    });
  });

  it('previews incomes and stores the stateless preview without importing', (done) => {
    const incomeFile = new File(['excel'], 'incomes.xlsx');
    store.selectIncomeFile(incomeFile);

    store.previewIncomeFile(10).subscribe(() => {
      expect(service.previewIncomeImport).toHaveBeenCalledWith(10, incomeFile);
      expect(service.importIncomes).not.toHaveBeenCalled();
      expect(store.currentIncomeImportPreview()).toEqual(incomeResult);
      setTimeout(() => {
        expect(store.isPreviewingIncome()).toBeFalse();
        done();
      });
    });
  });

  it('downloads category template', (done) => {
    store.downloadCategoryTemplate(10).subscribe((blob) => {
      expect(blob).toEqual(jasmine.any(Blob));
      expect(service.downloadCategoryImportTemplate).toHaveBeenCalledWith(10);
      expect(store.categoryTemplateDownloadError()).toBeNull();
      done();
    });
  });

  it('imports categories and stores the result', (done) => {
    const categoryFile = new File(['excel'], 'categories.xlsx');
    store.selectCategoryFile(categoryFile);

    store.importCategoryFile(10).subscribe(() => {
      expect(service.importCategories).toHaveBeenCalledWith(10, categoryFile);
      expect(store.currentCategoryImportResult()).toEqual(categoryResult);
      setTimeout(() => {
        expect(store.isImportingCategory()).toBeFalse();
        done();
      });
    });
  });

  it('previews categories and stores the stateless preview without importing', (done) => {
    const categoryFile = new File(['excel'], 'categories.xlsx');
    store.selectCategoryFile(categoryFile);

    store.previewCategoryFile(10).subscribe(() => {
      expect(service.previewCategoryImport).toHaveBeenCalledWith(10, categoryFile);
      expect(service.importCategories).not.toHaveBeenCalled();
      expect(store.currentCategoryImportPreview()).toEqual(categoryResult);
      setTimeout(() => {
        expect(store.isPreviewingCategory()).toBeFalse();
        done();
      });
    });
  });

  it('downloads payment method template', (done) => {
    store.downloadPaymentMethodTemplate(10).subscribe((blob) => {
      expect(blob).toEqual(jasmine.any(Blob));
      expect(service.downloadPaymentMethodImportTemplate).toHaveBeenCalledWith(10);
      expect(store.paymentMethodTemplateDownloadError()).toBeNull();
      done();
    });
  });

  it('imports payment methods and stores the result', (done) => {
    const paymentMethodFile = new File(['excel'], 'payment-methods.xlsx');
    store.selectPaymentMethodFile(paymentMethodFile);

    store.importPaymentMethodFile(10).subscribe(() => {
      expect(service.importPaymentMethods).toHaveBeenCalledWith(10, paymentMethodFile);
      expect(store.currentPaymentMethodImportResult()).toEqual(paymentMethodResult);
      setTimeout(() => {
        expect(store.isImportingPaymentMethod()).toBeFalse();
        done();
      });
    });
  });

  it('previews payment methods and stores the stateless preview without importing', (done) => {
    const paymentMethodFile = new File(['excel'], 'payment-methods.xlsx');
    store.selectPaymentMethodFile(paymentMethodFile);

    store.previewPaymentMethodFile(10).subscribe(() => {
      expect(service.previewPaymentMethodImport).toHaveBeenCalledWith(10, paymentMethodFile);
      expect(service.importPaymentMethods).not.toHaveBeenCalled();
      expect(store.currentPaymentMethodImportPreview()).toEqual(paymentMethodResult);
      setTimeout(() => {
        expect(store.isPreviewingPaymentMethod()).toBeFalse();
        done();
      });
    });
  });

  it('downloads annual budget template', (done) => {
    store.downloadAnnualBudgetTemplate(10).subscribe((blob) => {
      expect(blob).toEqual(jasmine.any(Blob));
      expect(service.downloadAnnualBudgetImportTemplate).toHaveBeenCalledWith(10);
      expect(store.annualBudgetTemplateDownloadError()).toBeNull();
      done();
    });
  });

  it('imports annual budget and stores the result', (done) => {
    const annualBudgetFile = new File(['excel'], 'annual-budgets.xlsx');
    store.selectAnnualBudgetFile(annualBudgetFile);

    store.importAnnualBudgetFile(10).subscribe(() => {
      expect(service.importAnnualBudget).toHaveBeenCalledWith(10, annualBudgetFile);
      expect(store.currentAnnualBudgetImportResult()).toEqual(annualBudgetResult);
      setTimeout(() => {
        expect(store.isImportingAnnualBudget()).toBeFalse();
        done();
      });
    });
  });

  it('previews annual budget and stores the stateless preview without importing', (done) => {
    const annualBudgetFile = new File(['excel'], 'annual-budgets.xlsx');
    store.selectAnnualBudgetFile(annualBudgetFile);

    store.previewAnnualBudgetFile(10).subscribe(() => {
      expect(service.previewAnnualBudgetImport).toHaveBeenCalledWith(10, annualBudgetFile);
      expect(service.importAnnualBudget).not.toHaveBeenCalled();
      expect(store.currentAnnualBudgetImportPreview()).toEqual(annualBudgetResult);
      setTimeout(() => {
        expect(store.isPreviewingAnnualBudget()).toBeFalse();
        done();
      });
    });
  });
});
