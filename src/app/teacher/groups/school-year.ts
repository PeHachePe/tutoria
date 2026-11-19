import { SCHOOL_YEAR_PATTERN } from '../../data/group-service';

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

/** Like `2026/27` and of two years in a row: `2026/99` has the shape, not the meaning. */
export function isSchoolYear(text: string): boolean {
  if (!SCHOOL_YEAR_PATTERN.test(text)) return false;
  const [start, end] = text.split('/').map(Number);
  return (start + 1) % 100 === end;
}
