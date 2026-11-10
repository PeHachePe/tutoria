// This file runs before the translations are loaded (main.ts): it must not import any module that
// calls $localize when it is evaluated.
import { registerLocaleData } from '@angular/common';
import { loadTranslations } from '@angular/localize';

import { AppLocale, SOURCE_LOCALE } from './locale';

interface LocaleBundle {
  /** Message id → translated text, as `ng extract-i18n` writes them (src/locale/messages.*.json). */
  readonly translations: Record<string, string>;
  /** Angular's formats for dates, numbers and plurals of the language. */
  readonly data: unknown;
}

type TranslatedLocale = Exclude<AppLocale, typeof SOURCE_LOCALE>;

/** Each translation in its own lazy chunk: the source language downloads none of them. */
const BUNDLES: Record<TranslatedLocale, () => Promise<LocaleBundle>> = {
  en: async () => {
    const [messages, data] = await Promise.all([
      import('../../../locale/messages.en.json'),
      import('@angular/common/locales/en'),
    ]);
    return { translations: messages.default.translations, data: data.default };
  },
  ca: async () => {
    const [messages, data] = await Promise.all([
      import('../../../locale/messages.ca.json'),
      import('@angular/common/locales/ca'),
    ]);
    return { translations: messages.default.translations, data: data.default };
  },
};

/**
 * Prepares the interface in `locale` before the app starts (D-023): the translations for $localize,
 * the locale data for the pipes and Material, `$localize.locale` (which LOCALE_ID reads) and the
 * `lang` of the page. The source language needs nothing: the build already registers it. If the
 * translation cannot be downloaded, the app starts in the source language rather than not at all.
 * Returns the language actually loaded.
 */
export async function loadLocale(locale: AppLocale, document: Document): Promise<AppLocale> {
  let loaded = locale;
  if (locale !== SOURCE_LOCALE) {
    try {
      const { translations, data } = await BUNDLES[locale]();
      loadTranslations(translations);
      registerLocaleData(data, locale);
      $localize.locale = locale;
    } catch (error) {
      console.error(error);
      loaded = SOURCE_LOCALE;
    }
  }
  document.documentElement.lang = loaded;
  return loaded;
}
