/**
 * Due dates of the assignments (4.3b, D-054), shared by the teacher's blocks and the student's
 * catalog. They describe how far the date is, never whether somebody is late.
 */

/** The hour and minute of a day. */
export interface DayTime {
  readonly hours: number;
  readonly minutes: number;
}

/** The time a due date gets when the teacher only chooses the day: the end of it. */
export const DEFAULT_DUE_TIME: DayTime = { hours: 23, minutes: 59 };

/** The time a block opens when the teacher only chooses the day (4.3d): the start of it. */
export const DEFAULT_OPENING_TIME: DayTime = { hours: 0, minutes: 0 };

/** How far a due date is, in calendar days of the user's time zone. */
export interface DueDistance {
  readonly kind: 'past' | 'today' | 'upcoming';
  /** Whole days between both days; 0 today. */
  readonly days: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether `dueAt` is today, in some days or some days ago, from `now` (milliseconds). */
export function dueDistance(dueAt: string, now: number): DueDistance {
  // Midnights in UTC of both local days: a change of summer time does not move a whole day
  const days = Math.round((localDay(new Date(dueAt)) - localDay(new Date(now))) / DAY_MS);
  if (days === 0) return { kind: 'today', days };
  return days > 0 ? { kind: 'upcoming', days } : { kind: 'past', days: -days };
}

/**
 * The day of `day` at the hour and minute of `time` or, without one, at `fallback`: by default the
 * end of the day, as a due date.
 */
export function withTime(day: Date, time: Date | null, fallback = DEFAULT_DUE_TIME): Date {
  const result = new Date(day);
  result.setHours(time?.getHours() ?? fallback.hours, time?.getMinutes() ?? fallback.minutes, 0, 0);
  return result;
}

function localDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}
