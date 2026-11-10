import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { LOCALE_STORAGE_KEY } from './locale';
import { LanguageService } from './language-service';
import { PageReloader } from '../page-reloader';

describe('LanguageService', () => {
  const reload = vi.fn();

  function create(localeId?: string): LanguageService {
    TestBed.configureTestingModule({
      providers: [
        { provide: PageReloader, useValue: { reload } },
        ...(localeId ? [{ provide: LOCALE_ID, useValue: localeId }] : []),
      ],
    });
    return TestBed.inject(LanguageService);
  }

  afterEach(() => {
    reload.mockReset();
    localStorage.clear();
  });

  it('starts in the source language, which the build sets as LOCALE_ID', () => {
    expect(create().locale).toBe('es');
  });

  it('reports the language the page was loaded in', () => {
    expect(create('ca').locale).toBe('ca');
  });

  it('treats a LOCALE_ID that is not one of the languages as the source language', () => {
    expect(create('fr').locale).toBe('es');
  });

  it('saves the new language and reloads the page in it', () => {
    const language = create();

    language.setLocale('en');

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    expect(reload).toHaveBeenCalledOnce();
  });

  it('does nothing when the language is already the current one', () => {
    create('en').setLocale('en');

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });
});
