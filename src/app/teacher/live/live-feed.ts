import type { Attempt } from '../../data/attempt';
import type { LiveStudent } from '../../data/live-service';
import type { ProcessEvent, RunDetail } from '../../data/process-event';
import { LIVE_ACTIVITY_MINUTES } from './activity-by-minute';
import type { LiveState } from './live-state';

const MINUTE_MS = 60_000;

/** Entries the feed keeps: a glance at what just happened, not a log. */
export const FEED_SIZE = 8;

/** Runs in a row a test has to fail for passing it to be news. */
export const RECOVERY_FAILURES = 3;

interface FeedBase {
  /** Unique and stable, for `track`. */
  readonly id: string;
  readonly at: number;
  readonly student: LiveStudent;
  readonly attemptId: string;
  /** The exercise in the block, from 1. */
  readonly position: number;
  /** Practice: the attempt repeats a submitted exercise (2.5c). */
  readonly practice: boolean;
}

/** Something worth telling of the class: progress, never what a student did wrong. */
export type FeedEntry = FeedBase &
  (
    | { readonly kind: 'started' }
    | { readonly kind: 'all_passed' }
    /** A test passes after failing `failures` runs in a row. */
    | { readonly kind: 'recovered'; readonly failures: number }
    | { readonly kind: 'submitted' }
  );

/**
 * What just happened in the block (4.1b), the latest first: who moved on to another exercise or
 * repeats one, passed a test that resisted, passed every test or submitted. Pastes and focus changes stay in the table: the
 * feed tells the progress of the class. Failures before the window still count for a streak.
 */
export function liveFeed(state: LiveState, now: number, size = FEED_SIZE): FeedEntry[] {
  const from = now - LIVE_ACTIVITY_MINUTES * MINUTE_MS;
  const positions = new Map(
    state.exercises.map((exercise, index) => [exercise.assignmentId, index + 1]),
  );
  const entries: FeedEntry[] = [];
  for (const { student, attempts, events } of state.students.values()) {
    for (const attempt of attempts) {
      const position = positions.get(attempt.assignmentId ?? '');
      if (position === undefined) continue;
      const base = { student, attemptId: attempt.id, position, practice: attempt.number > 1 };
      // Opening the first exercise is arriving, and the whole class does it at once: only moving
      // on to another exercise, or repeating one, is news
      if (position > 1 || base.practice) {
        const started = Date.parse(attempt.startedAt);
        entries.push({ ...base, kind: 'started', id: `start-${attempt.id}`, at: started });
      }
      entries.push(...eventEntries(attempt, events, base));
    }
  }
  return entries
    .filter((entry) => entry.at >= from)
    .sort((a, b) => b.at - a.at)
    .slice(0, size);
}

/** The runs and the submission of an attempt that are news, in the order they happened. */
function eventEntries(
  attempt: Attempt,
  events: readonly ProcessEvent[],
  base: Omit<FeedBase, 'id' | 'at'>,
): FeedEntry[] {
  const own = events
    .filter((event) => event.attemptId === attempt.id)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const entries: FeedEntry[] = [];
  /** Runs in a row each test has failed until now. */
  let streaks = new Map<string, number>();
  let previous: RunDetail | undefined;
  for (const event of own) {
    const entry = { ...base, id: event.id, at: Date.parse(event.timestamp) };
    if (event.type === 'submit') {
      entries.push({ ...entry, kind: 'submitted' });
    }
    if (event.type !== 'run') continue;
    const run = event.detail;
    const failing = new Set(run.failedTestIds);
    const recovered = Math.max(
      0,
      ...[...streaks].filter(([testId]) => !failing.has(testId)).map(([, streak]) => streak),
    );
    if (run.failed === 0 && (previous === undefined || previous.failed > 0)) {
      entries.push({ ...entry, kind: 'all_passed' });
    } else if (recovered >= RECOVERY_FAILURES) {
      entries.push({ ...entry, kind: 'recovered', failures: recovered });
    }
    streaks = new Map(run.failedTestIds.map((testId) => [testId, (streaks.get(testId) ?? 0) + 1]));
    previous = run;
  }
  return entries;
}
