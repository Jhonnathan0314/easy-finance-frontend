import { Injectable } from '@angular/core';

import { AuthTokenResponseDto } from '../../shared/models';

const AUTH_SESSION_KEY = 'easy-finance.auth-session';

@Injectable({ providedIn: 'root' })
export class AuthStorageService {
  read(): AuthTokenResponseDto | null {
    const raw = globalThis.localStorage?.getItem(AUTH_SESSION_KEY);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AuthTokenResponseDto;
    } catch {
      this.clear();
      return null;
    }
  }

  write(session: AuthTokenResponseDto): void {
    globalThis.localStorage?.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  }

  clear(): void {
    globalThis.localStorage?.removeItem(AUTH_SESSION_KEY);
  }
}
