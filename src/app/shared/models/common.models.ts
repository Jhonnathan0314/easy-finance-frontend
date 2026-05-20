export type CurrencyCode = 'COP';

export interface Money {
  amount: number;
  currency: CurrencyCode;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type PageResponseDto<T> = PageResponse<T>;

export interface FieldErrorResponse {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  code: string;
  message: string;
  path: string;
  correlationId: string | null;
  details: FieldErrorResponse[] | null;
}

export interface ApiRequestOptions {
  accountId?: number;
  params?: Record<string, string | number | boolean | null | undefined>;
}
