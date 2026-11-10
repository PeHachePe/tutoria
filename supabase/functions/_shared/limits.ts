/** Far above any solution of a beginner: a larger body is not a solution. */
export const MAX_CODE_LENGTH = 50_000;

const MINUTE_MS = 60_000;

/** When the minute the latest calls are counted in starts. */
export function minuteBefore(now: number): Date {
  return new Date(now - MINUTE_MS);
}

/**
 * Seconds until the user may call again, or 0 if they may now: with `perMinute` calls in the last
 * minute (newest first), when the oldest of them leaves the minute.
 */
export function secondsToWait(latest: readonly Date[], perMinute: number, now: number): number {
  if (latest.length < perMinute) return 0;
  const oldest = latest[perMinute - 1].getTime();
  return Math.max(1, Math.ceil((oldest + MINUTE_MS - now) / 1000));
}
