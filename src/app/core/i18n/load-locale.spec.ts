import { formatDate } from '@angular/common';
import { clearTranslations } from '@angular/localize';

import { loadLocale } from './load-locale';

describe('loadLocale', () => {
  const sourceLocale = $localize.locale;
  const date = new Date(2026, 10, 7);

  afterEach(() => {
    clearTranslations();
    $localize.locale = sourceLocale;
    document.documentElement.lang = 'es';
    vi.restoreAllMocks();
  });

  it('leaves the source texts alone for Spanish and only sets the language of the page', async () => {
    document.documentElement.lang = '';

    await expect(loadLocale('es', document)).resolves.toBe('es');

    expect(document.documentElement.lang).toBe('es');
    expect($localize.locale).toBe(sourceLocale);
  });

  it.each([
    ['en', 'November'],
    ['ca', 'de novembre'],
  ] as const)(
    'loads the %s translations, locale data and language before the app starts',
    async (locale, month) => {
      await expect(loadLocale(locale, document)).resolves.toBe(locale);

      expect(document.documentElement.lang).toBe(locale);
      expect($localize.locale).toBe(locale);
      expect(formatDate(date, 'MMMM', locale)).toContain(month);
    },
  );

  it('starts in Spanish if the translation cannot be loaded', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failure = new Error('Failed to fetch dynamically imported module');
    vi.spyOn(Promise, 'all').mockRejectedValueOnce(failure);

    await expect(loadLocale('en', document)).resolves.toBe('es');

    expect(document.documentElement.lang).toBe('es');
    expect($localize.locale).toBe(sourceLocale);
    expect(error).toHaveBeenCalledWith(failure);
  });
});
