import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ExpenseImportBatchResponseDto } from '../../shared/models';
import { ApiClient } from '../http/api-client';

@Injectable({ providedIn: 'root' })
export class ImportsApiService {
  private readonly api = inject(ApiClient);

  previewExpenseImport(accountId: number, file: File): Observable<ExpenseImportBatchResponseDto> {
    const formData = new FormData();
    formData.append('file', file);

    return this.api.post<ExpenseImportBatchResponseDto, FormData>(
      `/accounts/${accountId}/imports/expenses/preview`,
      formData
    );
  }

  confirmExpenseImport(accountId: number, batchId: number): Observable<ExpenseImportBatchResponseDto> {
    return this.api.post<ExpenseImportBatchResponseDto, Record<string, never>>(
      `/accounts/${accountId}/imports/expenses/${batchId}/confirm`,
      {}
    );
  }

  getExpenseImportBatch(accountId: number, batchId: number): Observable<ExpenseImportBatchResponseDto> {
    return this.api.get<ExpenseImportBatchResponseDto>(`/accounts/${accountId}/imports/expenses/${batchId}`);
  }

  downloadExpenseImportTemplate(accountId: number): Observable<Blob> {
    return this.api.getBlob(`/accounts/${accountId}/imports/expenses/template`);
  }
}
