import type { BlockStats, WorkStats } from '../../data/stats-service';

/** A block reads the trend once at least this share of the class worked on it (D-073). */
export const REPRESENTATIVE_SHARE = 0.5;

const PERCENT = 100;

/** Somebody opened an exercise of the block. */
export function isStarted(block: BlockStats): boolean {
  return block.attempts > 0;
}

/**
 * At least half the class worked on the block: a resit with one student would turn the reading of
 * the trend around, so it is drawn in grey and left out of it.
 */
export function isRepresentative(block: BlockStats, students: number): boolean {
  return students > 0 && block.activeStudents >= students * REPRESENTATIVE_SHARE;
}

/** Hints per attempt that counts, that is, per student and exercise; 0 without attempts. */
export function averageHints(block: WorkStats): number {
  return block.attempts ? block.hints / block.attempts : 0;
}

/** Solved attempts over students × assignments, 0 to 100, rounded; 0 without any to solve. */
export function solvedPercent(block: BlockStats, students: number): number {
  const total = students * block.assignments;
  return total ? Math.round((block.solved / total) * PERCENT) : 0;
}

/** «1,1»: one decimal, as the language writes it. */
export function formatAverage(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/** «57 %»: a share from 0 to 100, as the language writes it. */
export function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent' }).format(value / PERCENT);
}

/**
 * The block the figures are of: the one of the URL if it is started; else the latest worked on by
 * half the class and, without any, the latest started. Null if nobody started any.
 */
export function pickBlock(
  blocks: readonly BlockStats[],
  students: number,
  blockId: string | undefined,
): BlockStats | null {
  const started = blocks.filter(isStarted);
  return (
    started.find((block) => block.block.id === blockId) ??
    started.filter((block) => isRepresentative(block, students)).at(-1) ??
    started.at(-1) ??
    null
  );
}
