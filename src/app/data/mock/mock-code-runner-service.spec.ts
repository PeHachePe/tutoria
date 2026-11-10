import { TestBed } from '@angular/core/testing';

import type { Attempt } from '../attempt';
import { DataError } from '../data-error';
import { FakeWorker, RUN_IN_THREAD, type WorkerScript } from './code-runner/code-runner-testing';
import { CODE_RUNNER_WORKER } from './code-runner/code-runner-worker';
import { SAMPLE_CODE } from './fixtures/activity';
import { assignmentId, exerciseId } from './fixtures/exercises';
import { DAW_GROUP_ID, DAW_STUDENT_IDS } from './fixtures/users';
import { MockCodeRunnerService, RUN_TIME_LIMIT_MS } from './mock-code-runner-service';
import { MockDb } from './mock-db';
import { MockNetwork } from './mock-network';

const NOW = '2026-11-10T09:30:00.000Z';
const STUDENT = DAW_STUDENT_IDS[0];
const ATTEMPT_ID = 'a0000000-0000-4000-8000-000000000001';

describe('MockCodeRunnerService', () => {
  let service: MockCodeRunnerService;
  let db: MockDb;
  let workers: FakeWorker[];
  let script: WorkerScript;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(NOW);
    workers = [];
    script = RUN_IN_THREAD;
    TestBed.configureTestingModule({
      providers: [
        MockCodeRunnerService,
        {
          provide: CODE_RUNNER_WORKER,
          useValue: () => {
            const worker = new FakeWorker((request, self) => script(request, self));
            workers.push(worker);
            return worker as unknown as Worker;
          },
        },
      ],
    });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    db = TestBed.inject(MockDb);
    db.setSession(STUDENT);
    db.update('events', () => []);
    db.update('attempts', () => [attemptRow()]);
    service = TestBed.inject(MockCodeRunnerService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  function attemptRow(changes: Partial<Attempt> = {}): Attempt {
    return {
      id: ATTEMPT_ID,
      exerciseId: exerciseId(3),
      userId: STUDENT,
      assignmentId: assignmentId(DAW_GROUP_ID, 3),
      currentCode: '',
      finalCode: null,
      status: 'in_progress',
      startedAt: '2026-11-10T09:00:00.000Z',
      finishedAt: null,
      updatedAt: '2026-11-10T09:00:00.000Z',
      ...changes,
    };
  }

  function storedAttempt(): Attempt | undefined {
    return db.tables().attempts.find((attempt) => attempt.id === ATTEMPT_ID);
  }

  it('passes exercise 3 with its solution, saving the code and recording the run', async () => {
    const result = await service.run(ATTEMPT_ID, SAMPLE_CODE[3].solved);

    expect(result.status).toBe('passed');
    expect(result.results).toHaveLength(6);
    expect(result.results[0]).toEqual({
      testId: expect.any(String),
      passed: true,
      timeout: false,
      input: [[1, 2, 3]],
      expected: 6,
      actual: 6,
    });
    expect(storedAttempt()).toMatchObject({
      currentCode: SAMPLE_CODE[3].solved,
      status: 'passed',
      updatedAt: NOW,
    });
    expect(db.tables().events).toEqual([
      {
        id: expect.any(String),
        attemptId: ATTEMPT_ID,
        type: 'run',
        timestamp: NOW,
        detail: { passed: 6, failed: 0, failedTestIds: [] },
      },
    ]);
    expect(workers).toHaveLength(1);
    expect(workers[0].terminated).toBe(true);
  });

  it('only changes the attempt that ran', async () => {
    const other = attemptRow({
      id: 'a0000000-0000-4000-8000-000000000002',
      exerciseId: exerciseId(4),
    });
    db.update('attempts', (rows) => [...rows, other]);

    await service.run(ATTEMPT_ID, SAMPLE_CODE[3].solved);

    expect(db.tables().attempts.find((attempt) => attempt.id === other.id)).toEqual(other);
  });

  it('fails with the typical mistake, counting the hidden tests among the failed ones', async () => {
    const result = await service.run(ATTEMPT_ID, SAMPLE_CODE[3].partial);

    expect(result.status).toBe('tests_failed');
    expect(result.results[0]).toMatchObject({ passed: false, actual: Number.NaN });
    expect(storedAttempt()?.status).toBe('tests_failed');
    const [event] = db.tables().events;
    expect(event.detail).toEqual({
      passed: 0,
      failed: 6,
      failedTestIds: result.results.map((test) => test.testId),
    });
  });

  it('uses a new Worker for each run', async () => {
    await service.run(ATTEMPT_ID, SAMPLE_CODE[3].partial);
    await service.run(ATTEMPT_ID, SAMPLE_CODE[3].solved);

    expect(workers).toHaveLength(2);
  });

  it('ends an endless loop after the time limit, keeping the tests that ended before', async () => {
    script = (request, worker) => {
      worker.emit({ type: 'started' });
      worker.emit({ type: 'result', index: 0, outcome: { ok: true, value: 6 } });
      // …and the second test never ends
    };
    const running = service.run(ATTEMPT_ID, 'function suma(v) { while (true) {} }');

    await vi.advanceTimersByTimeAsync(RUN_TIME_LIMIT_MS - 1);
    expect(workers[0].terminated).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const result = await running;

    expect(workers[0].terminated).toBe(true);
    expect(result.status).toBe('tests_failed');
    expect(result.results.map((test) => [test.passed, test.timeout])).toEqual([
      [true, false],
      [false, true],
      [false, true],
      [false, true],
      [false, true],
      [false, true],
    ]);
  });

  it('counts the time limit from the start of the tests, not from creating the Worker', async () => {
    script = () => undefined; // still downloading
    let settled = false;
    void service.run(ATTEMPT_ID, SAMPLE_CODE[3].solved).finally(() => (settled = true));

    await vi.advanceTimersByTimeAsync(RUN_TIME_LIMIT_MS * 2);

    expect(settled).toBe(false);
    expect(workers[0].terminated).toBe(false);
  });

  it('reports code that does not load, saving it as it is', async () => {
    const result = await service.run(ATTEMPT_ID, 'function suma(v) {');

    expect(result.loadError).toEqual({ kind: 'invalid_code', message: expect.any(String) });
    expect(result.results.every((test) => !test.passed)).toBe(true);
    expect(storedAttempt()).toMatchObject({
      currentCode: 'function suma(v) {',
      status: 'tests_failed',
    });
    expect(workers[0].terminated).toBe(true);
  });

  it('fails with an unknown error when the Worker breaks, leaving the attempt as it was', async () => {
    script = (_request, worker) => worker.onerror?.(new ErrorEvent('error'));

    await expect(service.run(ATTEMPT_ID, SAMPLE_CODE[3].solved)).rejects.toEqual(
      new DataError('unknown', 'The code runner failed'),
    );
    expect(workers[0].terminated).toBe(true);
    expect(storedAttempt()?.status).toBe('in_progress');
    expect(db.tables().events).toEqual([]);
  });

  it('does not run a submitted attempt', async () => {
    db.update('attempts', () => [attemptRow({ status: 'submitted' })]);

    await expect(service.run(ATTEMPT_ID, '')).rejects.toMatchObject({ kind: 'invalid' });
    expect(workers).toEqual([]);
  });

  it('hides the attempts of other students', async () => {
    db.update('attempts', () => [attemptRow({ userId: DAW_STUDENT_IDS[1] })]);

    await expect(service.run(ATTEMPT_ID, '')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('goes through the simulated network', async () => {
    TestBed.inject(MockNetwork).failNextRequest('network');

    await expect(service.run(ATTEMPT_ID, '')).rejects.toMatchObject({ kind: 'network' });
    expect(workers).toEqual([]);
  });
});

describe('CODE_RUNNER_WORKER', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a module Worker from the worker file', () => {
    const created: [URL, WorkerOptions][] = [];
    vi.stubGlobal(
      'Worker',
      class {
        constructor(url: URL, options: WorkerOptions) {
          created.push([url, options]);
        }
      },
    );

    TestBed.inject(CODE_RUNNER_WORKER)();

    expect(created).toHaveLength(1);
    // The builder bundles the worker file on its own, with a name of its choice
    expect(String(created[0][0])).toMatch(/worker_file/);
    expect(created[0][1]).toEqual({ type: 'module' });
  });
});
