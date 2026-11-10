import type { RunOutcome, RunRequest } from '../../../src/app/data/code-runner/run-result.ts';

/**
 * Where the student's code runs, isolated from the function and its secrets (D-042). It only gets
 * the code and the inputs, never the expected values: the function compares outside. Today it is
 * QuickJS inside the function (`QuickJsSandbox`); another language, or another engine such as
 * Judge0, is another class with this same method, wired in `index.ts`.
 */
export interface CodeSandbox {
  /**
   * An outcome per test that ended in time, or why none ran. It rejects only when the sandbox
   * itself fails, never because of the student's code.
   */
  run(request: RunRequest): Promise<RunOutcome>;
}
