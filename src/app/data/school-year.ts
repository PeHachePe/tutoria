import { SCHOOL_YEAR_PATTERN } from './group-service';
import type { SchoolClass } from './user';

/** The month a school year starts in: September, as `Date.getMonth()` counts it. */
const SCHOOL_YEAR_START_MONTH = 8;

/**
 * The school year of a date, as `class_group` stores it: «2026/27» from 1 September 2026 to 31
 * August 2027. The default of a new group (5.2b).
 */
export function schoolYearOf(date: Date): string {
  const start =
    date.getMonth() >= SCHOOL_YEAR_START_MONTH ? date.getFullYear() : date.getFullYear() - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
}

/**
 * A year that is over (5.2e, D-082): its classes are closed, read only, unless the administration
 * reopens one. As `current_school_year()`, from 1 September.
 */
export function isPastSchoolYear(schoolYear: string, today: Date): boolean {
  return schoolYear < schoolYearOf(today);
}

/** As `is_open_class` (5.2e): of this year or a later one, or reopened by the administration. */
export function isOpenClass(
  schoolClass: Pick<SchoolClass, 'schoolYear' | 'reopened'>,
  today: Date,
): boolean {
  return schoolClass.reopened || !isPastSchoolYear(schoolClass.schoolYear, today);
}

/** Like `2026/27` and of two years in a row: `2026/99` has the shape, not the meaning. */
export function isSchoolYear(text: string): boolean {
  if (!SCHOOL_YEAR_PATTERN.test(text)) return false;
  const [start, end] = text.split('/').map(Number);
  return (start + 1) % 100 === end;
}

/** The school year `years` after (or before, if negative) the one given: 2026/27 → 2027/28. */
export function shiftSchoolYear(schoolYear: string, years: number): string {
  const start = Number(schoolYear.slice(0, 4)) + years;
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
}

/**
 * The school years a class is chosen in (5.2d): the one before the year given, it and the one
 * after, so it is never typed by hand.
 */
export function schoolYearChoices(around: string): string[] {
  return [-1, 0, 1].map((years) => shiftSchoolYear(around, years));
}

/**
 * The school year a group is duplicated for (5.2c): the one after its own, or the current one if
 * that is later, as for a group of two years ago.
 */
export function nextSchoolYear(schoolYear: string, today: Date): string {
  const next = shiftSchoolYear(schoolYear, 1);
  const current = schoolYearOf(today);
  return current > next ? current : next;
}
