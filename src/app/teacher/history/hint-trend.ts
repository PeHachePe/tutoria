import type { BlockStats } from '../../data/stats-service';
import { averageHints, isRepresentative, isStarted } from './history-figures';

/** Difference in hints per exercise under which the first and the last block read the same. */
export const TREND_TOLERANCE = 0.1;

/** How the hints of a group go, from its first block to its last (ficha 09). */
export interface HintTrend {
  readonly kind: 'falling' | 'rising' | 'steady';
  readonly first: BlockStats;
  readonly last: BlockStats;
}

/**
 * Compares the first and the last of the blocks worked on by half the class, in order: a falling
 * trend suggests growing autonomy (Figura 19). Null with fewer than two of them.
 */
export function hintTrend(blocks: readonly BlockStats[], students: number): HintTrend | null {
  const read = blocks.filter((block) => isStarted(block) && isRepresentative(block, students));
  if (read.length < 2) return null;
  const first = read[0];
  const last = read[read.length - 1];
  const change = averageHints(last) - averageHints(first);
  const kind =
    change < -TREND_TOLERANCE ? 'falling' : change > TREND_TOLERANCE ? 'rising' : 'steady';
  return { kind, first, last };
}
