import type { RunLoadError } from '../../attempt';

/**
 * What the page sends to the Worker: the student's code and the inputs of the tests, never the
 * expected values, which stay in the page to compare (2.5), as in the real runner (2.3).
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

/**
 * What the Worker sends back, one message at a time: `started` once it begins (the time limit
 * counts from there, not from downloading the Worker), then a `result` per test as soon as it ends
 * (so those that finish before an endless loop keep their result) and `done`; or `load_error`.
 */
export type RunMessage =
  | { readonly type: 'started' }
  | { readonly type: 'load_error'; readonly error: RunLoadError }
  | { readonly type: 'result'; readonly index: number; readonly outcome: TestOutcome }
  | { readonly type: 'done' };
