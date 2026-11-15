import { TestBed } from '@angular/core/testing';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';

import { parseLocalDate, provideLocalizedDateAdapter } from './localized-date-adapter';

describe('parseLocalDate', () => {
  it('reads the day first in Spanish and Catalan, and the month first in English', () => {
    expect(parseLocalDate('25/11/2026', 'es')).toEqual(new Date(2026, 10, 25));
    expect(parseLocalDate('3-2-2027', 'ca')).toEqual(new Date(2027, 1, 3));
    expect(parseLocalDate('11/25/2026', 'en')).toEqual(new Date(2026, 10, 25));
  });

  it('takes a year of two digits as of this century', () => {
    expect(parseLocalDate('25/11/26', 'es')).toEqual(new Date(2026, 10, 25));
  });

  it('gives null for what is not a date of the calendar', () => {
    expect(parseLocalDate('31/02/2026', 'es')).toBeNull();
    expect(parseLocalDate('25/13/2026', 'es')).toBeNull();
    expect(parseLocalDate('25/11', 'es')).toBeNull();
    expect(parseLocalDate('mañana', 'es')).toBeNull();
  });
});

describe('LocalizedDateAdapter', () => {
  function adapter(locale: string): DateAdapter<Date> {
    TestBed.configureTestingModule({
      providers: [provideLocalizedDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: locale }],
    });
    return TestBed.inject(DateAdapter);
  }

  it('parses what is typed in the order of the language', () => {
    expect(adapter('es').parse('25/11/2026', null)).toEqual(new Date(2026, 10, 25));
  });

  it('leaves the rest to the native adapter', () => {
    const native = adapter('es');
    expect(native.parse(0, null)).toEqual(new Date(0));
    expect(native.parse('', null)).toBeNull();
    expect(native.isValid(native.parse('mañana', null) as Date)).toBe(false);
  });
});
