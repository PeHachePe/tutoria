import type { RunResult } from './attempt';
import type { SolutionCheck } from './code-runner/run-result';

/**
 * Runs every test of an attempt and returns its new status (2.5). Abstract class without a decorator:
 * it is the injection token (4.2, D-005).
 */
export abstract class CodeRunnerService {
  /** Runs `code`, the current editor content, which may not be saved yet. */
  abstract run(attemptId: string, code: string): Promise<RunResult>;

  /**
   * «Probar mi solución» (4.3c, D-059): runs the teacher's solution against the tests of the form,
   * saved or not, and gives every result with its details, hidden tests too. Nothing is kept.
   * `forbidden` for a student.
   */
  abstract check(check: SolutionCheck): Promise<RunResult>;
}
