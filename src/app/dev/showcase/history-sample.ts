import type { ClassBlock } from '../../data/exercise';
import type { BlockStats, DeadlineStats } from '../../data/stats-service';

/** Students of the sample group of the history. */
export const SAMPLE_HISTORY_STUDENTS = 24;

function block(id: string, title: string): ClassBlock {
  return {
    id,
    groupId: 'sample',
    position: 1,
    title,
    sourceLocale: 'es',
    translations: {},
    isHidden: false,
    opensAt: null,
  };
}

/** A falling series, as in the seed, with a resit few students worked on, in grey. */
export const SAMPLE_HISTORY_BLOCKS: readonly BlockStats[] = [
  ['t1', 'Tema 1: Bucles', 48, 54],
  ['t2', 'Tema 2: Vectores', 48, 27],
  ['t3', 'Tema 3: Recorridos', 23, 8],
  ['t4', 'Tema 4: Cadenas', 59, 0],
  ['r2', 'Recuperación del tema 2', 1, 1],
].map(([id, title, attempts, hints]) => ({
  block: block(id as string, title as string),
  assignments: 2,
  attempts: attempts as number,
  activeStudents: Math.min(attempts as number, SAMPLE_HISTORY_STUDENTS),
  hints: hints as number,
  solved: attempts as number,
  medianSeconds: 600,
  stuckStudents: 0,
  exercises: [],
}));

/** A past due date with some of everything, to see every line of the card. */
export const SAMPLE_DEADLINE: DeadlineStats = {
  blockId: 't4',
  dueAt: '2026-11-06T22:59:00.000Z',
  assignments: 3,
  onTime: 52,
  lastHours: 14,
  late: 3,
  missing: [
    { student: { id: 'a', name: 'Aya Benali' }, pending: 2 },
    { student: { id: 'h', name: 'Hugo Martín' }, pending: 1 },
  ],
};
