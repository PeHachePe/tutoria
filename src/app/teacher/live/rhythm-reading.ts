import type { ActivityMinute } from './activity-by-minute';

/** Minutes compared with the same number before them. */
export const RHYTHM_MINUTES = 10;

/** The activity has dropped under this share of the minutes before. */
export const RHYTHM_DROP = 0.5;

/**
 * What the rhythm of the class says (D-068): it works at a good pace, it is getting stuck (more
 * hints and fewer runs), it has slowed down (stopped or finishing), or it has just started.
 */
export type RhythmReading = 'starting' | 'stuck' | 'slowing' | 'steady';

/**
 * The reading of the chart «Ritmo de la clase», comparing the last `RHYTHM_MINUTES` with the ones
 * before, or null without any run or hint. `minutes`, as `activityByMinute()` gives them: the
 * current one last.
 */
export function rhythmReading(minutes: readonly ActivityMinute[]): RhythmReading | null {
  const total = (items: readonly ActivityMinute[]) =>
    items.reduce(
      (sum, minute) => ({ runs: sum.runs + minute.runs, hints: sum.hints + minute.hints }),
      { runs: 0, hints: 0 },
    );
  const all = total(minutes);
  if (all.runs + all.hints === 0) return null;
  const now = total(minutes.slice(-RHYTHM_MINUTES));
  const earlier = total(minutes.slice(0, -RHYTHM_MINUTES));
  if (earlier.runs + earlier.hints === 0) return 'starting';
  const before = total(minutes.slice(-2 * RHYTHM_MINUTES, -RHYTHM_MINUTES));
  if (now.hints > before.hints && now.runs < before.runs) return 'stuck';
  if (now.runs + now.hints < RHYTHM_DROP * (before.runs + before.hints)) return 'slowing';
  return 'steady';
}
