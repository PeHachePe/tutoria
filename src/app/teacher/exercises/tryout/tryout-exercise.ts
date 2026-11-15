import { InjectionToken } from '@angular/core';

import type { CheckTest } from '../../../data/code-runner/run-result';
import type { StatementContent } from '../../../student/workspace/statement-zone/statement-zone';

/**
 * The exercise a teacher tries as a student (4.3e, D-061), as it is in the form, saved or not: what
 * the student reads, and every test as the teacher wrote it, hidden ones included.
 */
export interface TryoutExercise {
  readonly content: StatementContent;
  readonly tests: readonly CheckTest[];
}

/** The exercise of the try, provided by the dialog that opens it. */
export const TRYOUT_EXERCISE = new InjectionToken<TryoutExercise>('TRYOUT_EXERCISE');

/** The assignment of a try: there is none, so the workspace opens this one, kept in memory. */
export const TRYOUT_ASSIGNMENT_ID = 'tryout';
