import type { Attempt, AttemptHistory } from './attempt';

/**
 * The student's attempts. Only the server (or the mock service) changes their status (2.4).
 * Abstract class without a decorator: it is the injection token (4.2, D-005).
 */
export abstract class AttemptService {
  /**
   * The student's latest attempt at the assignment, created in `in_progress` as number 1 if there is
   * none; with `number`, that one, never created. Throws `DataError('not_found')` if the student
   * cannot open the assignment (not theirs, or hidden) or there is no such attempt.
   */
  abstract openOrCreate(assignmentId: string, number?: number): Promise<Attempt>;

  /** The student's attempts at the assignment, by number: the selector of the workspace. */
  abstract list(assignmentId: string): Promise<Attempt[]>;

  /**
   * «Practicar de nuevo»: a new attempt with the next number and the editor empty, once the latest
   * is submitted. If the latest is still open (another tab practised first), that one. Throws
   * `DataError('invalid')` without a submitted attempt.
   */
  abstract retry(assignmentId: string): Promise<Attempt>;

  /** Saves the code; an attempt in `tests_failed` or `passed` goes back to `in_progress`. */
  abstract saveCode(attemptId: string, code: string): Promise<Attempt>;

  /** From `passed` to `submitted`, freezing the final code. Throws `DataError('invalid')` from any other status. */
  abstract submit(attemptId: string): Promise<Attempt>;

  /** The attempt with its events and its tutor interactions, for the timeline. */
  abstract history(attemptId: string): Promise<AttemptHistory>;
}
