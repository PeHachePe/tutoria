import { inject, Service } from '@angular/core';

import type { RunResult } from '../../../data/attempt';
import type { CheckTest, SolutionCheck } from '../../../data/code-runner/run-result';
import { CodeRunnerService } from '../../../data/code-runner-service';
import { DataError } from '../../../data/data-error';
import { TryoutAttemptService } from './tryout-attempt-service';
import { TRYOUT_EXERCISE } from './tryout-exercise';

/**
 * «Ejecutar» in a try (4.3e, D-061): the code runs against the tests of the form on the server, as
 * «Probar mi solución» does (`check`, in `execute` without an attempt), and the result is shown as
 * a student sees it, the hidden tests only passed or not. The run is recorded in the try, never on
 * the server.
 */
@Service({ autoProvided: false })
export class TryoutCodeRunner extends CodeRunnerService {
  /** The runner of the app: this one takes its place only inside the try. */
  private readonly runner = inject(CodeRunnerService, { skipSelf: true });
  private readonly exercise = inject(TRYOUT_EXERCISE);
  private readonly attempts = inject(TryoutAttemptService);

  async run(attemptId: string, code: string): Promise<RunResult> {
    if (this.attempts.find(attemptId).status === 'submitted') {
      throw new DataError('invalid', 'The attempt is submitted');
    }
    const { functionName } = this.exercise.content.exercise;
    const { tests } = this.exercise;
    const result = concealHidden(await this.runner.check({ code, functionName, tests }), tests);
    this.attempts.recordRun(attemptId, code, result);
    return result;
  }

  check(check: SolutionCheck): Promise<RunResult> {
    return this.runner.check(check);
  }
}

/**
 * The result as `execute` gives it to a student: the hidden tests only say whether they passed or
 * timed out, without their input, values or error (2.3).
 */
export function concealHidden(result: RunResult, tests: readonly CheckTest[]): RunResult {
  return {
    ...result,
    results: result.results.map((test, index) =>
      tests[index]?.isHidden
        ? { testId: test.testId, passed: test.passed, timeout: test.timeout }
        : test,
    ),
  };
}
