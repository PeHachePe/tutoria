import type { ClassBlock } from '../../data/exercise';
import type { BlockStats, DeadlineStats, ExerciseStats } from '../../data/stats-service';

/** A block of the history tests, titled as its id. */
export function testBlock(id: string, position = 1): ClassBlock {
  return {
    id,
    groupId: 'g1',
    position,
    title: id,
    sourceLocale: 'es',
    translations: {},
    isHidden: false,
    opensAt: null,
  };
}

/** The figures of a block worked on by 20 students, with `changes`. */
export function blockStats(id: string, changes: Partial<BlockStats> = {}): BlockStats {
  return {
    block: testBlock(id),
    assignments: 2,
    attempts: 40,
    activeStudents: 20,
    hints: 20,
    solved: 30,
    medianSeconds: 600,
    stuckStudents: 0,
    exercises: [],
    ...changes,
  };
}

/** An exercise of a block, titled `title`, with `changes`. */
export function exerciseStats(title: string, changes: Partial<ExerciseStats> = {}): ExerciseStats {
  return {
    assignmentId: title,
    exercise: { title, statement: '', topics: [], sourceLocale: 'es', translations: {} },
    attempts: 20,
    activeStudents: 20,
    hints: 10,
    solved: 15,
    medianSeconds: 600,
    stuckStudents: 0,
    ...changes,
  };
}

/** A due date of block `blockId`, with `changes`. */
export function deadlineStats(
  blockId: string,
  dueAt: string,
  changes: Partial<DeadlineStats> = {},
): DeadlineStats {
  return {
    blockId,
    dueAt,
    assignments: 2,
    onTime: 0,
    lastHours: 0,
    late: 0,
    missing: [],
    ...changes,
  };
}
