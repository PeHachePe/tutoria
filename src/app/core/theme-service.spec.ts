import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { THEME_STORAGE_KEY, ThemeService } from './theme-service';

describe('ThemeService', () => {
  let root: HTMLElement;

  function create(): ThemeService {
    return TestBed.inject(ThemeService);
  }

  beforeEach(() => {
    localStorage.clear();
    root = TestBed.inject(DOCUMENT).documentElement;
    root.style.colorScheme = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    root.style.colorScheme = '';
  });

  it('follows the system when nothing is saved', () => {
    const theme = create();

    expect(theme.mode()).toBe('system');
    expect(root.style.colorScheme).toBe('light dark');
  });

  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
    ['system', 'light dark'],
  ] as const)('restores the saved %s mode and applies it to <html>', (mode, colorScheme) => {
    localStorage.setItem(THEME_STORAGE_KEY, mode);

    const theme = create();

    expect(theme.mode()).toBe(mode);
    expect(root.style.colorScheme).toBe(colorScheme);
  });

  it('ignores a saved value that is not a mode', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');

    expect(create().mode()).toBe('system');
  });

  it('changes the mode, applies it and saves it', () => {
    const theme = create();

    theme.setMode('dark');

    expect(theme.mode()).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    theme.setMode('light');

    expect(theme.mode()).toBe('light');
    expect(root.style.colorScheme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('works without storage: falls back to the system mode and keeps the choice in memory', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const theme = create();
    expect(theme.mode()).toBe('system');

    theme.setMode('dark');

    expect(theme.mode()).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
  });
});
