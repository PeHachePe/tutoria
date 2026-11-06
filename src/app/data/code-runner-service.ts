import type { RunResult } from './attempt';

/**
 * Runs every test of an attempt and returns its new status (2.5). Abstract class without a decorator:
 * it is the injection token (4.2, D-005).
 */
export abstract class CodeRunnerService {
  /** Runs `code`, the current editor content, which may not be saved yet. */
  abstract run(attemptId: string, code: string): Promise<RunResult>;
}
