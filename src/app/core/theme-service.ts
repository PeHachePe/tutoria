import { DOCUMENT, inject, Service, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'tutoria.theme-mode';

const THEME_MODES: readonly string[] = ['light', 'dark', 'system'] satisfies ThemeMode[];

/** The three modes as the menus offer them: the user menu of the shells and the login (ThemeMenu). */
export const THEME_OPTIONS: readonly {
  readonly mode: ThemeMode;
  readonly label: string;
  readonly icon: string;
}[] = [
  { mode: 'light', label: $localize`:@@theme.light:Tema claro`, icon: 'light_mode' },
  { mode: 'dark', label: $localize`:@@theme.dark:Tema oscuro`, icon: 'dark_mode' },
  { mode: 'system', label: $localize`:@@theme.system:Tema del sistema`, icon: 'contrast' },
];

/** `color-scheme` value for each mode: the Material theme uses `light-dark()`, so this switches it. */
const COLOR_SCHEMES: Record<ThemeMode, string> = {
  light: 'light',
  dark: 'dark',
  system: 'light dark',
};

/** Light, dark or system appearance, saved in localStorage and applied to <html> without reloading. */
@Service()
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;

  private readonly modeState = signal<ThemeMode>(readSavedMode());

  readonly mode = this.modeState.asReadonly();

  constructor() {
    this.apply(this.modeState());
  }

  setMode(mode: ThemeMode): void {
    this.modeState.set(mode);
    this.apply(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Storage unavailable (blocked or full): the choice still applies until the page is closed.
    }
  }

  private apply(mode: ThemeMode): void {
    this.root.style.colorScheme = COLOR_SCHEMES[mode];
  }
}

function readSavedMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value !== null && THEME_MODES.includes(value);
}
