import type { RunLoadError, RunResult, TestResult } from '../../attempt';
import type { Test } from '../../exercise';
import { outputsEqual } from './output-value';
import type { TestOutcome } from './run-protocol';

/** What came back from the Worker: an outcome per test that ended in time, or why none ran. */
export interface WorkerOutcome {
  /** By test position; missing from the first test that did not end in time. */
  readonly outcomes: readonly TestOutcome[];
  readonly loadError?: RunLoadError;
}

/**
 * The result of a run, compared outside the student's code as the server will do (2.5): visible
 * tests carry their input, the expected value and what the code returned or the error it threw;
 * hidden ones, only whether they passed. The attempt passes only if every test passes.
 */
export function buildRunResult(tests: readonly Test[], outcome: WorkerOutcome): RunResult {
  const { loadError } = outcome;
  if (loadError) {
    return {
      status: 'tests_failed',
      results: tests.map((test) => ({ testId: test.id, passed: false, timeout: false })),
      loadError,
    };
  }
  const results = tests.map((test, index) => testResult(test, outcome.outcomes.at(index)));
  const passed = results.length > 0 && results.every((result) => result.passed);
  return { status: passed ? 'passed' : 'tests_failed', results };
}

function testResult(test: Test, outcome: TestOutcome | undefined): TestResult {
  const result = {
    testId: test.id,
    passed: outcome?.ok === true && outputsEqual(outcome.value, test.expectedOutput),
    timeout: outcome === undefined,
  };
  if (test.isHidden) return result;
  const details = { ...result, input: test.input, expected: test.expectedOutput };
  if (!outcome) return details;
  return outcome.ok ? { ...details, actual: outcome.value } : { ...details, error: outcome.error };
}
