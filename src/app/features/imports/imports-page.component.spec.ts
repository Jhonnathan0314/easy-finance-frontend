import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ImportsStore } from '../../core/imports/imports.store';
import { AccountStore } from '../../core/state/account.store';
import { AccountResponseDto, ApiErrorResponse, ExpenseImportBatchResponseDto } from '../../shared/models';
import {
  EXPENSE_IMPORT_TEMPLATE_FILENAME,
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
        categoryName: 'Food',
        categoryId: 3,
        paymentMethodName: 'Cash',
        paymentMethodId: 4,
        paymentState: 'PAID',
        valid: true,
        errors: [],
        createdExpenseId: null
      },
      {
        id: 2,
        rowNumber: 3,
        expenseDate: null,
        description: 'Bad row',
        amount: null,
        currency: null,
        categoryName: 'Missing',
        categoryId: null,
        paymentMethodName: null,
        paymentMethodId: null,
        paymentState: null,
        valid: false,
        errors: [{ column: 'Categoria', code: 'CATEGORY_NOT_FOUND', message: 'Categoria no existe.' }],
        createdExpenseId: null
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
      selectedFile?: File | null;
    } = {}
  ): ComponentFixture<ImportsPageComponent> {
    const currentBatch = signal<ExpenseImportBatchResponseDto | null>(
      Object.prototype.hasOwnProperty.call(options, 'batch') ? options.batch ?? null : previewBatch
    );
    const selectedFile = signal<File | null>(
      Object.prototype.hasOwnProperty.call(options, 'selectedFile') ? options.selectedFile ?? null : new File(['excel'], 'expenses.xlsx')
    );
    const accountState = { ...account, status: options.archived ? 'ARCHIVED' : 'ACTIVE' };
    const storeError = signal<ApiErrorResponse | null>(null);
    const templateDownloadError = signal(options.templateDownloadError ?? null);

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
            error: storeError,
            templateDownloadError,
            selectedFile,
            selectFile: jasmine.createSpy('selectFile').and.callFake((file: File) => selectedFile.set(file)),
            clearFile: jasmine.createSpy('clearFile').and.callFake(() => selectedFile.set(null)),
            preview: jasmine.createSpy('preview').and.returnValue(of(currentBatch())),
            confirm: jasmine.createSpy('confirm').and.returnValue(of({ ...previewBatch, status: 'CONFIRMED' })),
            downloadTemplate: jasmine.createSpy('downloadTemplate').and.returnValue(of(new Blob(['template']))),
            getBatch: jasmine.createSpy('getBatch').and.returnValue(of(currentBatch())),
            clear: jasmine.createSpy('clear').and.callFake(() => {
              currentBatch.set(null);
              selectedFile.set(null);
              storeError.set(null);
              templateDownloadError.set(null);
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

    expect(fixture.nativeElement.textContent).toContain('Categoria no existe.');
    expect(fixture.nativeElement.textContent).toContain('Revisar catalogos');
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

  it('clears selected file, preview, messages and row filter', () => {
    const fixture = configure();
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
});
