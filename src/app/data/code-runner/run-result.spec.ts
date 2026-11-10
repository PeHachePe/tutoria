import type { Test } from '../exercise';
import {
  buildRunResult,
  decodeRunResult,
  decodeRunValue,
  encodeRunResult,
  encodeRunValue,
  outputsEqual,
  runEventDetail,
  type RunResult,
} from './run-result';

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
    expect(result.results.map((r: RunResult['results'][number]) => [r.passed, r.timeout])).toEqual([
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

describe('runEventDetail', () => {
  it('counts the tests that passed and names those that failed, timed out or threw', () => {
    const result = buildRunResult(TESTS, {
      outcomes: [
        { ok: true, value: 6 },
        { ok: false, error: 'x' },
      ],
    });

    expect(runEventDetail(result)).toEqual({ passed: 1, failed: 2, failedTestIds: ['t2', 't3'] });
  });
});

describe('outputsEqual', () => {
  it('compares as JSON', () => {
    expect(outputsEqual(6, 6)).toBe(true);
    expect(outputsEqual([1, 2], [1, 2])).toBe(true);
    expect(outputsEqual('6', 6)).toBe(false);
    expect(outputsEqual([1, 2], [2, 1])).toBe(false);
    expect(outputsEqual(-0, 0)).toBe(true);
  });

  it('ignores the order of the keys of an object', () => {
    expect(outputsEqual({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toBe(true);
    expect(outputsEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('never takes undefined, NaN or Infinity for null', () => {
    expect(outputsEqual(undefined, null)).toBe(false);
    expect(outputsEqual(Number.NaN, null)).toBe(false);
    expect(outputsEqual(Infinity, null)).toBe(false);
    expect(outputsEqual([undefined], [null])).toBe(false);
    expect(outputsEqual(Number.NaN, Number.NaN)).toBe(true);
  });

  it('never mistakes those values for strings with the same text', () => {
    expect(outputsEqual(Number.NaN, 'NaN')).toBe(false);
    expect(outputsEqual(undefined, 'undefined')).toBe(false);
  });
});

/** The value after travelling as JSON, as the answer of the Edge Function does. */
function travel(value: unknown): unknown {
  return decodeRunValue(JSON.parse(JSON.stringify(encodeRunValue(value))));
}

describe('encodeRunValue and decodeRunValue', () => {
  it('keep the values JSON has', () => {
    for (const value of [6, -2.5, 'a', '', true, null, [1, [2, 'b']], { a: 1, b: { c: [] } }]) {
      expect(travel(value)).toEqual(value);
    }
  });

  it('keep the values JSON would lose, also inside arrays and objects', () => {
    expect(travel(undefined)).toBeUndefined();
    expect(travel(Number.NaN)).toBeNaN();
    expect(travel(Infinity)).toBe(Infinity);
    expect(travel(-Infinity)).toBe(-Infinity);
    expect(travel([undefined, Number.NaN])).toEqual([undefined, Number.NaN]);
    expect(travel({ a: undefined, b: -Infinity })).toEqual({ a: undefined, b: -Infinity });
  });

  it('never takes an object of the student for a tag', () => {
    const lookalikes = [{ t: 'undefined' }, { t: 'number', v: 'NaN' }, { t: 'object', v: {} }];

    for (const value of lookalikes) expect(travel(value)).toEqual(value);
  });

  it('keep a key called __proto__ as a key, without changing the prototype', () => {
    const value = JSON.parse('{"__proto__": {"polluted": true}}') as object;
    const decoded = travel(value) as object;

    expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
    expect(Object.keys(decoded)).toEqual(['__proto__']);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});

describe('encodeRunResult and decodeRunResult', () => {
  it('carry the obtained values of a run and leave the rest as it is', () => {
    const result = buildRunResult(TESTS, {
      outcomes: [{ ok: true, value: Number.NaN }, { ok: true, value: undefined }, undefined],
    });

    const decoded = decodeRunResult(JSON.parse(JSON.stringify(encodeRunResult(result))));

    expect(decoded).toEqual(result);
    expect('actual' in decoded.results[1]).toBe(true);
    expect('actual' in decoded.results[2]).toBe(false);
  });

  it('keep the load error', () => {
    const result = buildRunResult(TESTS, { outcomes: [], loadError: { kind: 'missing_function' } });

    expect(decodeRunResult(encodeRunResult(result))).toEqual(result);
  });
});
