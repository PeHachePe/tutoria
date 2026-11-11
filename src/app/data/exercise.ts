import type { AttemptStatus } from './attempt';
import type { TranslatableExercise } from './exercise-text';
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
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
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

/** Table `exercise_assignment`: an exercise assigned to a group in a session. */
export interface ExerciseAssignment {
  readonly id: string;
  readonly groupId: string;
  readonly exerciseId: string;
  readonly session: number;
}

/** Table `class_session`: a class session of a group, with an optional title («Bucles»). */
export interface ClassSession {
  readonly id: string;
  readonly groupId: string;
  /** Order of the session in the group; assignments refer to it with `(groupId, session)`. */
  readonly number: number;
  readonly title: string | null;
}

/** A card of the student's catalog. */
export interface AssignedExercise {
  readonly exercise: Exercise;
  readonly assignmentId: string;
  readonly session: number;
  /** Title the teacher gave the session, or null to show just its number. */
  readonly sessionTitle: string | null;
  /** Last change of the student's latest attempt, or null without one. */
  readonly updatedAt: string | null;
  /** Status of the student's latest attempt, or `not_started`. */
  readonly status: AttemptStatus;
  /** Hints the student asked for («Pedir pista») in the latest attempt. */
  readonly hintCount: number;
  /** Highest hint level the tutor reached in the latest attempt, or null without interactions. */
  readonly hintLevel: HintLevel | null;
}

/** What the workspace needs: the exercise and its visible tests, sorted by position. */
export interface ExerciseDetail {
  readonly exercise: Exercise;
  readonly visibleTests: readonly Test[];
  /** Hidden tests are counted but never sent to the student. */
  readonly hiddenTestCount: number;
}
