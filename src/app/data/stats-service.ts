import type { ClassBlock } from './exercise';
import type { LiveStudent } from './live-service';
import type { TranslatableExercise } from './localized-text';

/** Hours before a due date that count as its last ones (D-054, D-073). */
export const DEADLINE_LAST_HOURS = 24;

/**
 * What a group did, in raw counts: the screen works out means and shares. Only the attempt that
 * counts of each student and assignment (`countedAttempt()`), of those enrolled now: practice does not
 * change the data of the class (D-046).
 */
export interface WorkStats {
  /** Attempts that count. */
  readonly attempts: number;
  /** Students with some of those attempts. */
  readonly activeStudents: number;
  /** Hints asked for in those attempts. */
  readonly hints: number;
  /** Attempts passed or submitted. */
  readonly solved: number;
  /** Median seconds from opening an exercise to submitting it; null with none submitted. */
  readonly medianSeconds: number | null;
  /** Students who, at some point, failed one same test as many runs in a row as its exercise allows. */
  readonly stuckStudents: number;
}

/** What a group did in an exercise of a block: where to look when going over the block (D-073). */
export interface ExerciseStats extends WorkStats {
  readonly assignmentId: string;
  readonly exercise: TranslatableExercise;
}

/** What a group did in a block, and in each of its exercises. */
export interface BlockStats extends WorkStats {
  readonly block: ClassBlock;
  /** Assignments that count: those the students see or somebody worked on. */
  readonly assignments: number;
  /** One per assignment that counts, in the order of the block. */
  readonly exercises: readonly ExerciseStats[];
}

/** A student with exercises of a deadline not submitted. */
export interface MissingSubmission {
  readonly student: LiveStudent;
  readonly pending: number;
}

/** A due date of a block and what arrived for it, counting what its students see now. */
export interface DeadlineStats {
  readonly blockId: string;
  readonly dueAt: string;
  /** Assignments of the block with this due date. */
  readonly assignments: number;
  /** Submitted up to the date, its last hours included. */
  readonly onTime: number;
  /** Of `onTime`, those in the last `DEADLINE_LAST_HOURS`. */
  readonly lastHours: number;
  /** Submitted after the date. */
  readonly late: number;
  /** By name. */
  readonly missing: readonly MissingSubmission[];
}

/** The history of a group (/docente/historico, ficha 09, D-073). */
export interface GroupHistory {
  /** Students enrolled now. */
  readonly students: number;
  /** Every block of the group, in order, also those nobody started. */
  readonly blocks: readonly BlockStats[];
  /** By date and, on the same date, by the order of their blocks. */
  readonly deadlines: readonly DeadlineStats[];
}

/** Statistics of a group. Abstract class without a decorator: it is the injection token (4.2, D-005). */
export abstract class StatsService {
  /** `not_found` for a group the user does not teach. */
  abstract groupHistory(groupId: string): Promise<GroupHistory>;
}
