import { Injectable, type Provider } from '@angular/core';
import { DateAdapter, NativeDateAdapter, provideNativeDateAdapter } from '@angular/material/core';

/** A sample date with a day, a month and a year that cannot be told apart by their value. */
const SAMPLE = new Date(2026, 10, 25);
const CENTURY = 2000;
const TWO_DIGITS = 100;

/**
 * The date the user typed in the order of their language: «25/11/2026» in Spanish and Catalan,
 * «11/25/2026» in English. Any separator works. Null if it is not a day of the calendar.
 */
export function parseLocalDate(text: string, locale: string): Date | null {
  const numbers = text.trim().split(/\D+/).filter(Boolean).map(Number);
  if (numbers.length !== 3) return null;
  const order = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  })
    .formatToParts(SAMPLE)
    .map((part) => part.type)
    .filter((type) => type === 'day' || type === 'month' || type === 'year');
  const value = (type: string) => numbers[order.indexOf(type as (typeof order)[number])];
  const year = value('year') < TWO_DIGITS ? CENTURY + value('year') : value('year');
  const date = new Date(year, value('month') - 1, value('day'));
  // `Date` moves 31/02 to March: that is not what was typed
  return date.getMonth() === value('month') - 1 && date.getDate() === value('day') ? date : null;
}

/**
 * Material's native adapter reads typed dates with `Date.parse`, which only knows the American
 * order: «25/11/2026» would be invalid in Spanish. This one reads them in the order of the language.
 */
@Injectable()
export class LocalizedDateAdapter extends NativeDateAdapter {
  override parse(value: unknown, parseFormat?: unknown): Date | null {
    const date = typeof value === 'string' ? parseLocalDate(value, this.locale) : null;
    return date ?? super.parse(value, parseFormat);
  }
}

/** The native adapter and its formats, reading typed dates in the language of the build. */
export function provideLocalizedDateAdapter(): Provider[] {
  return [provideNativeDateAdapter(), { provide: DateAdapter, useClass: LocalizedDateAdapter }];
}
