import type { Attempt } from '../data/attempt';
import type { StuckThresholds } from '../data/exercise';
import type { ProcessEvent } from '../data/process-event';
import {
  failedTestsByRun,
  failureStreak,
  lastActivityAt,
  type ProactiveReason,
} from './proactive-reason';

const MINUTE_MS = 60_000;

/** Why a student seems stuck: the same test keeps failing, or nothing happens. */
export type StuckReason = Exclude<ProactiveReason, 'achievement'>;

/**
 * Whether a student seems stuck on an attempt (2.7). It is a reading of the events, not a stored status.
 * Shared by the teacher's live panel and the proactive tutor.
 *
 * Only attempts in progress or with failed tests can be stuck, when either:
 * - the same test failed in the latest `maxRepeatedFailures` runs in a row;
 * - or `maxIdleMinutes` have passed since the last activity: the last change of the attempt
 *   (`updatedAt`, which every code save updates) or the last event in `ACTIVITY_EVENTS`.
 *
 * Reaching a threshold is enough. `now` is a timestamp in milliseconds.
 */
export function isStuck(
  attempt: Pick<Attempt, 'status' | 'updatedAt'>,
  events: readonly ProcessEvent[],
  thresholds: StuckThresholds,
  now: number,
): boolean {
  return stuckReason(attempt, events, thresholds, now) !== null;
}

/** Why `isStuck()` says so, or null if it does not; the failures come first, as the more precise. */
export function stuckReason(
  attempt: Pick<Attempt, 'status' | 'updatedAt'>,
  events: readonly ProcessEvent[],
  thresholds: StuckThresholds,
  now: number,
): StuckReason | null {
  if (attempt.status !== 'in_progress' && attempt.status !== 'tests_failed') {
    return null;
  }
  if (failureStreak(events) >= thresholds.maxRepeatedFailures) {
    return 'failures';
  }
  return now - lastActivityAt(attempt, events) >= thresholds.maxIdleMinutes * MINUTE_MS
    ? 'idle'
    : null;
}

/**
 * Longest run of consecutive runs in which one same test failed, at any point of the attempt and not
 * only at its end (the history, 4.4): a student who got stuck and then passed was stuck. 0 without
 * runs.
 */
export function longestFailureStreak(events: readonly ProcessEvent[]): number {
  /** Each test failing in the previous run, with the runs in a row it has failed up to it. */
  let streaks = new Map<string, number>();
  let longest = 0;
  for (const failed of failedTestsByRun(events)) {
    streaks = new Map(failed.map((testId) => [testId, (streaks.get(testId) ?? 0) + 1]));
    longest = Math.max(longest, ...streaks.values());
  }
  return longest;
}
