/** The average length of a year in the Gregorian calendar. */
const DAYS_PER_YEAR = 365.2425;
const DAYS_PER_WEEK = 7;

/**
 * The days between two school years (`2026/27`) in whole weeks, so a date keeps its weekday:
 * Friday 20/11/2026 is Friday 19/11/2027. As `school_year_shift_days` (5.2c, D-079).
 */
export function schoolYearShiftDays(sourceYear: string, targetYear: string): number {
  const years = Number(targetYear.slice(0, 4)) - Number(sourceYear.slice(0, 4));
  return Math.round((years * DAYS_PER_YEAR) / DAYS_PER_WEEK) * DAYS_PER_WEEK;
}

/**
 * An ISO date moved by `days` in local time, so 23:59 stays 23:59 across a change of time; none
 * without days (a copy without dates) or without a date.
 */
export function shiftDate(iso: string | null, days: number | null): string | null {
  if (iso === null || days === null) return null;
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
