import { assertEquals } from '@std/assert';

import type { RunOutcome, RunResult } from '../../../src/app/data/code-runner/run-result.ts';
import type { CodeSandbox } from './code-sandbox.ts';
import {
  createExecuteHandler,
  MAX_CODE_LENGTH,
  RUNS_PER_MINUTE,
  secondsToWait,
} from './execute.ts';
import type { RecordOutcome, RunAttempt, RunStore } from './run-store.ts';

const NOW = Date.parse('2026-11-10T10:00:00Z');
const ATTEMPT_ID = '70000000-0000-4000-8000-000000000012';
const CODE = 'function suma(v) { return 6; }';

const ATTEMPT: RunAttempt = {
  userId: 'hugo',
  ownerActive: true,
  status: 'in_progress',
  functionName: 'suma',
  tests: [
    { id: 't1', input: [[1, 2, 3]], expectedOutput: 6, isHidden: false },
    { id: 't2', input: [[7, -3, 1]], expectedOutput: 5, isHidden: true },
  ],
};

/** A store in memory: Hugo signs in with `token-hugo`. */
class FakeStore implements RunStore {
  attempt: RunAttempt | null = ATTEMPT;
  runs: Date[] = [];
  recordOutcome: RecordOutcome = 'recorded';
  readonly recorded: { attemptId: string; code: string; result: RunResult }[] = [];

  userOf(token: string) {
    return Promise.resolve(token === 'token-hugo' ? 'hugo' : null);
  }
  findAttempt(attemptId: string) {
    return Promise.resolve(attemptId === ATTEMPT_ID ? this.attempt : null);
  }
  latestRuns(_userId: string, since: Date, limit: number) {
    return Promise.resolve(this.runs.filter((run) => run >= since).slice(0, limit));
  }
  recordRun(attemptId: string, code: string, result: RunResult) {
    this.recorded.push({ attemptId, code, result });
    return Promise.resolve(this.recordOutcome);
  }
}

/** A sandbox that answers what the test says, and remembers what it got. */
class FakeSandbox implements CodeSandbox {
  readonly requests: unknown[] = [];
  constructor(private readonly outcome: RunOutcome) {}
  run(request: unknown) {
    this.requests.push(request);
    return Promise.resolve(this.outcome);
  }
}

function setup(
  outcome: RunOutcome = {
    outcomes: [
      { ok: true, value: 6 },
      { ok: true, value: 6 },
    ],
  },
) {
  const store = new FakeStore();
  const sandbox = new FakeSandbox(outcome);
  const handle = createExecuteHandler({ store, sandbox, now: () => NOW });
  return { store, sandbox, handle };
}

function post(body: unknown, token: string | null = 'token-hugo'): Request {
  return new Request('http://functions.test/execute', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

Deno.test('a run answers with its result, encoded, and records it', async () => {
  const { store, sandbox, handle } = setup();

  const response = await handle(post({ attemptId: ATTEMPT_ID, code: CODE }));

  assertEquals(response.status, 200);
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(await response.json(), {
    status: 'tests_failed',
    results: [
      { testId: 't1', passed: true, timeout: false, input: [[1, 2, 3]], expected: 6, actual: 6 },
      { testId: 't2', passed: false, timeout: false },
    ],
  });
  // The sandbox gets the inputs, never the expected values
  assertEquals(sandbox.requests, [
    { code: CODE, functionName: 'suma', inputs: [[[1, 2, 3]], [[7, -3, 1]]] },
  ]);
  assertEquals(
    store.recorded.map(({ attemptId, code, result }) => [attemptId, code, result.status]),
    [[ATTEMPT_ID, CODE, 'tests_failed']],
  );
});

Deno.test('the values JSON lacks travel encoded', async () => {
  const { handle } = setup({ outcomes: [{ ok: true, value: Number.NaN }, undefined] });

  const body = await (await handle(post({ attemptId: ATTEMPT_ID, code: CODE }))).json();

  assertEquals(body.results[0].actual, { t: 'number', v: 'NaN' });
  assertEquals(body.results[1], { testId: 't2', passed: false, timeout: true });
});

Deno.test('the browser may ask before calling', async () => {
  const { handle } = setup();

  const response = await handle(
    new Request('http://functions.test/execute', { method: 'OPTIONS' }),
  );

  assertEquals(response.status, 204);
  assertEquals(
    response.headers.get('Access-Control-Allow-Headers')?.includes('authorization'),
    true,
  );
});

Deno.test('only POST runs', async () => {
  const { handle } = setup();

  assertEquals((await handle(new Request('http://functions.test/execute'))).status, 405);
});

Deno.test('without a valid session nothing runs', async () => {
  const { sandbox, handle } = setup();

  assertEquals((await handle(post({ attemptId: ATTEMPT_ID, code: CODE }, null))).status, 401);
  assertEquals((await handle(post({ attemptId: ATTEMPT_ID, code: CODE }, 'forged'))).status, 401);
  assertEquals(sandbox.requests, []);
});

Deno.test('a body that is not { attemptId, code } is invalid', async () => {
  const { handle } = setup();

  assertEquals((await handle(post('not json'))).status, 400);
  assertEquals((await handle(post({ attemptId: ATTEMPT_ID }))).status, 400);
  assertEquals((await handle(post({ attemptId: ATTEMPT_ID, code: 3 }))).status, 400);
});

Deno.test('code longer than any solution is invalid', async () => {
  const { handle } = setup();

  const response = await handle(
    post({ attemptId: ATTEMPT_ID, code: 'x'.repeat(MAX_CODE_LENGTH + 1) }),
  );

  assertEquals(response.status, 400);
});

Deno.test('the attempt of another user is not found, as one that does not exist', async () => {
  const { store, handle } = setup();
  store.attempt = { ...ATTEMPT, userId: 'lucia' };

  assertEquals((await handle(post({ attemptId: ATTEMPT_ID, code: CODE }))).status, 404);
  assertEquals((await handle(post({ attemptId: 'not-a-uuid', code: CODE }))).status, 404);
  assertEquals(store.recorded, []);
});

Deno.test('a disabled account cannot run', async () => {
  const { store, handle } = setup();
  store.attempt = { ...ATTEMPT, ownerActive: false };

  assertEquals((await handle(post({ attemptId: ATTEMPT_ID, code: CODE }))).status, 403);
});

Deno.test('a submitted attempt cannot run again, also if it was submitted meanwhile', async () => {
  const { store, handle } = setup();
  store.attempt = { ...ATTEMPT, status: 'submitted' };
  assertEquals((await handle(post({ attemptId: ATTEMPT_ID, code: CODE }))).status, 409);

  store.attempt = ATTEMPT;
  store.recordOutcome = 'submitted';
  assertEquals((await handle(post({ attemptId: ATTEMPT_ID, code: CODE }))).status, 409);

  store.recordOutcome = 'not_found';
  assertEquals((await handle(post({ attemptId: ATTEMPT_ID, code: CODE }))).status, 404);
});

Deno.test('the eleventh run in a minute waits, and says how long', async () => {
  const { store, sandbox, handle } = setup();
  // Every 5 s since 50 s ago: the oldest leaves the minute in 10 s
  store.runs = Array.from({ length: RUNS_PER_MINUTE }, (_, i) => new Date(NOW - 5_000 * (i + 1)));

  const response = await handle(post({ attemptId: ATTEMPT_ID, code: CODE }));

  assertEquals(response.status, 429);
  assertEquals(response.headers.get('Retry-After'), '10');
  assertEquals(sandbox.requests, []);
});

Deno.test('a failure of the server is an unknown error, never a crash', async () => {
  const { store, handle } = setup();
  store.findAttempt = () => Promise.reject(new Error('Database down'));
  const quiet = console.error;
  console.error = () => {};

  try {
    assertEquals((await handle(post({ attemptId: ATTEMPT_ID, code: CODE }))).status, 500);
  } finally {
    console.error = quiet;
  }
});

Deno.test('secondsToWait lets run below the limit and waits at least a second at it', () => {
  const runs = (ago: number) => Array.from({ length: RUNS_PER_MINUTE }, () => new Date(NOW - ago));

  assertEquals(secondsToWait(runs(1_000).slice(1), NOW), 0);
  assertEquals(secondsToWait(runs(30_000), NOW), 30);
  assertEquals(secondsToWait(runs(59_999), NOW), 1);
});
