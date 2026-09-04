import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'easyFinance.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.resolveInitialTheme());

  constructor() {
    effect(() => {
      globalThis.document?.documentElement.setAttribute('data-theme', this.theme());
    });
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, theme);
  }

  toggle(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private resolveInitialTheme(): Theme {
    const stored = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);

    if (stored === 'light' || stored === 'dark') {
      return stored;
    }

    return (globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false) ? 'dark' : 'light';
  }
}
