import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  const THEME_KEY = 'easyFinance.theme';
  let matchMediaSpy: jasmine.Spy;

  beforeEach(() => {
    localStorage.removeItem(THEME_KEY);
    matchMediaSpy = spyOn(globalThis, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);
  });

  afterEach(() => {
    localStorage.removeItem(THEME_KEY);
    document.documentElement.removeAttribute('data-theme');
  });

  function create(): { service: ThemeService; tick: () => void } {
    TestBed.resetTestingModule();
    const service = TestBed.inject(ThemeService);
    const appRef = TestBed.inject(ApplicationRef);
    return { service, tick: () => appRef.tick() };
  }

  it('defaults to light when nothing is stored and the system prefers light', () => {
    matchMediaSpy.and.returnValue({ matches: false } as MediaQueryList);

    const { service, tick } = create();
    tick();

    expect(service.theme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('defaults to dark when nothing is stored and the system prefers dark', () => {
    matchMediaSpy.and.returnValue({ matches: true } as MediaQueryList);

    const { service, tick } = create();
    tick();

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('prefers a stored theme over the system preference', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    matchMediaSpy.and.returnValue({ matches: false } as MediaQueryList);

    const { service } = create();

    expect(service.theme()).toBe('dark');
  });

  it('setTheme persists the preference and updates the document attribute', () => {
    const { service, tick } = create();

    service.setTheme('dark');
    tick();

    expect(service.theme()).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggle switches between light and dark', () => {
    const { service, tick } = create();
    service.setTheme('light');
    tick();

    service.toggle();
    tick();
    expect(service.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    service.toggle();
    tick();
    expect(service.theme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
