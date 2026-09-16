import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CreditCardClosingPreviewResponseDto, CreditCardClosingRequest, CreditCardClosingResultResponseDto } from '../../shared/models';
import { ApiClient } from '../http/api-client';

@Injectable({ providedIn: 'root' })
export class CreditCardClosingApiService {
  private readonly api = inject(ApiClient);

  preview(accountId: number, paymentMethodId: number, from: string, to: string): Observable<CreditCardClosingPreviewResponseDto> {
    return this.api.get<CreditCardClosingPreviewResponseDto>(`/accounts/${accountId}/expenses/credit-card-closing/preview`, {
      paymentMethodId,
      from,
      to
    });
  }

  confirm(accountId: number, request: CreditCardClosingRequest): Observable<CreditCardClosingResultResponseDto> {
    return this.api.post<CreditCardClosingResultResponseDto, CreditCardClosingRequest>(
      `/accounts/${accountId}/expenses/credit-card-closing/confirm`,
      request
    );
  }
}
