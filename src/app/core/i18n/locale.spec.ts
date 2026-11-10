import { LOCALE_STORAGE_KEY, pickLocale, readSavedLocale, saveLocale } from './locale';

describe('pickLocale', () => {
  it('keeps the saved language', () => {
    expect(pickLocale('ca', ['en-US'])).toBe('ca');
  });

  it('ignores a saved value that is not one of the languages', () => {
    expect(pickLocale('fr', ['en-GB'])).toBe('en');
  });

  it.each([
    [['ca-ES', 'es-ES'], 'ca'],
    [['en-US', 'en'], 'en'],
    [['ES'], 'es'],
    [['fr-FR', 'ca'], 'ca'],
  ])('without a saved language, takes the first supported one of %j', (languages, locale) => {
    expect(pickLocale(null, languages)).toBe(locale);
  });

  it('falls back to Spanish, the source language, when the browser asks for none of them', () => {
    expect(pickLocale(null, ['fr-FR', 'de'])).toBe('es');
    expect(pickLocale(null, [])).toBe('es');
  });
});

describe('saved language', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('is saved in localStorage and read back', () => {
    saveLocale('en');

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    expect(readSavedLocale()).toBe('en');
  });

  it('is null when nothing is saved', () => {
    expect(readSavedLocale()).toBeNull();
  });

  it('works without storage: nothing is read and saving does not fail', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(readSavedLocale()).toBeNull();
    expect(() => saveLocale('ca')).not.toThrow();
  });
});
