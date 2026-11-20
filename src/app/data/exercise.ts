import type { AttemptStatus } from './attempt';
import type { AttemptSummary } from './attempt-progress';
import type { Translatable, TranslatableExercise } from './localized-text';
import type { Subject } from './subject';
import type { HintLevel } from './tutor';

export type Difficulty = 'initial' | 'medium' | 'advanced' | 'extension';

export type Language = 'javascript';

/** Thresholds of the proactive tutor, set per exercise. */
export interface StuckThresholds {
  /** Consecutive runs in which the same test fails. */
  readonly maxRepeatedFailures: number;
  /** Minutes without any activity from the student. */
  readonly maxIdleMinutes: number;
}

/**
 * Table `exercise`. Its texts are in `sourceLocale`, with their translations; `exerciseText()` picks
 * the ones of the interface (D-045). Its code is in English in every language.
 */
export interface Exercise extends StuckThresholds, TranslatableExercise {
  readonly id: string;
  readonly difficulty: Difficulty;
  readonly language: Language;
  /** Name of the function the student must write, the same in every language; each test calls it. */
  readonly functionName: string;
  /**
   * The names of its parameters, in English like the function (D-057): the tutor's skeleton uses
   * them, so it never makes up others. Empty in exercises without them, and then the tutor picks.
   */
  readonly parameters: readonly string[];
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  /**
   * When its author retired it from the bank (4.3d, D-060), as an ISO date, or null. Its
   * assignments and the attempts at them stay; it is only left out of the bank and of «Añadir».
   */
  readonly archivedAt: string | null;
}

/** Table `test`: calls the exercise function with `input` and compares the result with `expectedOutput` as JSON. */
export interface Test {
  readonly id: string;
  readonly exerciseId: string;
  /** List of arguments: a single array argument goes inside another list (`[[1, 2, 3]]`). */
  readonly input: readonly unknown[];
  readonly expectedOutput: unknown;
  /** Hidden tests only show whether they passed. */
  readonly isHidden: boolean;
  readonly position: number;
}

/**
 * Table `class_block`: a block of exercises of a group, with a free title the teacher writes and
 * translates («Tema 1: Bucles», «Repaso del tema 1», «Recuperación del examen», 2.5c).
 */
export interface ClassBlock extends Translatable<{ readonly title: string }> {
  readonly id: string;
  readonly groupId: string;
  /** Only sorts the blocks of the group; never shown. */
  readonly position: number;
  /** In `sourceLocale`; `blockTitle()` picks the one of the interface. */
  readonly title: string;
  /** Hidden from the students, with all its exercises, while the teacher prepares it. */
  readonly isHidden: boolean;
  /**
   * When its students start to see it (4.3d, D-060), as an ISO date, or null to see it as soon as
   * it is visible: a resit that appears by itself on the day of the exam.
   */
  readonly opensAt: string | null;
}

/** Table `exercise_assignment`: an exercise in a block of a group. */
export interface ExerciseAssignment {
  readonly id: string;
  readonly groupId: string;
  readonly blockId: string;
  readonly exerciseId: string;
  /** Sorts the exercises of the block (4.3b); never shown. */
  readonly position: number;
  /** Hidden from the students, as the whole block can be. */
  readonly isHidden: boolean;
  /** Optional due date the students see in the catalog (D-054), as an ISO date, or null. */
  readonly dueAt: string | null;
}

/** The group of an assigned exercise, with its subject: the tabs of the catalog. */
export interface AssignedGroup {
  readonly id: string;
  /** The name of its class (5.2d). */
  readonly name: string;
  /** What tells a split apart, or null for the group of the whole class (5.2d). */
  readonly label: string | null;
  readonly subject: Subject;
}

/**
 * A card of the student's catalog. Status, hints and dates are those of the attempt that counts for
 * the class (`countedAttempt()`); the practice after it goes apart (2.5c).
 */
export interface AssignedExercise {
  readonly exercise: Exercise;
  readonly assignmentId: string;
  readonly group: AssignedGroup;
  readonly block: ClassBlock;
  /** Due date of the assignment (D-054), or null. */
  readonly dueAt: string | null;
  /** Last change of the attempt that counts, or null without one. */
  readonly updatedAt: string | null;
  /** Status of the attempt that counts, or `not_started`. */
  readonly status: AttemptStatus;
  /** Hints the student asked for («Pedir pista») in the attempt that counts. */
  readonly hintCount: number;
  /** Highest hint level the tutor reached in the attempt that counts, or null without interactions. */
  readonly hintLevel: HintLevel | null;
  /** The latest attempt after the one that counts («Practicar de nuevo»), or null. */
  readonly practice: AttemptSummary | null;
  /** Attempts started after the one that counts: «Repetido 2 veces». */
  readonly repetitions: number;
}

/** What the workspace needs: the exercise of an assignment, where it is and its visible tests. */
export interface ExerciseDetail {
  readonly exercise: Exercise;
  readonly assignmentId: string;
  readonly group: AssignedGroup;
  readonly block: ClassBlock;
  /** Due date of the assignment (D-054), or null. */
  readonly dueAt: string | null;
  /** Sorted by position. */
  readonly visibleTests: readonly Test[];
  /** Hidden tests are counted but never sent to the student. */
  readonly hiddenTestCount: number;
}
