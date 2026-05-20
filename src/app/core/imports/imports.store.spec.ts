import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ExpenseImportBatchResponseDto } from '../../shared/models';
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

  let service: jasmine.SpyObj<ImportsApiService>;
  let store: ImportsStore;

  beforeEach(() => {
    service = jasmine.createSpyObj<ImportsApiService>('ImportsApiService', [
      'previewExpenseImport',
      'confirmExpenseImport',
      'getExpenseImportBatch',
      'downloadExpenseImportTemplate'
    ]);
    service.previewExpenseImport.and.returnValue(of(batch));
    service.confirmExpenseImport.and.returnValue(of({ ...batch, status: 'CONFIRMED', confirmedAt: '2026-05-14T00:00:00Z' }));
    service.getExpenseImportBatch.and.returnValue(of(batch));
    service.downloadExpenseImportTemplate.and.returnValue(of(new Blob(['template'])));

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
});
