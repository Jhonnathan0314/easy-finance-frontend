import { Injectable, signal } from '@angular/core';

import { ApiErrorResponse } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class GlobalErrorStore {
  private readonly current = signal<ApiErrorResponse | null>(null);

  readonly error = this.current.asReadonly();

  set(error: ApiErrorResponse): void {
    this.current.set(error);
  }

  clear(): void {
    this.current.set(null);
  }
}
