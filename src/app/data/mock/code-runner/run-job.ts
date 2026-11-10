import type { RunLoadError, RunRequest, TestOutcome } from '../../code-runner/run-result';
import { normalizeOutput } from './output-value';
import type { RunMessage } from './run-protocol';

type Loaded = { readonly fn: (...args: unknown[]) => unknown } | { readonly error: RunLoadError };

/**
 * Runs the tests of a run inside the Worker (4.3): loads the student's code, looks the function up
 * by its name and calls it with each input, reporting each outcome as soon as it is there. It does
 * not compare: the expected values never reach the Worker.
 */
export function runJob(request: RunRequest, post: (message: RunMessage) => void): void {
  post({ type: 'started' });
  const loaded = loadFunction(request.code, request.functionName);
  if ('error' in loaded) {
    post({ type: 'load_error', error: loaded.error });
    return;
  }
  request.inputs.forEach((input, index) => {
    post({ type: 'result', index, outcome: callFunction(loaded.fn, input) });
  });
  post({ type: 'done' });
}

function loadFunction(code: string, functionName: string): Loaded {
  let found: unknown;
  try {
    // Mock data only: the student's own code, in their own browser and in a Worker the page ends
    // after 2 s. The line break keeps a final line comment from swallowing the lookup. The real
    // runner sends it to an isolated sandbox (2.3).
    found = new Function(
      `${code}\n;return typeof ${functionName} === 'function' ? ${functionName} : undefined;`,
    )();
  } catch (error) {
    return { error: { kind: 'invalid_code', message: describeError(error) } };
  }
  return typeof found === 'function'
    ? { fn: found as (...args: unknown[]) => unknown }
    : { error: { kind: 'missing_function' } };
}

function callFunction(fn: (...args: unknown[]) => unknown, input: readonly unknown[]): TestOutcome {
  try {
    // Each test gets its own copy: the function may change its arguments.
    return { ok: true, value: normalizeOutput(fn(...structuredClone(input))) };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

/** `RangeError: …`, as the browser console shows it; anything else thrown, as text. */
function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
