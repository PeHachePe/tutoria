import type { AssignedExercise, Difficulty, Exercise, ExerciseDetail, Test } from './exercise';
import type { ContentLocale, ExerciseText, ExerciseTranslations } from './localized-text';
import type { Subject } from './subject';

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
  readonly parameters: readonly string[];
  readonly maxRepeatedFailures: number;
  readonly maxIdleMinutes: number;
  /** The subjects the exercise is meant for, to filter the bank (`exercise_subject`). */
  readonly subjectIds: readonly string[];
  readonly tests: readonly TestDraft[];
}

/**
 * What «Traducir con IA» asks (4.3c, D-059): the texts of the original as the form has them, and the
 * code they cite, which the translation keeps as it is (D-045).
 */
export interface TranslationRequest {
  readonly from: ContentLocale;
  readonly to: ContentLocale;
  readonly texts: ExerciseText;
  readonly functionName: string;
  readonly parameters: readonly string[];
}

/** How an exercise is used: what warns before changing or deleting it. */
export interface ExerciseUsage {
  /** Students who have started it, in any group: changing its tests changes what they did. */
  readonly studentCount: number;
  /** The groups where it is assigned that the user manages, by name. */
  readonly groups: readonly { readonly id: string; readonly name: string }[];
}

/** Exercise with all its tests, hidden ones included: only for teachers. */
export interface ExerciseWithTests extends ExerciseUsage {
  readonly exercise: Exercise;
  readonly tests: readonly Test[];
  readonly subjectIds: readonly string[];
}

/** An exercise of the bank, with what the teacher needs to find it and choose it (4.3). */
export interface BankExercise extends ExerciseUsage {
  readonly exercise: Exercise;
  readonly subjectIds: readonly string[];
  readonly testCount: number;
}

/**
 * Which part of the bank to bring (4.3): it is shared by every subject of the centre, and a teacher
 * only needs theirs, so what downloads grows with their subjects, not with the centre.
 */
export type BankScope =
  /** The subjects of the groups the user teaches; all if they teach none (the administration). */
  | { readonly kind: 'mine' }
  | { readonly kind: 'subject'; readonly subjectId: string }
  | { readonly kind: 'all' };

/** The subjects of a scope, or null for every exercise. */
export function scopeSubjectIds(
  scope: BankScope,
  mySubjectIds: readonly string[],
): readonly string[] | null {
  switch (scope.kind) {
    case 'subject':
      return [scope.subjectId];
    case 'mine':
      // Somebody who teaches no group, such as the administration, sees the whole bank
      return mySubjectIds.length > 0 ? mySubjectIds : null;
    case 'all':
      return null;
  }
}

/** A part of the bank shared by every teacher, with the subjects to choose another part. */
export interface ExerciseBank {
  /** The exercises of the scope, newest first. */
  readonly exercises: readonly BankExercise[];
  /** Every subject, to choose. */
  readonly subjects: readonly Subject[];
  /** The subjects of the groups the user teaches: «Mis asignaturas». */
  readonly mySubjectIds: readonly string[];
}

/**
 * Exercises and their tests; the assignments are in `BlockService` (4.3b). Abstract class without a decorator: it is the injection
 * token (4.2, D-005). Every teacher reads the whole bank, but only its author or the administration
 * changes or deletes an exercise (4.3, D-057).
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

  /** Every subject, to classify an exercise. */
  abstract listSubjects(): Promise<Subject[]>;

  /** The part of the bank of a scope: by default, the user's subjects. */
  abstract listBank(scope: BankScope): Promise<ExerciseBank>;

  abstract getWithTests(exerciseId: string): Promise<ExerciseWithTests>;

  /** Creates the exercise, its tests and its subjects at once, written by the user. */
  abstract create(draft: ExerciseDraft): Promise<Exercise>;

  /**
   * Saves the exercise and replaces its tests and its subjects at once. `forbidden` if the user is
   * neither its author nor the administration.
   */
  abstract update(exerciseId: string, draft: ExerciseDraft): Promise<Exercise>;

  /**
   * `invalid` if someone has started it (their attempts keep it) or it is assigned in the groups of
   * another teacher (D-062). `forbidden` as `update`.
   */
  abstract remove(exerciseId: string): Promise<void>;

  /**
   * Archives the exercise, or brings it back to the bank (4.3d, D-060). Its assignments and their
   * attempts stay. `forbidden` as `update`.
   */
  abstract setArchived(exerciseId: string, archived: boolean): Promise<Exercise>;

  /**
   * The draft of a translation (4.3c, D-059), for the teacher to review: nothing is saved.
   * `forbidden` for a student, `unavailable` without the AI and `rate_limited` past its limit.
   */
  abstract translate(request: TranslationRequest): Promise<ExerciseText>;
}
