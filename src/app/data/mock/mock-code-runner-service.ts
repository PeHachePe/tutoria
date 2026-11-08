import { inject, Service } from '@angular/core';

import type { RunResult } from '../attempt';
import { CodeRunnerService } from '../code-runner-service';
import { DataError } from '../data-error';
import { buildRunResult, type WorkerOutcome } from './code-runner/build-run-result';
import { CODE_RUNNER_WORKER } from './code-runner/code-runner-worker';
import type { RunMessage, RunRequest, TestOutcome } from './code-runner/run-protocol';
import { findOwnAttempt, findRow, now } from './mock-access';
import { MockDb } from './mock-db';
import { MockNetwork } from './mock-network';

/** Time the tests have to run once the Worker starts them; then the pending ones time out. */
export const RUN_TIME_LIMIT_MS = 2000;

/**
 * Runs the tests in a Web Worker (4.3) and does what the Edge Function `execute` will do (2.3):
 * saves the code, compares outside the student's code, sets `passed` or `tests_failed` and records
 * the `run` event. The page ends the Worker after the time limit, so an endless loop never hangs it.
 */
@Service({ autoProvided: false })
export class MockCodeRunnerService extends CodeRunnerService {
  private readonly db = inject(MockDb);
  private readonly network = inject(MockNetwork);
  private readonly createWorker = inject(CODE_RUNNER_WORKER);

  async run(attemptId: string, code: string): Promise<RunResult> {
    const { functionName, tests } = await this.network.request(() => {
      const tables = this.db.tables();
      const attempt = findOwnAttempt(tables, this.db.requireUser(), attemptId);
      if (attempt.status === 'submitted') {
        throw new DataError('invalid', 'A submitted attempt cannot run again');
      }
      return {
        functionName: findRow(tables.exercises, attempt.exerciseId).functionName,
        tests: tables.tests
          .filter((test) => test.exerciseId === attempt.exerciseId)
          .sort((a, b) => a.position - b.position),
      };
    });
    const outcome = await this.execute({
      code,
      functionName,
      inputs: tests.map((test) => test.input),
    });
    const result = buildRunResult(tests, outcome);
    this.record(attemptId, code, result);
    return result;
  }

  /** Runs the request in a new Worker and gathers what it reports until it ends or runs out of time. */
  private execute(request: RunRequest): Promise<WorkerOutcome> {
    return new Promise((resolve, reject) => {
      const worker = this.createWorker();
      const outcomes: TestOutcome[] = [];
      let timer: ReturnType<typeof setTimeout> | undefined;
      const stop = () => {
        clearTimeout(timer);
        worker.terminate();
      };
      const finish = (outcome: WorkerOutcome) => {
        stop();
        resolve(outcome);
      };
      worker.onmessage = ({ data }: MessageEvent<RunMessage>) => {
        switch (data.type) {
          case 'started':
            // Counted from here, so downloading the Worker on a slow device takes no time from it
            timer = setTimeout(() => finish({ outcomes }), RUN_TIME_LIMIT_MS);
            break;
          case 'result':
            outcomes[data.index] = data.outcome;
            break;
          case 'load_error':
            finish({ outcomes, loadError: data.error });
            break;
          case 'done':
            finish({ outcomes });
            break;
        }
      };
      // The Worker could not start (its file did not download) or broke outside the student's code
      worker.onerror = (event) => {
        event.preventDefault();
        stop();
        reject(new DataError('unknown', 'The code runner failed'));
      };
      worker.postMessage(request);
    });
  }

  /** What the server keeps of a run: the code, the new status and the `run` event (2.8). */
  private record(attemptId: string, code: string, result: RunResult): void {
    const timestamp = now();
    const failedTestIds = result.results.filter((test) => !test.passed).map((test) => test.testId);
    this.db.update('attempts', (rows) =>
      rows.map((row) =>
        row.id === attemptId
          ? { ...row, currentCode: code, status: result.status, updatedAt: timestamp }
          : row,
      ),
    );
    this.db.update('events', (rows) => [
      ...rows,
      {
        id: crypto.randomUUID(),
        attemptId,
        type: 'run',
        timestamp,
        detail: {
          passed: result.results.length - failedTestIds.length,
          failed: failedTestIds.length,
          failedTestIds,
        },
      },
    ]);
  }
}
