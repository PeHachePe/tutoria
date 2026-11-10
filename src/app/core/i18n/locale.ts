// This file runs before the translations are loaded (main.ts): it must not import any module that
// calls $localize when it is evaluated.

/** The languages of the interface. Spanish is the source: the texts of the templates (D-023). */
const LOCALES = ['es', 'en', 'ca'] as const;

export type AppLocale = (typeof LOCALES)[number];

export const SOURCE_LOCALE = 'es' satisfies AppLocale;

export const LOCALE_STORAGE_KEY = 'tutoria.locale';

/** Each language as the menus offer it, in its own language: a reader looks for their own. */
export const LANGUAGE_OPTIONS: readonly { readonly locale: AppLocale; readonly label: string }[] = [
  { locale: 'es', label: 'Español' },
  { locale: 'en', label: 'English' },
  { locale: 'ca', label: 'Català' },
];

/**
 * The language of the interface: the one chosen in the menu if there is one; otherwise the first of
 * the browser's languages that the app speaks (`ca-ES` → `ca`); otherwise Spanish.
 */
export function pickLocale(saved: string | null, browserLanguages: readonly string[]): AppLocale {
  if (isAppLocale(saved)) {
    return saved;
  }
  const supported = browserLanguages
    .map((language) => language.split('-')[0].toLowerCase())
    .find(isAppLocale);
  return supported ?? SOURCE_LOCALE;
}

export function readSavedLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveLocale(locale: AppLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage unavailable (blocked or full): the next visit picks the language of the browser.
  }
}

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return LOCALES.some((locale) => locale === value);
}
