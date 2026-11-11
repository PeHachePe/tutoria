import type {
  AssignedExercise,
  Difficulty,
  Exercise,
  ExerciseAssignment,
  ExerciseDetail,
  Test,
} from './exercise';
import type { ContentLocale, ExerciseTranslations } from './localized-text';

/** Test as the teacher edits it: the database assigns its id and its exercise. */
export type TestDraft = Omit<Test, 'id' | 'exerciseId'>;

/** Exercise as the teacher edits it, with all its tests. */
export interface ExerciseDraft {
  readonly title: string;
  readonly statement: string;
  readonly difficulty: Difficulty;
  readonly topics: readonly string[];
  /** The language of `title`, `statement` and `topics`. */
  readonly sourceLocale: ContentLocale;
  readonly translations: ExerciseTranslations;
  readonly functionName: string;
  readonly maxRepeatedFailures: number;
  readonly maxIdleMinutes: number;
  readonly tests: readonly TestDraft[];
}

/** Exercise with all its tests, hidden ones included: only for teachers. */
export interface ExerciseWithTests {
  readonly exercise: Exercise;
  readonly tests: readonly Test[];
}

/**
 * Exercises, their tests and their assignments. Abstract class without a decorator: it is the injection
 * token (4.2, D-005). The teacher's operations are refined in step 4.3.
 */
export abstract class ExerciseService {
  /**
   * Exercises assigned to the student's groups that they can see (neither the assignment nor its
   * block hidden), sorted by group, block and assignment, with the attempt that counts and the
   * practice after it (2.5c).
   */
  abstract listAssigned(userId: string): Promise<AssignedExercise[]>;

  /**
   * The exercise of an assignment, with its group, its block and its visible tests. Throws
   * `DataError('not_found')` if the student cannot see it.
   */
  abstract getDetail(assignmentId: string): Promise<ExerciseDetail>;

  /** The exercise bank, shared by all teachers. */
  abstract list(): Promise<Exercise[]>;

  abstract getWithTests(exerciseId: string): Promise<ExerciseWithTests>;

  abstract create(draft: ExerciseDraft): Promise<Exercise>;

  abstract update(exerciseId: string, draft: ExerciseDraft): Promise<Exercise>;

  abstract remove(exerciseId: string): Promise<void>;

  abstract listAssignments(groupId: string): Promise<ExerciseAssignment[]>;

  abstract assign(assignment: Omit<ExerciseAssignment, 'id'>): Promise<ExerciseAssignment>;

  abstract unassign(assignmentId: string): Promise<void>;
}
