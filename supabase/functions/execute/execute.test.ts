import { assertEquals } from '@std/assert';

import type { RunOutcome, RunResult } from '../../../src/app/data/code-runner/run-result.ts';
import type { CodeSandbox } from '../_shared/code-sandbox.ts';
import { MAX_BODY_BYTES } from '../_shared/http.ts';
import { MAX_CODE_LENGTH } from '../_shared/limits.ts';
import type { StaffRequestKind, StaffRequests } from '../_shared/staff-requests.ts';
import type { StudentRequestKind, StudentRequests } from '../_shared/student-requests.ts';
import { CHECKS_PER_MINUTE, createExecuteHandler, RUNS_PER_MINUTE } from './execute.ts';
import type { RecordOutcome, RunAttempt, RunStore } from './run-store.ts';

const ATTEMPT_ID = '70000000-0000-4000-8000-000000000012';
const CODE = 'function sum(v) { return 6; }';

const ATTEMPT: RunAttempt = {
  userId: 'hugo',
  ownerActive: true,
  status: 'in_progress',
  open: true,
  functionName: 'sum',
  tests: [
    { id: 't1', input: [[1, 2, 3]], expectedOutput: 6, isHidden: false },
    { id: 't2', input: [[7, -3, 1]], expectedOutput: 5, isHidden: true },
  ],
};

/** A store in memory: Hugo signs in with `token-hugo`. */
class FakeStore implements RunStore {
  attempt: RunAttempt | null = ATTEMPT;
  recordOutcome: RecordOutcome = 'recorded';
  readonly recorded: { attemptId: string; code: string; result: RunResult }[] = [];

  userOf(token: string) {
    return Promise.resolve(token === 'token-hugo' ? 'hugo' : null);
  }
  findAttempt(attemptId: string) {
    return Promise.resolve(attemptId === ATTEMPT_ID ? this.attempt : null);
  }
  recordRun(attemptId: string, code: string, result: RunResult) {
    this.recorded.push({ attemptId, code, result });
    return Promise.resolve(this.recordOutcome);
  }
}

/** The limit of the runs of a student: free, unless `wait` says how long to wait. */
class FakeStudents implements StudentRequests {
  wait = 0;
  readonly claims: [string, StudentRequestKind, number, number | undefined][] = [];

  claim(userId: string, kind: StudentRequestKind, perMinute: number, perDay?: number) {
    this.claims.push([userId, kind, perMinute, perDay]);
    return Promise.resolve(this.wait);
  }
}

/** The limit of the staff: Hugo is a teacher here, unless `teacher` says otherwise. */
class FakeStaff implements StaffRequests {
  teacher = true;
  wait = 0;
  readonly claims: [string, StaffRequestKind, number][] = [];

  claim(userId: string, kind: StaffRequestKind, perMinute: number) {
    this.claims.push([userId, kind, perMinute]);
    return Promise.resolve(this.teacher ? this.wait : null);
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
  const students = new FakeStudents();
  const staff = new FakeStaff();
  const sandbox = new FakeSandbox(outcome);
  const handle = createExecuteHandler({ store, students, staff, sandbox });
  return { store, students, staff, sandbox, handle };
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
    { code: CODE, functionName: 'sum', inputs: [[[1, 2, 3]], [[7, -3, 1]]] },
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

Deno.test('a run is counted before it runs, and past the limit it waits', async () => {
  const { students, sandbox, handle } = setup();

  assertEquals((await handle(post({ attemptId: ATTEMPT_ID, code: CODE }))).status, 200);
  assertEquals(students.claims, [['hugo', 'run', RUNS_PER_MINUTE, undefined]]);

  students.wait = 10;
  const response = await handle(post({ attemptId: ATTEMPT_ID, code: CODE }));

  assertEquals(response.status, 429);
  assertEquals(response.headers.get('Retry-After'), '10');
  assertEquals(sandbox.requests.length, 1);
});

Deno.test('an attempt its student no longer sees does not run, nor counts', async () => {
  const { store, students, sandbox, handle } = setup();
  // Its block was hidden or is not open yet, or the student left the group
  store.attempt = { ...ATTEMPT, open: false };

  assertEquals((await handle(post({ attemptId: ATTEMPT_ID, code: CODE }))).status, 403);
  assertEquals(students.claims, []);
  assertEquals(sandbox.requests, []);
});

Deno.test(
  'the hidden tests run after the visible ones, and the result keeps their order',
  async () => {
    // The sandbox gets the visible ones first: 1, 3 and then the hidden 2
    const { store, sandbox, handle } = setup({
      outcomes: [
        { ok: true, value: 'first' },
        { ok: true, value: 'third' },
        { ok: true, value: 'second' },
      ],
    });
    store.attempt = {
      ...ATTEMPT,
      tests: [
        { id: 't1', input: [1], expectedOutput: 'first', isHidden: false },
        { id: 't2', input: [2], expectedOutput: 'second', isHidden: true },
        { id: 't3', input: [3], expectedOutput: 'third', isHidden: false },
      ],
    };

    const response = await handle(post({ attemptId: ATTEMPT_ID, code: CODE }));

    assertEquals(sandbox.requests, [{ code: CODE, functionName: 'sum', inputs: [[1], [3], [2]] }]);
    const { status, results } = await response.json();
    assertEquals(status, 'passed');
    assertEquals(
      results.map((result: { testId: string }) => result.testId),
      ['t1', 't2', 't3'],
    );
  },
);

Deno.test('a body past the limit is not read, whatever its length says', async () => {
  const { store, sandbox, handle } = setup();
  const huge = JSON.stringify({
    attemptId: ATTEMPT_ID,
    code: CODE,
    pad: 'x'.repeat(MAX_BODY_BYTES),
  });
  const declared = new Request('http://functions.test/execute', {
    method: 'POST',
    headers: { Authorization: 'Bearer token-hugo', 'Content-Length': String(huge.length) },
    body: huge,
  });

  assertEquals((await handle(declared)).status, 413);
  // Without the header, as a body sent in chunks
  assertEquals((await handle(post(huge))).status, 413);
  assertEquals(store.recorded, []);
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

// The teacher's check of a solution (4.3c, D-059)

const CHECK = {
  code: CODE,
  functionName: 'sum',
  tests: [
    { input: [[1, 2, 3]], expectedOutput: 6, isHidden: false },
    { input: [[7, -3, 1]], expectedOutput: 5, isHidden: true },
  ],
};

Deno.test(
  'a teacher checks a solution against the tests of the form, hidden ones too',
  async () => {
    const { store, staff, sandbox, handle } = setup({
      outcomes: [
        { ok: true, value: 6 },
        { ok: true, value: Number.NaN },
      ],
    });

    const response = await handle(post(CHECK));

    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      status: 'tests_failed',
      results: [
        {
          testId: 'test-1',
          passed: true,
          timeout: false,
          input: [[1, 2, 3]],
          expected: 6,
          actual: 6,
        },
        {
          testId: 'test-2',
          passed: false,
          timeout: false,
          input: [[7, -3, 1]],
          expected: 5,
          actual: { t: 'number', v: 'NaN' },
        },
      ],
    });
    // The sandbox gets the inputs, never the expected values, and nothing of it is kept
    assertEquals(sandbox.requests, [
      { code: CODE, functionName: 'sum', inputs: [[[1, 2, 3]], [[7, -3, 1]]] },
    ]);
    assertEquals(store.recorded, []);
    assertEquals(staff.claims, [['hugo', 'check', CHECKS_PER_MINUTE]]);
  },
);

Deno.test('only a teacher checks a solution, and without a session nobody', async () => {
  const { staff, sandbox, handle } = setup();
  staff.teacher = false;

  assertEquals((await handle(post(CHECK))).status, 403);
  assertEquals((await handle(post(CHECK, null))).status, 401);
  assertEquals(sandbox.requests, []);
});

Deno.test('a check past the limit waits, and says how long', async () => {
  const { staff, sandbox, handle } = setup();
  staff.wait = 12;

  const response = await handle(post(CHECK));

  assertEquals(response.status, 429);
  assertEquals(response.headers.get('Retry-After'), '12');
  assertEquals(sandbox.requests, []);
});

Deno.test('a check with code longer than any solution is invalid, before counting it', async () => {
  const { staff, handle } = setup();

  assertEquals(
    (await handle(post({ ...CHECK, code: 'x'.repeat(MAX_CODE_LENGTH + 1) }))).status,
    400,
  );
  assertEquals((await handle(post({ ...CHECK, tests: [] }))).status, 400);
  assertEquals(staff.claims, []);
});

Deno.test('a check names its function with an identifier, before counting it', async () => {
  const { staff, sandbox, handle } = setup();

  // Not a check, nor a run of an attempt: nothing reaches the sandbox, which would throw
  assertEquals(
    (await handle(post({ ...CHECK, functionName: 'sum; while (true) {}' }))).status,
    400,
  );
  assertEquals(staff.claims, []);
  assertEquals(sandbox.requests, []);
});
