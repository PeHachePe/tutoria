import type { Attempt } from '../data/attempt';
import type { StuckThresholds } from '../data/exercise';
import type { ProcessEvent, ProcessEventType } from '../data/process-event';

const MINUTE_MS = 60_000;

/** Events that show the student is working. `focus_lost` and `proactive_intervention` do not. */
const ACTIVITY_EVENTS: ReadonlySet<ProcessEventType> = new Set([
  'run',
  'submit',
  'hint_requested',
  'paste',
  'focus_gained',
]);

/** Why a student seems stuck: the same test keeps failing, or nothing happens. */
export type StuckReason = 'failures' | 'idle';

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

/** Longest run of latest consecutive runs in which one same test failed. */
export function failureStreak(events: readonly ProcessEvent[]): number {
  const runs = events
    .flatMap((event) => (event.type === 'run' ? [event] : []))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .map((run) => run.detail.failedTestIds);
  const failingNow = runs.at(-1) ?? [];
  return Math.max(0, ...failingNow.map((testId) => trailingFailures(runs, testId)));
}

/** Runs in a row, counting back from the latest, in which `testId` failed. */
function trailingFailures(runs: readonly (readonly string[])[], testId: string): number {
  let count = 0;
  while (count < runs.length && runs[runs.length - 1 - count].includes(testId)) {
    count++;
  }
  return count;
}

/** Time of the latest activity on an attempt, in milliseconds. */
export function lastActivityAt(
  attempt: Pick<Attempt, 'updatedAt'>,
  events: readonly ProcessEvent[],
): number {
  const activityTimes = events
    .filter((event) => ACTIVITY_EVENTS.has(event.type))
    .map((event) => Date.parse(event.timestamp));
  return Math.max(Date.parse(attempt.updatedAt), ...activityTimes);
}
