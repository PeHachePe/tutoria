import { DataError } from '../data/data-error';

/**
 * Beyond it, the server set a limit of the day, not of the minute (the tutor, D-053): the wait is
 * told as a time, not counted down second by second.
 */
export const LONG_WAIT_MS = 60_000;

/** Whether the error asks to wait longer than a minute from `now`. */
export function isLongWait(error: unknown, now: number): boolean {
  return (
    error instanceof DataError && error.retryAt !== undefined && error.retryAt - now > LONG_WAIT_MS
  );
}
