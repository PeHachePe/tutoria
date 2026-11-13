import type { LiveState } from './live-state';

const MINUTE_MS = 60_000;

/** Minutes of recent activity the panel shows: the chart and the feed (4.1b). */
export const LIVE_ACTIVITY_MINUTES = 30;

/** What the class did in a minute. */
export interface ActivityMinute {
  /** When the minute starts, in milliseconds. */
  readonly start: number;
  readonly runs: number;
  readonly hints: number;
}

/**
 * The runs and the hint requests of the whole block, minute by minute, the current one last. Hints
 * climbing over runs say the class is stuck; both falling, that it has stopped or finished.
 */
export function activityByMinute(
  state: LiveState,
  now: number,
  minutes = LIVE_ACTIVITY_MINUTES,
): ActivityMinute[] {
  const first = (Math.floor(now / MINUTE_MS) - (minutes - 1)) * MINUTE_MS;
  const runs = new Array<number>(minutes).fill(0);
  const hints = new Array<number>(minutes).fill(0);
  for (const { events } of state.students.values()) {
    for (const event of events) {
      if (event.type !== 'run' && event.type !== 'hint_requested') continue;
      const index = Math.floor((Date.parse(event.timestamp) - first) / MINUTE_MS);
      if (index < 0 || index >= minutes) continue;
      (event.type === 'run' ? runs : hints)[index]++;
    }
  }
  return runs.map((count, index) => ({
    start: first + index * MINUTE_MS,
    runs: count,
    hints: hints[index],
  }));
}
