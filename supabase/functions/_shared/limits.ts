/** Far above any solution of a beginner: a larger body is not a solution. */
export const MAX_CODE_LENGTH = 50_000;

export const MINUTE_MS = 60_000;
export const DAY_MS = 24 * 60 * MINUTE_MS;

/** When the minute the latest calls are counted in starts. */
export function minuteBefore(now: number): Date {
  return new Date(now - MINUTE_MS);
}

/** When the day (the last 24 hours, not the calendar day) the latest calls are counted in starts. */
export function dayBefore(now: number): Date {
  return new Date(now - DAY_MS);
}

/**
 * Seconds until the user may call again, or 0 if they may now: with `max` calls in the window that
 * ends now (newest first), when the oldest of them leaves it. A minute by default.
 */
export function secondsToWait(
  latest: readonly Date[],
  max: number,
  now: number,
  windowMs = MINUTE_MS,
): number {
  if (latest.length < max) return 0;
  const oldest = latest[max - 1].getTime();
  return Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
}
