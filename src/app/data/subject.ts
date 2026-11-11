import type { Translatable } from './localized-text';

/**
 * Table `subject` («Programación básica»): what a group studies, managed by administrators (2.5c).
 * It does not assume programming: the kind of each exercise decides its editor and its checks (D-029).
 */
export interface Subject extends Translatable<{ readonly name: string }> {
  readonly id: string;
  /** In `sourceLocale`; `subjectName()` picks the one of the interface. */
  readonly name: string;
}

/** Table `exercise_subject`: a subject an exercise of the bank is meant for, to filter it (4.3). */
export interface ExerciseSubject {
  readonly exerciseId: string;
  readonly subjectId: string;
}
