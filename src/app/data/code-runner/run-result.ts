/**
 * What a run is and gives, shared by the mock runner and the Edge Function `execute` (2.3, D-042):
 * both run the tests in a sandbox that never sees the expected values, and then compare and build
 * the result here. The Edge Function imports this file as it is, so it must not import anything:
 * the Edge Runtime resolves every import, also those of types, and only with their extension.
 */

/** The status a run leaves: only the server, or the mock service, sets it (2.4). */
export type RunStatus = 'tests_failed' | 'passed';

/** Result of one test after a run. */
export interface TestResult {
  readonly testId: string;
  readonly passed: boolean;
  /** Did not end within its time, or never started because the run ran out of time (D-030). */
  readonly timeout: boolean;
  /** Runtime error message, if any. */
  readonly error?: string;
  /** Input, expected and actual values: visible tests only. */
  readonly input?: readonly unknown[];
  readonly expected?: unknown;
  /** Keeps `undefined`, `NaN` and `±Infinity` (D-030). */
  readonly actual?: unknown;
}

/**
 * Why the code could not run any test: it does not load (a syntax error, or an error in the code
 * outside the function), or it loads without the function the exercise asks for. The screen shows
 * it once, instead of the same failure in every test.
 */
export interface RunLoadError {
  readonly kind: 'invalid_code' | 'missing_function';
  /** Message of the JavaScript error, for `invalid_code`. */
  readonly message?: string;
}

/** Result of running every test of an attempt. */
export interface RunResult {
  readonly status: RunStatus;
  /** One per test, in their order; with a load error, all failed and without details. */
  readonly results: readonly TestResult[];
  readonly loadError?: RunLoadError;
}

/** What the sandbox needs to know of a test, and of the exercise (`Test` fits it). */
export interface RunTest {
  readonly id: string;
  /** List of arguments. */
  readonly input: readonly unknown[];
  readonly expectedOutput: unknown;
  readonly isHidden: boolean;
}

/**
 * What goes into the sandbox: the student's code and the inputs of the tests, never the expected
 * values, which stay outside to compare (2.5).
 */
export interface RunRequest {
  readonly code: string;
  readonly functionName: string;
  /** The arguments of each test, in order. */
  readonly inputs: readonly (readonly unknown[])[];
}

/** What one test obtained: the returned value, or the message of the error it threw. */
export type TestOutcome =
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: string };

/** What comes out of the sandbox: an outcome per test that ended in time, or why none ran. */
export interface RunOutcome {
  /** By test position; missing for each test that did not end in time. */
  readonly outcomes: readonly (TestOutcome | undefined)[];
  readonly loadError?: RunLoadError;
}

/**
 * The result of a run, compared outside the student's code (2.5): visible tests carry their input,
 * the expected value and what the code returned or the error it threw; hidden ones, only whether
 * they passed. The attempt passes only if every test passes.
 */
export function buildRunResult(tests: readonly RunTest[], outcome: RunOutcome): RunResult {
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

function testResult(test: RunTest, outcome: TestOutcome | undefined): TestResult {
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

/** The `detail` of the `run` event (2.8): how many tests passed and failed, and which failed. */
export function runEventDetail(result: RunResult): {
  readonly passed: number;
  readonly failed: number;
  readonly failedTestIds: readonly string[];
} {
  const failedTestIds = result.results.filter((test) => !test.passed).map((test) => test.testId);
  return {
    passed: result.results.length - failedTestIds.length,
    failed: failedTestIds.length,
    failedTestIds,
  };
}

/**
 * Whether the obtained value is the expected one, compared as JSON (2.5) without minding the order
 * of the keys of an object. `undefined`, `NaN` and `±Infinity` are only equal to themselves.
 */
export function outputsEqual(actual: unknown, expected: unknown): boolean {
  return canonical(actual) === canonical(expected);
}

/** JSON with sorted keys, where the values JSON lacks are written bare, so no string can match them. */
function canonical(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

// How an obtained value travels as JSON ------------------------------------------------------------

/**
 * An obtained value written as JSON without losing `undefined`, `NaN` or `±Infinity`: arrays and
 * the values JSON has stay as they are, and everything else is an object with its tag `t`, also
 * the objects themselves, so no object of the student can pass for a tag.
 */
export type EncodedValue =
  | null
  | boolean
  | number
  | string
  | readonly EncodedValue[]
  | { readonly t: 'undefined' }
  | { readonly t: 'number'; readonly v: 'NaN' | 'Infinity' | '-Infinity' }
  | { readonly t: 'object'; readonly v: Readonly<Record<string, EncodedValue>> };

/** The value as it travels; it must already be one a test can obtain (`normalizeOutput()`). */
export function encodeRunValue(value: unknown): EncodedValue {
  if (value === undefined) return { t: 'undefined' };
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return { t: 'number', v: String(value) as 'NaN' | 'Infinity' | '-Infinity' };
  }
  if (Array.isArray(value)) return value.map(encodeRunValue);
  if (typeof value === 'object' && value !== null) {
    return { t: 'object', v: mapValues(value, encodeRunValue) };
  }
  return value as EncodedValue;
}

export function decodeRunValue(encoded: EncodedValue): unknown {
  if (Array.isArray(encoded)) return encoded.map(decodeRunValue);
  if (typeof encoded !== 'object' || encoded === null) return encoded;
  const tagged = encoded as Exclude<EncodedValue, readonly EncodedValue[]> & object;
  switch (tagged.t) {
    case 'undefined':
      return undefined;
    case 'number':
      return Number(tagged.v);
    case 'object':
      return mapValues(tagged.v, decodeRunValue);
  }
}

/** `Object.fromEntries()` defines each key, so not even `__proto__` changes the prototype. */
function mapValues<In, Out>(object: object, map: (value: In) => Out): Record<string, Out> {
  return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, map(item as In)]));
}

/** A result of a test as it travels: the obtained value, encoded. */
export type EncodedTestResult = Omit<TestResult, 'actual'> & { readonly actual?: EncodedValue };

/** The answer of the Edge Function `execute`. */
export type EncodedRunResult = Omit<RunResult, 'results'> & {
  readonly results: readonly EncodedTestResult[];
};

export function encodeRunResult(result: RunResult): EncodedRunResult {
  return {
    ...result,
    results: result.results.map((test) => {
      const { actual, ...rest } = test;
      // `in`, because a test that obtained `undefined` has the key with that value
      return 'actual' in test ? { ...rest, actual: encodeRunValue(actual) } : rest;
    }),
  };
}

export function decodeRunResult(encoded: EncodedRunResult): RunResult {
  return {
    ...encoded,
    results: encoded.results.map(({ actual, ...test }) =>
      actual === undefined ? test : { ...test, actual: decodeRunValue(actual) },
    ),
  };
}
