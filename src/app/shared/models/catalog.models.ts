import { CatalogStatus, CategoryType, PaymentMethodType } from './enums';

export interface CreateCategoryRequest {
  name: string;
  description?: string | null;
  type: CategoryType;
}

export interface UpdateCategoryRequest {
  name: string;
  description?: string | null;
  type?: CategoryType | null;
}

export interface CategoryResponse {
  id: number;
  accountId: number;
  name: string;
  description?: string | null;
  type: CategoryType;
  status: CatalogStatus;
  createdAt: string;
  updatedAt: string;
}

export type CategoryResponseDto = CategoryResponse;

export interface CreatePaymentMethodRequest {
  name: string;
  description?: string | null;
  type: PaymentMethodType;
}

export interface UpdatePaymentMethodRequest {
  name: string;
  description?: string | null;
  type?: PaymentMethodType | null;
}

export interface PaymentMethodResponse {
  id: number;
  accountId: number;
  name: string;
  description?: string | null;
  type: PaymentMethodType;
  status: CatalogStatus;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethodResponseDto = PaymentMethodResponse;

export interface CatalogListFilters {
  search?: string | null;
  type?: CategoryType | PaymentMethodType | null;
  status?: CatalogStatus | null;
  page?: number | null;
  size?: number | null;
  sort?: string | null;
}
