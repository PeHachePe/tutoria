import type { AttemptStatus } from './attempt';
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

/** Table `exercise`. */
export interface Exercise extends StuckThresholds {
  readonly id: string;
  readonly title: string;
  readonly statement: string;
  readonly difficulty: Difficulty;
  /** What the exercise practises, shown under its title in the catalog («Vectores», «acumulador»). */
  readonly topics: readonly string[];
  readonly language: Language;
  /** Name of the function the student must write; each test calls it. */
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

/** A card of the student's catalog. */
export interface AssignedExercise {
  readonly exercise: Exercise;
  readonly assignmentId: string;
  readonly session: number;
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
