/**
 * Due dates of the assignments (4.3b, D-054), shared by the teacher's blocks and the student's
 * catalog. They describe how far the date is, never whether somebody is late.
 */

/** The time a due date gets when the teacher only chooses the day: the end of it. */
export const DEFAULT_DUE_TIME = { hours: 23, minutes: 59 } as const;

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

/** The day of `day` at the hour and minute of `time`, or at the end of the day without one. */
export function withTime(day: Date, time: Date | null): Date {
  const result = new Date(day);
  result.setHours(
    time?.getHours() ?? DEFAULT_DUE_TIME.hours,
    time?.getMinutes() ?? DEFAULT_DUE_TIME.minutes,
    0,
    0,
  );
  return result;
}

function localDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}
