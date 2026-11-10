import { buildRunResult, encodeRunResult } from '../../../src/app/data/code-runner/run-result.ts';
import { bearerToken, failure, json, preflight } from '../_shared/http.ts';
import { MAX_CODE_LENGTH, minuteBefore, secondsToWait } from '../_shared/limits.ts';
import type { CodeSandbox } from '../_shared/code-sandbox.ts';
import type { RunStore } from './run-store.ts';

/** Runs a user may start in a minute (2.3). */
export const RUNS_PER_MINUTE = 10;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ExecuteDependencies {
  readonly store: RunStore;
  readonly sandbox: CodeSandbox;
  readonly now?: () => number;
}

/**
 * The Edge Function `execute` (2.3): checks the session and that the attempt is the caller's, runs
 * every test in the sandbox, compares outside it, keeps the code with the status it earned and the
 * `run` event, and answers with the `RunResult` (hidden tests, without details), encoded so that
 * `undefined`, `NaN` and `±Infinity` survive JSON (`encodeRunResult()`).
 */
export function createExecuteHandler({
  store,
  sandbox,
  now = Date.now,
}: ExecuteDependencies): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method === 'OPTIONS') return preflight();
    if (request.method !== 'POST') return failure(405, 'Only POST');
    try {
      const token = bearerToken(request);
      const userId = token ? await store.userOf(token) : null;
      if (!userId) return failure(401, 'Sign in to run the code');
      const body = await readBody(request);
      if (!body) return failure(400, 'Expected { attemptId, code }');
      if (body.code.length > MAX_CODE_LENGTH) return failure(400, 'The code is too long');

      const attempt = UUID.test(body.attemptId) ? await store.findAttempt(body.attemptId) : null;
      // Not the owner's: the same answer as an attempt that does not exist, as the RLS gives
      if (!attempt || attempt.userId !== userId) return failure(404, 'Attempt not found');
      if (!attempt.ownerActive) return failure(403, 'The account is disabled');
      if (attempt.status === 'submitted') return failure(409, 'The attempt is submitted');

      const wait = secondsToWait(
        await store.latestRuns(userId, minuteBefore(now()), RUNS_PER_MINUTE),
        RUNS_PER_MINUTE,
        now(),
      );
      if (wait > 0) return failure(429, 'Too many runs', { 'Retry-After': String(wait) });

      const outcome = await sandbox.run({
        code: body.code,
        functionName: attempt.functionName,
        inputs: attempt.tests.map((test) => test.input),
      });
      const result = buildRunResult(attempt.tests, outcome);
      switch (await store.recordRun(body.attemptId, body.code, result)) {
        case 'submitted':
          return failure(409, 'The attempt is submitted');
        case 'not_found':
          return failure(404, 'Attempt not found');
        case 'recorded':
          return json(200, encodeRunResult(result));
      }
    } catch (error) {
      console.error(error);
      return failure(500, 'The run failed');
    }
  };
}

/** The body the app sends, or `null` if it is not one. */
async function readBody(request: Request): Promise<{ attemptId: string; code: string } | null> {
  try {
    const body: unknown = await request.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'attemptId' in body &&
      typeof body.attemptId === 'string' &&
      'code' in body &&
      typeof body.code === 'string'
    ) {
      return { attemptId: body.attemptId, code: body.code };
    }
  } catch {
    // Not JSON: below
  }
  return null;
}
