import type { ContentLocale } from '../../data/localized-text';

/**
 * The name of each language inside a sentence of the interface («solo está en inglés», «Título en
 * catalán»), unlike the menus, which name each one in its own language (LANGUAGE_OPTIONS).
 */
export const LOCALE_NAMES: Readonly<Record<ContentLocale, string>> = {
  es: $localize`:@@locale.name.es:español`,
  en: $localize`:@@locale.name.en:inglés`,
  ca: $localize`:@@locale.name.ca:catalán`,
};
