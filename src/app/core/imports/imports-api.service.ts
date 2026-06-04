import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AnnualBudgetImportResponseDto,
  CategoryImportResponseDto,
  ExpenseImportBatchResponseDto,
  IncomeImportResponseDto,
  PaymentMethodImportResponseDto
} from '../../shared/models';
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

  previewIncomeImport(accountId: number, file: File): Observable<IncomeImportResponseDto> {
    const formData = new FormData();
    formData.append('file', file);

    return this.api.post<IncomeImportResponseDto, FormData>(`/accounts/${accountId}/imports/incomes/preview`, formData);
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

  downloadIncomeImportTemplate(accountId: number): Observable<Blob> {
    return this.api.getBlob(`/accounts/${accountId}/imports/incomes/template`);
  }

  importIncomes(accountId: number, file: File): Observable<IncomeImportResponseDto> {
    const formData = new FormData();
    formData.append('file', file);

    return this.api.post<IncomeImportResponseDto, FormData>(`/accounts/${accountId}/imports/incomes`, formData);
  }

  previewCategoryImport(accountId: number, file: File): Observable<CategoryImportResponseDto> {
    const formData = new FormData();
    formData.append('file', file);

    return this.api.post<CategoryImportResponseDto, FormData>(`/accounts/${accountId}/imports/categories/preview`, formData);
  }

  downloadCategoryImportTemplate(accountId: number): Observable<Blob> {
    return this.api.getBlob(`/accounts/${accountId}/imports/categories/template`);
  }

  importCategories(accountId: number, file: File): Observable<CategoryImportResponseDto> {
    const formData = new FormData();
    formData.append('file', file);

    return this.api.post<CategoryImportResponseDto, FormData>(`/accounts/${accountId}/imports/categories`, formData);
  }

  previewPaymentMethodImport(accountId: number, file: File): Observable<PaymentMethodImportResponseDto> {
    const formData = new FormData();
    formData.append('file', file);

    return this.api.post<PaymentMethodImportResponseDto, FormData>(
      `/accounts/${accountId}/imports/payment-methods/preview`,
      formData
    );
  }

  downloadPaymentMethodImportTemplate(accountId: number): Observable<Blob> {
    return this.api.getBlob(`/accounts/${accountId}/imports/payment-methods/template`);
  }

  importPaymentMethods(accountId: number, file: File): Observable<PaymentMethodImportResponseDto> {
    const formData = new FormData();
    formData.append('file', file);

    return this.api.post<PaymentMethodImportResponseDto, FormData>(
      `/accounts/${accountId}/imports/payment-methods`,
      formData
    );
  }

  previewAnnualBudgetImport(accountId: number, file: File): Observable<AnnualBudgetImportResponseDto> {
    const formData = new FormData();
    formData.append('file', file);

    return this.api.post<AnnualBudgetImportResponseDto, FormData>(
      `/accounts/${accountId}/imports/budgets/annual/preview`,
      formData
    );
  }

  downloadAnnualBudgetImportTemplate(accountId: number): Observable<Blob> {
    return this.api.getBlob(`/accounts/${accountId}/imports/budgets/annual/template`);
  }

  importAnnualBudget(accountId: number, file: File): Observable<AnnualBudgetImportResponseDto> {
    const formData = new FormData();
    formData.append('file', file);

    return this.api.post<AnnualBudgetImportResponseDto, FormData>(`/accounts/${accountId}/imports/budgets/annual`, formData);
  }
}
