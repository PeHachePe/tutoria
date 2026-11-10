import type { RunLoadError, TestOutcome } from '../../code-runner/run-result';

/**
 * What the Worker sends back to the page, one message at a time: `started` once it begins (the
 * time limit counts from there, not from downloading the Worker), then a `result` per test as soon
 * as it ends (so those that finish before an endless loop keep their result) and `done`; or
 * `load_error`. The page sends it a `RunRequest`, without the expected values (2.5).
 */
export type RunMessage =
  | { readonly type: 'started' }
  | { readonly type: 'load_error'; readonly error: RunLoadError }
  | { readonly type: 'result'; readonly index: number; readonly outcome: TestOutcome }
  | { readonly type: 'done' };
