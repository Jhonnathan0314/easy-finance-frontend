import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ImportsStore } from '../../core/imports/imports.store';
import { AccountStore } from '../../core/state/account.store';
import {
  AccountResponseDto,
  AnnualBudgetImportResponseDto,
  ApiErrorResponse,
  CategoryImportResponseDto,
  ExpenseImportBatchResponseDto,
  IncomeImportResponseDto,
  PaymentMethodImportResponseDto
} from '../../shared/models';
import {
  ANNUAL_BUDGET_IMPORT_TEMPLATE_FILENAME,
  CATEGORY_IMPORT_TEMPLATE_FILENAME,
  EXPENSE_IMPORT_TEMPLATE_FILENAME,
  INCOME_IMPORT_TEMPLATE_FILENAME,
  PAYMENT_METHOD_IMPORT_TEMPLATE_FILENAME,
  ImportsPageComponent,
  MAX_IMPORT_FILE_SIZE_BYTES
} from './imports-page.component';

describe('ImportsPageComponent', () => {
  const account: AccountResponseDto = {
    id: 1,
    name: 'Casa',
    description: null,
    status: 'ACTIVE',
    currentUserRole: 'ACCOUNT_MEMBER',
    createdAt: '',
    updatedAt: ''
  };
  const previewBatch: ExpenseImportBatchResponseDto = {
    batchId: 1,
    accountId: 1,
    participantId: 7,
    originalFilename: 'expenses.xlsx',
    status: 'PREVIEW',
    totalRows: 2,
    validRows: 1,
    invalidRows: 1,
    confirmedAt: null,
    rows: [
      {
        id: 1,
        rowNumber: 2,
        expenseDate: '2026-05-12',
        description: 'Lunch',
        amount: 12000,
        currency: 'COP',
        participantId: 7,
        participantLabel: 'Jonatan',
        categoryName: 'Food',
        categoryId: 3,
        paymentMethodName: 'Cash',
        paymentMethodId: 4,
        paymentState: 'PAID',
        appliesDebtPayment: false,
        debtId: null,
        debtLabel: null,
        debtPaymentType: null,
        debtPaymentNotes: null,
        valid: true,
        errors: [],
        createdExpenseId: null,
        createdDebtPaymentId: null
      },
      {
        id: 2,
        rowNumber: 3,
        expenseDate: null,
        description: 'Bad row',
        amount: null,
        currency: null,
        participantId: 9,
        participantLabel: 'Mary',
        categoryName: 'Missing',
        categoryId: null,
        paymentMethodName: null,
        paymentMethodId: null,
        paymentState: null,
        appliesDebtPayment: false,
        debtId: null,
        debtLabel: null,
        debtPaymentType: null,
        debtPaymentNotes: null,
        valid: false,
        errors: [{ column: 'Categoria', code: 'CATEGORY_NOT_FOUND', message: 'Categoria no existe.' }],
        createdExpenseId: null,
        createdDebtPaymentId: null
      }
    ]
  };
  const debtPaymentBatch: ExpenseImportBatchResponseDto = {
    ...previewBatch,
    totalRows: 1,
    validRows: 1,
    invalidRows: 0,
    rows: [
      {
        ...previewBatch.rows[0],
        appliesDebtPayment: true,
        debtId: 9,
        debtLabel: 'Credito cocina',
        debtPaymentType: 'INSTALLMENT',
        debtPaymentNotes: 'Cuota mayo',
        errors: []
      }
    ]
  };

  function configure(
    options: {
      archived?: boolean;
      batch?: ExpenseImportBatchResponseDto | null;
      validRows?: number;
      confirming?: boolean;
      downloadingTemplate?: boolean;
      templateDownloadError?: string | null;
      incomeTemplateDownloadError?: string | null;
      categoryTemplateDownloadError?: string | null;
      paymentMethodTemplateDownloadError?: string | null;
      annualBudgetTemplateDownloadError?: string | null;
      selectedFile?: File | null;
      selectedIncomeFile?: File | null;
      selectedCategoryFile?: File | null;
      selectedPaymentMethodFile?: File | null;
      selectedAnnualBudgetFile?: File | null;
      incomeResult?: {
        accountId: number;
        participantId: number;
        originalFilename: string;
        totalRows: number;
        createdCount: number;
        invalidRows: number;
        rows: Array<{
          rowNumber: number;
          incomeDate?: string | null;
          description?: string | null;
          amount?: number | null;
          categoryName?: string | null;
          categoryId?: number | null;
          valid: boolean;
          errors: Array<{ column: string; code: string; message: string }>;
          createdIncomeId?: number | null;
        }>;
      } | null;
      incomePreview?: IncomeImportResponseDto | null;
      categoryPreview?: CategoryImportResponseDto | null;
      paymentMethodPreview?: PaymentMethodImportResponseDto | null;
      annualBudgetPreview?: AnnualBudgetImportResponseDto | null;
      importingIncome?: boolean;
      importingCategory?: boolean;
      importingPaymentMethod?: boolean;
      importingAnnualBudget?: boolean;
    } = {}
  ): ComponentFixture<ImportsPageComponent> {
    const currentBatch = signal<ExpenseImportBatchResponseDto | null>(
      Object.prototype.hasOwnProperty.call(options, 'batch') ? options.batch ?? null : previewBatch
    );
    const selectedFile = signal<File | null>(
      Object.prototype.hasOwnProperty.call(options, 'selectedFile') ? options.selectedFile ?? null : new File(['excel'], 'expenses.xlsx')
    );
    const selectedIncomeFile = signal<File | null>(
      Object.prototype.hasOwnProperty.call(options, 'selectedIncomeFile')
        ? options.selectedIncomeFile ?? null
        : new File(['excel'], 'incomes.xlsx')
    );
    const selectedCategoryFile = signal<File | null>(
      Object.prototype.hasOwnProperty.call(options, 'selectedCategoryFile')
        ? options.selectedCategoryFile ?? null
        : new File(['excel'], 'categories.xlsx')
    );
    const selectedPaymentMethodFile = signal<File | null>(
      Object.prototype.hasOwnProperty.call(options, 'selectedPaymentMethodFile')
        ? options.selectedPaymentMethodFile ?? null
        : new File(['excel'], 'payment-methods.xlsx')
    );
    const selectedAnnualBudgetFile = signal<File | null>(
      Object.prototype.hasOwnProperty.call(options, 'selectedAnnualBudgetFile')
        ? options.selectedAnnualBudgetFile ?? null
        : new File(['excel'], 'annual-budgets.xlsx')
    );
    const incomeImportResult = signal(
      Object.prototype.hasOwnProperty.call(options, 'incomeResult') ? options.incomeResult ?? null : null
    );
    const incomeImportPreview = signal<IncomeImportResponseDto | null>(
      Object.prototype.hasOwnProperty.call(options, 'incomePreview') ? options.incomePreview ?? null : null
    );
    const categoryImportPreview = signal<CategoryImportResponseDto | null>(
      Object.prototype.hasOwnProperty.call(options, 'categoryPreview') ? options.categoryPreview ?? null : null
    );
    const paymentMethodImportPreview = signal<PaymentMethodImportResponseDto | null>(
      Object.prototype.hasOwnProperty.call(options, 'paymentMethodPreview') ? options.paymentMethodPreview ?? null : null
    );
    const annualBudgetImportPreview = signal<AnnualBudgetImportResponseDto | null>(
      Object.prototype.hasOwnProperty.call(options, 'annualBudgetPreview') ? options.annualBudgetPreview ?? null : null
    );
    const paymentMethodImportResult = signal(null);
    const annualBudgetImportResult = signal(null);
    const accountState = { ...account, status: options.archived ? 'ARCHIVED' : 'ACTIVE' };
    const storeError = signal<ApiErrorResponse | null>(null);
    const incomeStoreError = signal<ApiErrorResponse | null>(null);
    const templateDownloadError = signal(options.templateDownloadError ?? null);
    const incomeTemplateDownloadError = signal(options.incomeTemplateDownloadError ?? null);
    const categoryTemplateDownloadError = signal(options.categoryTemplateDownloadError ?? null);
    const paymentMethodTemplateDownloadError = signal(options.paymentMethodTemplateDownloadError ?? null);
    const annualBudgetTemplateDownloadError = signal(options.annualBudgetTemplateDownloadError ?? null);

    if (options.validRows !== undefined && currentBatch()) {
      currentBatch.set({ ...currentBatch()!, validRows: options.validRows });
    }

    TestBed.configureTestingModule({
      imports: [ImportsPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: AccountStore,
          useValue: {
            selectedAccountId: signal(1),
            selectedAccount: signal(accountState),
            selectedAccountArchived: signal(options.archived ?? false)
          }
        },
        {
          provide: ImportsStore,
          useValue: {
            currentBatch,
            isPreviewing: signal(false),
            isConfirming: signal(options.confirming ?? false),
            isLoading: signal(false),
            isDownloadingTemplate: signal(options.downloadingTemplate ?? false),
            isImportingIncome: signal(options.importingIncome ?? false),
            isImportingCategory: signal(options.importingCategory ?? false),
            isImportingPaymentMethod: signal(options.importingPaymentMethod ?? false),
            isImportingAnnualBudget: signal(options.importingAnnualBudget ?? false),
            isPreviewingIncome: signal(false),
            isPreviewingCategory: signal(false),
            isPreviewingPaymentMethod: signal(false),
            isPreviewingAnnualBudget: signal(false),
            error: storeError,
            incomeError: incomeStoreError,
            categoryError: signal<ApiErrorResponse | null>(null),
            paymentMethodError: signal<ApiErrorResponse | null>(null),
            annualBudgetError: signal<ApiErrorResponse | null>(null),
            templateDownloadError,
            incomeTemplateDownloadError,
            categoryTemplateDownloadError,
            paymentMethodTemplateDownloadError,
            annualBudgetTemplateDownloadError,
            selectedFile,
            selectedIncomeFile,
            selectedCategoryFile,
            selectedPaymentMethodFile,
            selectedAnnualBudgetFile,
            currentIncomeImportPreview: incomeImportPreview,
            currentCategoryImportPreview: categoryImportPreview,
            currentPaymentMethodImportPreview: paymentMethodImportPreview,
            currentAnnualBudgetImportPreview: annualBudgetImportPreview,
            currentIncomeImportResult: incomeImportResult,
            currentCategoryImportResult: signal(null),
            currentPaymentMethodImportResult: paymentMethodImportResult,
            currentAnnualBudgetImportResult: annualBudgetImportResult,
            selectFile: jasmine.createSpy('selectFile').and.callFake((file: File) => selectedFile.set(file)),
            clearFile: jasmine.createSpy('clearFile').and.callFake(() => selectedFile.set(null)),
            selectIncomeFile: jasmine.createSpy('selectIncomeFile').and.callFake((file: File) => selectedIncomeFile.set(file)),
            clearIncomeFile: jasmine.createSpy('clearIncomeFile').and.callFake(() => selectedIncomeFile.set(null)),
            selectCategoryFile: jasmine.createSpy('selectCategoryFile').and.callFake((file: File) => selectedCategoryFile.set(file)),
            clearCategoryFile: jasmine.createSpy('clearCategoryFile').and.callFake(() => selectedCategoryFile.set(null)),
            selectPaymentMethodFile: jasmine
              .createSpy('selectPaymentMethodFile')
              .and.callFake((file: File) => selectedPaymentMethodFile.set(file)),
            clearPaymentMethodFile: jasmine.createSpy('clearPaymentMethodFile').and.callFake(() => selectedPaymentMethodFile.set(null)),
            selectAnnualBudgetFile: jasmine
              .createSpy('selectAnnualBudgetFile')
              .and.callFake((file: File) => selectedAnnualBudgetFile.set(file)),
            clearAnnualBudgetFile: jasmine.createSpy('clearAnnualBudgetFile').and.callFake(() => selectedAnnualBudgetFile.set(null)),
            preview: jasmine.createSpy('preview').and.returnValue(of(currentBatch())),
            confirm: jasmine.createSpy('confirm').and.returnValue(of({ ...previewBatch, status: 'CONFIRMED' })),
            downloadTemplate: jasmine.createSpy('downloadTemplate').and.returnValue(of(new Blob(['template']))),
            downloadIncomeTemplate: jasmine
              .createSpy('downloadIncomeTemplate')
              .and.returnValue(of(new Blob(['template']))),
            importIncomeFile: jasmine.createSpy('importIncomeFile').and.returnValue(
              of({
                accountId: 1,
                participantId: 7,
                originalFilename: 'incomes.xlsx',
                totalRows: 1,
                createdCount: 1,
                invalidRows: 0,
                rows: [{ rowNumber: 2, description: 'Nomina', amount: 100, valid: true, errors: [], createdIncomeId: 8 }]
              })
            ),
            previewIncomeFile: jasmine.createSpy('previewIncomeFile').and.returnValue(
              of({
                accountId: 1,
                participantId: 7,
                originalFilename: 'incomes.xlsx',
                totalRows: 1,
                createdCount: 0,
                invalidRows: 0,
                rows: [{ rowNumber: 2, description: 'Nomina', amount: 100, valid: true, errors: [], createdIncomeId: null }]
              })
            ),
            downloadCategoryTemplate: jasmine
              .createSpy('downloadCategoryTemplate')
              .and.returnValue(of(new Blob(['template']))),
            importCategoryFile: jasmine.createSpy('importCategoryFile').and.returnValue(
              of({
                accountId: 1,
                participantId: 7,
                originalFilename: 'categories.xlsx',
                totalRows: 1,
                createdCount: 1,
                invalidRows: 0,
                rows: [{ rowNumber: 2, name: 'Mercado', type: 'EXPENSE', valid: true, errors: [], createdCategoryId: 12 }]
              })
            ),
            previewCategoryFile: jasmine.createSpy('previewCategoryFile').and.returnValue(
              of({
                accountId: 1,
                participantId: 7,
                originalFilename: 'categories.xlsx',
                totalRows: 1,
                createdCount: 0,
                invalidRows: 0,
                rows: [{ rowNumber: 2, name: 'Mercado', type: 'EXPENSE', valid: true, errors: [], createdCategoryId: null }]
              })
            ),
            downloadPaymentMethodTemplate: jasmine
              .createSpy('downloadPaymentMethodTemplate')
              .and.returnValue(of(new Blob(['template']))),
            importPaymentMethodFile: jasmine.createSpy('importPaymentMethodFile').and.returnValue(
              of({
                accountId: 1,
                participantId: 7,
                originalFilename: 'payment-methods.xlsx',
                totalRows: 1,
                createdCount: 1,
                invalidRows: 0,
                rows: [{ rowNumber: 2, name: 'Cuenta principal', type: 'BANK_ACCOUNT', valid: true, errors: [], createdPaymentMethodId: 22 }]
              })
            ),
            previewPaymentMethodFile: jasmine.createSpy('previewPaymentMethodFile').and.returnValue(
              of({
                accountId: 1,
                participantId: 7,
                originalFilename: 'payment-methods.xlsx',
                totalRows: 1,
                createdCount: 0,
                invalidRows: 0,
                rows: [{ rowNumber: 2, name: 'Cuenta principal', type: 'BANK_ACCOUNT', valid: true, errors: [] }]
              })
            ),
            downloadAnnualBudgetTemplate: jasmine
              .createSpy('downloadAnnualBudgetTemplate')
              .and.returnValue(of(new Blob(['template']))),
            importAnnualBudgetFile: jasmine.createSpy('importAnnualBudgetFile').and.returnValue(
              of({
                accountId: 1,
                participantId: 7,
                originalFilename: 'annual-budgets.xlsx',
                totalRows: 2,
                createdBudgetsCount: 12,
                createdSubBudgetsCount: 24,
                invalidRows: 0,
                rows: [{ rowNumber: 2, year: 2026, month: 'Todos', plannedAmount: 100000, valid: true, errors: [] }]
              })
            ),
            previewAnnualBudgetFile: jasmine.createSpy('previewAnnualBudgetFile').and.returnValue(
              of({
                accountId: 1,
                participantId: 7,
                originalFilename: 'annual-budgets.xlsx',
                totalRows: 1,
                createdBudgetsCount: 0,
                createdSubBudgetsCount: 0,
                invalidRows: 0,
                rows: [{ rowNumber: 2, year: 2026, month: 'Todos', appliedMonths: [1, 2], plannedAmount: 100000, valid: true, errors: [] }]
              })
            ),
            getBatch: jasmine.createSpy('getBatch').and.returnValue(of(currentBatch())),
            clear: jasmine.createSpy('clear').and.callFake(() => {
              currentBatch.set(null);
              selectedFile.set(null);
              storeError.set(null);
              templateDownloadError.set(null);
            }),
            clearIncomeImportState: jasmine.createSpy('clearIncomeImportState').and.callFake(() => {
              selectedIncomeFile.set(null);
              incomeImportPreview.set(null);
              incomeImportResult.set(null);
              incomeStoreError.set(null);
              incomeTemplateDownloadError.set(null);
            }),
            clearCategoryImportState: jasmine.createSpy('clearCategoryImportState').and.callFake(() => {
              selectedCategoryFile.set(null);
              categoryImportPreview.set(null);
              categoryTemplateDownloadError.set(null);
            }),
            clearPaymentMethodImportState: jasmine.createSpy('clearPaymentMethodImportState').and.callFake(() => {
              selectedPaymentMethodFile.set(null);
              paymentMethodImportPreview.set(null);
              paymentMethodImportResult.set(null);
              paymentMethodTemplateDownloadError.set(null);
            }),
            clearAnnualBudgetImportState: jasmine.createSpy('clearAnnualBudgetImportState').and.callFake(() => {
              selectedAnnualBudgetFile.set(null);
              annualBudgetImportPreview.set(null);
              annualBudgetImportResult.set(null);
              annualBudgetTemplateDownloadError.set(null);
            })
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(ImportsPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('validates required file', () => {
    const fixture = configure({ batch: null, selectedFile: null });

    fixture.componentInstance.preview();

    expect(fixture.componentInstance.fileError()).toContain('Selecciona un archivo');
  });

  it('rejects non xlsx extension', () => {
    const fixture = configure({ batch: null, selectedFile: null });
    const file = new File(['text'], 'expenses.csv');

    fixture.componentInstance.onFileSelected({ target: { files: [file], value: '' } } as unknown as Event);

    expect(fixture.componentInstance.fileError()).toContain('.xlsx');
  });

  it('rejects files larger than 5MB', () => {
    const fixture = configure({ batch: null, selectedFile: null });
    const file = new File([new Uint8Array(MAX_IMPORT_FILE_SIZE_BYTES + 1)], 'expenses.xlsx');

    fixture.componentInstance.onFileSelected({ target: { files: [file], value: '' } } as unknown as Event);

    expect(fixture.componentInstance.fileError()).toContain('5MB');
  });

  it('shows batch summary', () => {
    const fixture = configure();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('expenses.xlsx');
    expect(text).toContain('Total filas');
    expect(text).toContain('Validas');
    expect(text).toContain('Invalidas');
  });

  it('shows row errors', () => {
    const fixture = configure();

    expect(fixture.nativeElement.textContent).toContain('Jonatan');
    expect(fixture.nativeElement.textContent).toContain('Mary');
    expect(fixture.nativeElement.textContent).toContain('Categoria no existe.');
    expect(fixture.nativeElement.textContent).toContain('Revisar catalogos');
  });

  it('shows debt payment metadata when a preview row applies to a debt', () => {
    const fixture = configure({ batch: debtPaymentBatch });
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Pago deuda');
    expect(text).toContain('Credito cocina');
    expect(text).toContain('En cuotas');
    expect(text).toContain('Cuota mayo');
  });

  it('keeps legacy import rows visible when debt payment metadata is absent', () => {
    const fixture = configure({
      batch: {
        ...previewBatch,
        rows: [
          {
            id: 10,
            rowNumber: 2,
            expenseDate: '2026-05-12',
            description: 'Legacy lunch',
            amount: 12000,
            currency: 'COP',
            categoryName: 'Food',
            categoryId: 3,
            paymentMethodName: 'Cash',
            paymentMethodId: 4,
            paymentState: 'PAID',
            valid: true,
            errors: [],
            createdExpenseId: null
          }
        ]
      }
    });
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Legacy lunch');
    expect(text).toContain('NO');
  });

  it('shows debt-related row errors through the existing row error list', () => {
    const fixture = configure({
      batch: {
        ...debtPaymentBatch,
        validRows: 0,
        invalidRows: 1,
        rows: [
          {
            ...debtPaymentBatch.rows[0],
            valid: false,
            errors: [{ column: 'Deuda', code: 'IMPORT_DEBT_NOT_FOUND', message: 'La deuda no existe o no esta activa.' }]
          }
        ]
      }
    });

    expect(fixture.nativeElement.textContent).toContain('Deuda');
    expect(fixture.nativeElement.textContent).toContain('La deuda no existe o no esta activa.');
  });

  it('shows created debt payment id after confirmation response includes it', () => {
    const fixture = configure({
      batch: {
        ...debtPaymentBatch,
        status: 'CONFIRMED',
        confirmedAt: '2026-05-14T00:00:00Z',
        rows: [{ ...debtPaymentBatch.rows[0], createdExpenseId: 21, createdDebtPaymentId: 31 }]
      }
    });
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Pago deuda #31');
    expect(text).toContain('Importacion confirmada');
  });

  it('disables confirm when there are no valid rows', () => {
    const fixture = configure({ validRows: 0 });

    expect(fixture.componentInstance.canConfirm()).toBeFalse();
  });

  it('does not show confirm button when batch is confirmed', () => {
    const fixture = configure({ batch: { ...previewBatch, status: 'CONFIRMED', confirmedAt: '2026-05-14T00:00:00Z' } });

    expect(fixture.nativeElement.textContent).not.toContain('Confirmar importacion');
    expect(fixture.nativeElement.textContent).toContain('Importacion confirmada');
  });

  it('blocks actions when account is archived', () => {
    const fixture = configure({ archived: true });

    expect(fixture.nativeElement.textContent).toContain('La cuenta esta archivada');
    expect(fixture.componentInstance.canPreview()).toBeFalse();
    expect(fixture.componentInstance.canConfirm()).toBeFalse();
  });

  it('prevents double confirm while confirming', () => {
    const fixture = configure({ confirming: true });

    expect(fixture.componentInstance.canConfirm()).toBeFalse();
  });

  it('shows clear action when import state exists', () => {
    const fixture = configure();

    expect(fixture.nativeElement.textContent).toContain('Cargar otro archivo');
  });

  it('shows the updated expense row limit without changing income import guidance', () => {
    const fixture = configure();

    expect(fixture.nativeElement.textContent).toContain('maximo 1500 filas');

    fixture.componentInstance.activeMode.set('incomes');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('maximo 1000 filas');
  });

  it('clears selected file, preview, messages and row filter', () => {
    const fixture = configure({ batch: debtPaymentBatch });
    const component = fixture.componentInstance;
    const store = TestBed.inject(ImportsStore) as jasmine.SpyObj<ImportsStore>;
    const fakeInput = { value: 'C:\\fakepath\\expenses.xlsx' } as HTMLInputElement;

    component.fileError.set('El archivo debe tener extension .xlsx.');
    component.successMessage.set('Importacion confirmada. Los gastos validos fueron creados.');
    component.rowFilter.set('invalid');
    component.clearImport(fakeInput);
    fixture.detectChanges();

    expect(store.clear).toHaveBeenCalled();
    expect(store.selectedFile()).toBeNull();
    expect(store.currentBatch()).toBeNull();
    expect(component.fileError()).toBeNull();
    expect(component.successMessage()).toBeNull();
    expect(component.rowFilter()).toBe('all');
    expect(fakeInput.value).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Sin preview cargado');
    expect(fixture.nativeElement.textContent).not.toContain('Credito cocina');
  });

  it('allows selecting another file after clearing', () => {
    const fixture = configure();
    const component = fixture.componentInstance;
    const store = TestBed.inject(ImportsStore) as jasmine.SpyObj<ImportsStore>;
    const nextFile = new File(['excel'], 'next-expenses.xlsx');

    component.clearImport({ value: 'C:\\fakepath\\expenses.xlsx' } as HTMLInputElement);
    component.onFileSelected({ target: { files: [nextFile], value: '' } } as unknown as Event);

    expect(store.selectFile).toHaveBeenCalledWith(nextFile);
    expect(store.selectedFile()).toBe(nextFile);
  });

  it('shows template download action and explanation', () => {
    const fixture = configure();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Descargar plantilla Excel');
    expect(text).toContain('La plantilla se genera con las categorías de gasto y medios de pago activos de esta cuenta.');
  });

  it('downloads template using a temporary object url', () => {
    const fixture = configure();
    const store = TestBed.inject(ImportsStore) as jasmine.SpyObj<ImportsStore>;
    spyOn(URL, 'createObjectURL').and.returnValue('blob:template');
    spyOn(URL, 'revokeObjectURL');
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
      expect(this.download).toBe(EXPENSE_IMPORT_TEMPLATE_FILENAME);
    });

    fixture.componentInstance.downloadTemplate();

    expect(store.downloadTemplate).toHaveBeenCalledWith(1);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:template');
  });

  it('disables template button while downloading', () => {
    const fixture = configure({ downloadingTemplate: true });
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const downloadButton = buttons.find((button) => button.textContent?.includes('Descargando'));

    expect(downloadButton).toBeDefined();
    expect(downloadButton?.disabled).toBeTrue();
  });

  it('keeps template download visible when account is archived', () => {
    const fixture = configure({ archived: true });
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('La cuenta esta archivada');
    expect(text).toContain('Descargar plantilla Excel');
  });

  it('shows template download error', () => {
    const fixture = configure({ templateDownloadError: 'No se pudo descargar la plantilla. Intenta nuevamente.' });

    expect(fixture.nativeElement.textContent).toContain('No se pudo descargar la plantilla. Intenta nuevamente.');
  });

  it('shows tabs for expense and income imports', () => {
    const fixture = configure();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Gastos');
    expect(text).toContain('Ingresos');
    expect(text).toContain('Categorias');
    expect(text).toContain('Medios de pago');
    expect(text).toContain('Presupuestos');
  });

  it('switches to incomes mode and shows direct import action', () => {
    const fixture = configure();
    fixture.componentInstance.activeMode.set('incomes');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Importar ingresos desde Excel');
    expect(text).toContain('Importar ingresos');
  });

  it('downloads income template using a temporary object url', () => {
    const fixture = configure();
    const store = TestBed.inject(ImportsStore) as jasmine.SpyObj<ImportsStore>;
    fixture.componentInstance.activeMode.set('incomes');
    fixture.detectChanges();
    spyOn(URL, 'createObjectURL').and.returnValue('blob:income-template');
    spyOn(URL, 'revokeObjectURL');
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
      expect(this.download).toBe(INCOME_IMPORT_TEMPLATE_FILENAME);
    });

    fixture.componentInstance.downloadIncomeTemplate();

    expect(store.downloadIncomeTemplate).toHaveBeenCalledWith(1);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:income-template');
  });

  it('imports incomes directly and shows created count', () => {
    const fixture = configure();
    const store = TestBed.inject(ImportsStore) as jasmine.SpyObj<ImportsStore>;
    fixture.componentInstance.activeMode.set('incomes');
    fixture.detectChanges();

    fixture.componentInstance.importIncomes();

    expect(store.importIncomeFile).toHaveBeenCalledWith(1);
    expect(fixture.componentInstance.incomeSuccessMessage()).toContain('Se importaron');
  });

  it('previews incomes and renders invalid row values and errors without importing', () => {
    const fixture = configure({
      incomePreview: {
        accountId: 1,
        participantId: 7,
        originalFilename: 'incomes-preview.xlsx',
        totalRows: 2,
        createdCount: 0,
        invalidRows: 1,
        rows: [
          {
            rowNumber: 2,
            incomeDate: '2026-05-01',
            description: 'Nomina',
            amount: 1000,
            participantId: 8,
            participantLabel: 'Empleado principal',
            categoryName: 'Salario',
            valid: true,
            errors: []
          },
          {
            rowNumber: 3,
            incomeDate: null,
            description: 'Fila mala',
            amount: null,
            participantId: 9,
            participantLabel: 'Empleado apoyo',
            categoryName: 'Categoria inexistente',
            categoryId: null,
            valid: false,
            errors: ['La fecha no tiene formato valido.', { column: 'Categoria', code: 'CATEGORY_NOT_FOUND', message: 'Categoria invalida.' }]
          }
        ]
      }
    });
    const store = TestBed.inject(ImportsStore) as jasmine.SpyObj<ImportsStore>;
    fixture.componentInstance.activeMode.set('incomes');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Preview stateless de ingresos');
    expect(text).toContain('Fila mala');
    expect(text).toContain('Empleado principal');
    expect(text).toContain('Empleado apoyo');
    expect(text).toContain('Categoria inexistente');
    expect(text).toContain('La fecha no tiene formato valido.');
    expect(text).toContain('Categoria invalida.');
    expect(store.importIncomeFile).not.toHaveBeenCalled();
  });

  it('switches to categories mode and shows direct category import action', () => {
    const fixture = configure();
    fixture.componentInstance.activeMode.set('categories');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Importar categorias desde Excel');
    expect(text).toContain('Importar categorias');
  });

  it('downloads category template using a temporary object url', () => {
    const fixture = configure();
    const store = TestBed.inject(ImportsStore) as jasmine.SpyObj<ImportsStore>;
    fixture.componentInstance.activeMode.set('categories');
    fixture.detectChanges();
    spyOn(URL, 'createObjectURL').and.returnValue('blob:category-template');
    spyOn(URL, 'revokeObjectURL');
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
      expect(this.download).toBe(CATEGORY_IMPORT_TEMPLATE_FILENAME);
    });

    fixture.componentInstance.downloadCategoryTemplate();

    expect(store.downloadCategoryTemplate).toHaveBeenCalledWith(1);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:category-template');
  });

  it('imports categories directly and shows created count', () => {
    const fixture = configure();
    const store = TestBed.inject(ImportsStore) as jasmine.SpyObj<ImportsStore>;
    fixture.componentInstance.activeMode.set('categories');
    fixture.detectChanges();

    fixture.componentInstance.importCategories();

    expect(store.importCategoryFile).toHaveBeenCalledWith(1);
    expect(fixture.componentInstance.categorySuccessMessage()).toContain('Se importaron');
  });

  it('previews categories and renders row data with errors', () => {
    const fixture = configure({
      categoryPreview: {
        accountId: 1,
        participantId: 7,
        originalFilename: 'categories-preview.xlsx',
        totalRows: 1,
        createdCount: 0,
        invalidRows: 1,
        rows: [
          {
            rowNumber: 2,
            name: 'Nueva categoria',
            description: 'Descripcion del usuario',
            type: 'EXPENSE',
            valid: false,
            errors: ['El nombre ya existe.']
          }
        ]
      }
    });
    fixture.componentInstance.activeMode.set('categories');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Preview stateless de categorias');
    expect(text).toContain('Nueva categoria');
    expect(text).toContain('Descripcion del usuario');
    expect(text).toContain('Gasto');
    expect(text).toContain('El nombre ya existe.');
  });

  it('switches to payment methods mode and shows direct import action', () => {
    const fixture = configure();
    fixture.componentInstance.activeMode.set('paymentMethods');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Importar medios de pago desde Excel');
    expect(text).toContain('Importar medios de pago');
  });

  it('downloads payment method template using a temporary object url', () => {
    const fixture = configure();
    const store = TestBed.inject(ImportsStore) as jasmine.SpyObj<ImportsStore>;
    fixture.componentInstance.activeMode.set('paymentMethods');
    fixture.detectChanges();
    spyOn(URL, 'createObjectURL').and.returnValue('blob:payment-method-template');
    spyOn(URL, 'revokeObjectURL');
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
      expect(this.download).toBe(PAYMENT_METHOD_IMPORT_TEMPLATE_FILENAME);
    });

    fixture.componentInstance.downloadPaymentMethodTemplate();

    expect(store.downloadPaymentMethodTemplate).toHaveBeenCalledWith(1);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:payment-method-template');
  });

  it('imports payment methods directly and shows created count', () => {
    const fixture = configure();
    const store = TestBed.inject(ImportsStore) as jasmine.SpyObj<ImportsStore>;
    fixture.componentInstance.activeMode.set('paymentMethods');
    fixture.detectChanges();

    fixture.componentInstance.importPaymentMethods();

    expect(store.importPaymentMethodFile).toHaveBeenCalledWith(1);
    expect(fixture.componentInstance.paymentMethodSuccessMessage()).toContain('Se importaron');
  });

  it('previews payment methods and renders row data with errors', () => {
    const fixture = configure({
      paymentMethodPreview: {
        accountId: 1,
        participantId: 7,
        originalFilename: 'payment-methods-preview.xlsx',
        totalRows: 1,
        createdCount: 0,
        invalidRows: 1,
        rows: [
          {
            rowNumber: 2,
            name: 'Tarjeta vieja',
            description: 'Banco',
            type: 'CREDIT_CARD',
            valid: false,
            errors: ['El tipo no es valido.']
          }
        ]
      }
    });
    fixture.componentInstance.activeMode.set('paymentMethods');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Preview stateless de medios de pago');
    expect(text).toContain('Tarjeta vieja');
    expect(text).toContain('Banco');
    expect(text).toContain('Tarjeta de credito');
    expect(text).toContain('El tipo no es valido.');
  });

  it('switches to budgets mode and shows annual budget import action and help', () => {
    const fixture = configure();
    fixture.componentInstance.activeMode.set('budgets');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Importar presupuesto anual desde Excel');
    expect(text).toContain('Importar presupuesto anual');
    expect(text).toContain('Usa Mes = Todos para aplicar a todo el año');
  });

  it('downloads annual budget template using a temporary object url', () => {
    const fixture = configure();
    const store = TestBed.inject(ImportsStore) as jasmine.SpyObj<ImportsStore>;
    fixture.componentInstance.activeMode.set('budgets');
    fixture.detectChanges();
    spyOn(URL, 'createObjectURL').and.returnValue('blob:annual-budget-template');
    spyOn(URL, 'revokeObjectURL');
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
      expect(this.download).toBe(ANNUAL_BUDGET_IMPORT_TEMPLATE_FILENAME);
    });

    fixture.componentInstance.downloadAnnualBudgetTemplate();

    expect(store.downloadAnnualBudgetTemplate).toHaveBeenCalledWith(1);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:annual-budget-template');
  });

  it('imports annual budget and shows success summary', () => {
    const fixture = configure();
    const store = TestBed.inject(ImportsStore) as jasmine.SpyObj<ImportsStore>;
    fixture.componentInstance.activeMode.set('budgets');
    fixture.detectChanges();

    fixture.componentInstance.importAnnualBudget();

    expect(store.importAnnualBudgetFile).toHaveBeenCalledWith(1);
    expect(fixture.componentInstance.annualBudgetSuccessMessage()).toBe('Se crearon 12 presupuestos.');
  });

  it('previews annual budget and renders applied months and row errors', () => {
    const fixture = configure({
      annualBudgetPreview: {
        accountId: 1,
        participantId: 7,
        originalFilename: 'annual-budgets-preview.xlsx',
        totalRows: 1,
        createdBudgetsCount: 0,
        createdSubBudgetsCount: 0,
        invalidRows: 1,
        rows: [
          {
            rowNumber: 2,
            year: 2026,
            month: 'Todos',
            budgetName: 'Presupuesto 2026',
            categoryName: 'Comida',
            categoryId: 3,
            subBudgetName: 'Mercado',
            plannedAmount: 800000,
            participantId: 7,
            participantLabel: 'Presupuesto familiar',
            appliedMonths: [1, 2, 3],
            valid: false,
            errors: ['Ya existe presupuesto para ese año.']
          }
        ]
      }
    });
    fixture.componentInstance.activeMode.set('budgets');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Preview stateless de presupuesto anual');
    expect(text).toContain('Presupuesto 2026');
    expect(text).toContain('Mercado');
    expect(text).toContain('Presupuesto familiar');
    expect(text).toContain('1, 2, 3');
    expect(text).toContain('Ya existe presupuesto para ese año.');
  });
});
