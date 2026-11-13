import type { ProcessEvent } from '../data/process-event';

/** A run that passed a test the student had been failing. */
export interface Breakthrough {
  /** When, in milliseconds. */
  readonly at: number;
  /** Runs in a row in which the test had failed before. */
  readonly failures: number;
}

/**
 * The latest run that passed a test after it failed in at least `threshold` runs in a row (2.7,
 * RF-09): an achievement worth celebrating. The teacher's panel shows it as perseverance (D-054)
 * and the proactive tutor will use it to congratulate (6.2). Sibling of `isStuck()`.
 */
export function lastBreakthrough(
  events: readonly ProcessEvent[],
  threshold: number,
): Breakthrough | null {
  const runs = events
    .flatMap((event) => (event.type === 'run' ? [event] : []))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  let streaks = new Map<string, number>();
  let latest: Breakthrough | null = null;
  for (const run of runs) {
    const failing = new Set(run.detail.failedTestIds);
    for (const [testId, failures] of streaks) {
      if (!failing.has(testId) && failures >= threshold) {
        latest = { at: Date.parse(run.timestamp), failures };
      }
    }
    streaks = new Map([...failing].map((testId) => [testId, (streaks.get(testId) ?? 0) + 1]));
  }
  return latest;
}
