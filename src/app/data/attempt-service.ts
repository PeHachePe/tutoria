import type { Attempt, AttemptHistory } from './attempt';

/**
 * The student's attempts. Only the server (or the mock service) changes their status (2.4).
 * Abstract class without a decorator: it is the injection token (4.2, D-005).
 */
export abstract class AttemptService {
  /** The student's attempt at the exercise, created in `in_progress` if there is none. */
  abstract openOrCreate(exerciseId: string): Promise<Attempt>;

  /** Saves the code; an attempt in `tests_failed` or `passed` goes back to `in_progress`. */
  abstract saveCode(attemptId: string, code: string): Promise<Attempt>;

  /** From `passed` to `submitted`, freezing the final code. Throws `DataError('invalid')` from any other status. */
  abstract submit(attemptId: string): Promise<Attempt>;

  /** The attempt with its events and its tutor interactions, for the timeline. */
  abstract history(attemptId: string): Promise<AttemptHistory>;
}
