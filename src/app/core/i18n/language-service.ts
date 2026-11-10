import { inject, LOCALE_ID, Service } from '@angular/core';

import { AppLocale, isAppLocale, saveLocale, SOURCE_LOCALE } from './locale';
import { PageReloader } from '../page-reloader';

/**
 * Language of the interface for the language menus. The translations are loaded before the app
 * starts (main.ts, D-023), so a change saves the choice and loads the page again in it.
 */
@Service()
export class LanguageService {
  private readonly reloader = inject(PageReloader);

  /** The language the page was loaded in: it does not change while the page is open. */
  readonly locale: AppLocale = toAppLocale(inject(LOCALE_ID));

  setLocale(locale: AppLocale): void {
    if (locale === this.locale) {
      return;
    }
    saveLocale(locale);
    this.reloader.reload();
  }
}

function toAppLocale(localeId: string): AppLocale {
  return isAppLocale(localeId) ? localeId : SOURCE_LOCALE;
}
