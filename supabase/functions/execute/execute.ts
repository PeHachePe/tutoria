import {
  buildRunResult,
  checkRunTests,
  encodeRunResult,
  type SolutionCheck,
  solutionCheckOf,
} from '../../../src/app/data/code-runner/run-result.ts';
import { bearerToken, failure, json, preflight } from '../_shared/http.ts';
import { MAX_CODE_LENGTH, minuteBefore, secondsToWait } from '../_shared/limits.ts';
import type { CodeSandbox } from '../_shared/code-sandbox.ts';
import type { StaffRequests } from '../_shared/staff-requests.ts';
import type { RunStore } from './run-store.ts';

/** Runs a user may start in a minute (2.3). */
export const RUNS_PER_MINUTE = 10;

/** Checks of a solution a teacher may make in a minute (4.3c): as many as runs of a student. */
export const CHECKS_PER_MINUTE = 10;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ExecuteDependencies {
  readonly store: RunStore;
  readonly staff: StaffRequests;
  readonly sandbox: CodeSandbox;
  readonly now?: () => number;
}

/**
 * The Edge Function `execute` (2.3): checks the session and that the attempt is the caller's, runs
 * every test in the sandbox, compares outside it, keeps the code with the status it earned and the
 * `run` event, and answers with the `RunResult` (hidden tests, without details), encoded so that
 * `undefined`, `NaN` and `±Infinity` survive JSON (`encodeRunResult()`).
 *
 * Without an attempt, a teacher checks their solution against the tests of the form (4.3c, D-059):
 * the same sandbox and comparison, with the details of the hidden tests, and nothing kept.
 */
export function createExecuteHandler({
  store,
  staff,
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
      const raw = await readJson(request);
      const check = solutionCheckOf(raw);
      if (check) return await checkSolution(userId, check);
      const body = attemptRunOf(raw);
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

  /** Runs the teacher's solution against the tests they sent, without keeping anything. */
  async function checkSolution(userId: string, check: SolutionCheck): Promise<Response> {
    if (check.code.length > MAX_CODE_LENGTH) return failure(400, 'The code is too long');
    const wait = await staff.claim(userId, 'check', CHECKS_PER_MINUTE);
    if (wait === null) return failure(403, 'Only a teacher checks a solution');
    if (wait > 0) return failure(429, 'Too many checks', { 'Retry-After': String(wait) });
    const tests = checkRunTests(check);
    const outcome = await sandbox.run({
      code: check.code,
      functionName: check.functionName,
      inputs: tests.map((test) => test.input),
    });
    // The teacher wrote the hidden tests: they see them as the visible ones
    return json(200, encodeRunResult(buildRunResult(tests, outcome, { revealHidden: true })));
  }
}

/** The body as JSON, or `undefined` if it is not JSON. */
async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** The run of an attempt the app sends, or `null` if the body is not one. */
function attemptRunOf(body: unknown): { attemptId: string; code: string } | null {
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
  return null;
}
