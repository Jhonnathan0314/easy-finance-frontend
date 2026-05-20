import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FeatureFilterStorageService {
  getFilters<T>(feature: string, accountId: number): T | null {
    try {
      const raw = globalThis.localStorage?.getItem(this.key(feature, accountId));

      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as unknown;

      return parsed && typeof parsed === 'object' ? (parsed as T) : null;
    } catch {
      this.clearFilters(feature, accountId);
      return null;
    }
  }

  setFilters<T>(feature: string, accountId: number, filters: T): void {
    try {
      globalThis.localStorage?.setItem(this.key(feature, accountId), JSON.stringify(filters));
    } catch {
      // Storage can be unavailable or full; filters are a convenience only.
    }
  }

  clearFilters(feature: string, accountId: number): void {
    try {
      globalThis.localStorage?.removeItem(this.key(feature, accountId));
    } catch {
      // Ignore storage failures so filters never break the app.
    }
  }

  private key(feature: string, accountId: number): string {
    return `easyFinance.filters.${feature}.${accountId}`;
  }
}
