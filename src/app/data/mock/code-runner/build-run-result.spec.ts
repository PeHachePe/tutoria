import type { Test } from '../../exercise';
import { buildRunResult } from './build-run-result';

function test(id: string, input: unknown[], expectedOutput: unknown, isHidden = false): Test {
  return { id, exerciseId: 'e', input, expectedOutput, isHidden, position: 0 };
}

const TESTS = [test('t1', [[1, 2, 3]], 6), test('t2', [[]], 0), test('t3', [[7, -3, 1]], 5, true)];

describe('buildRunResult', () => {
  it('passes the attempt when every test, visible and hidden, gets its expected value', () => {
    const result = buildRunResult(TESTS, {
      outcomes: [
        { ok: true, value: 6 },
        { ok: true, value: 0 },
        { ok: true, value: 5 },
      ],
    });

    expect(result).toEqual({
      status: 'passed',
      results: [
        { testId: 't1', passed: true, timeout: false, input: [[1, 2, 3]], expected: 6, actual: 6 },
        { testId: 't2', passed: true, timeout: false, input: [[]], expected: 0, actual: 0 },
        { testId: 't3', passed: true, timeout: false },
      ],
    });
  });

  it('fails the attempt when a hidden test fails, without telling its values', () => {
    const result = buildRunResult(TESTS, {
      outcomes: [
        { ok: true, value: 6 },
        { ok: true, value: 0 },
        { ok: true, value: 4 },
      ],
    });

    expect(result.status).toBe('tests_failed');
    expect(result.results[2]).toEqual({ testId: 't3', passed: false, timeout: false });
  });

  it('reports the error of a visible test instead of a value, and hides that of a hidden one', () => {
    const result = buildRunResult(TESTS, {
      outcomes: [
        { ok: false, error: 'TypeError: x' },
        { ok: true, value: undefined },
        { ok: false, error: 'TypeError: y' },
      ],
    });

    expect(result.results).toEqual([
      {
        testId: 't1',
        passed: false,
        timeout: false,
        input: [[1, 2, 3]],
        expected: 6,
        error: 'TypeError: x',
      },
      { testId: 't2', passed: false, timeout: false, input: [[]], expected: 0, actual: undefined },
      { testId: 't3', passed: false, timeout: false },
    ]);
  });

  it('marks the tests without an outcome as timed out', () => {
    const result = buildRunResult(TESTS, { outcomes: [{ ok: true, value: 6 }] });

    expect(result.status).toBe('tests_failed');
    expect(result.results.map((r) => [r.passed, r.timeout])).toEqual([
      [true, false],
      [false, true],
      [false, true],
    ]);
    expect(result.results[1]).toEqual({
      testId: 't2',
      passed: false,
      timeout: true,
      input: [[]],
      expected: 0,
    });
  });

  it('fails every test, without details, when the code does not load', () => {
    const loadError = { kind: 'missing_function' } as const;

    expect(buildRunResult(TESTS, { outcomes: [], loadError })).toEqual({
      status: 'tests_failed',
      results: [
        { testId: 't1', passed: false, timeout: false },
        { testId: 't2', passed: false, timeout: false },
        { testId: 't3', passed: false, timeout: false },
      ],
      loadError,
    });
  });

  it('never passes an exercise without tests', () => {
    expect(buildRunResult([], { outcomes: [] }).status).toBe('tests_failed');
  });
});
