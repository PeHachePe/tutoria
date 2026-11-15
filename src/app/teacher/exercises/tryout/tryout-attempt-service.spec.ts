import { TestBed } from '@angular/core/testing';

import { AuthStore } from '../../../auth/auth-store';
import type { RunResult } from '../../../data/attempt';
import { DataError } from '../../../data/data-error';
import type { TutorInteraction } from '../../../data/tutor';
import { TryoutAttemptService } from './tryout-attempt-service';
import { TRYOUT_ASSIGNMENT_ID, TRYOUT_EXERCISE, type TryoutExercise } from './tryout-exercise';

const EXERCISE = {
  content: { exercise: { id: 'preview' }, visibleTests: [], hiddenTestCount: 0 },
  tests: [],
} as unknown as TryoutExercise;

const PASSED: RunResult = {
  status: 'passed',
  results: [{ testId: 'test-1', passed: true, timeout: false }],
};
const FAILED: RunResult = {
  status: 'tests_failed',
  results: [
    { testId: 'test-1', passed: true, timeout: false },
    { testId: 'test-2', passed: false, timeout: false },
  ],
};

function answer(attemptId: string): TutorInteraction {
  return {
    id: 'i1',
    attemptId,
    trigger: 'hint',
    hintLevel: 1,
    studentMessage: null,
    transcript: 'Mira el bucle.',
    emotion: 'encouragement',
    intensity: 2,
    elusion: false,
    promptVersion: 'preview',
    createdAt: '2026-11-15T10:00:00.000Z',
  };
}

describe('TryoutAttemptService', () => {
  let service: TryoutAttemptService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TryoutAttemptService,
        { provide: TRYOUT_EXERCISE, useValue: EXERCISE },
        { provide: AuthStore, useValue: { userId: () => 'marta' } },
      ],
    });
    service = TestBed.inject(TryoutAttemptService);
  });

  it('opens a first attempt in memory, empty, and the same one again', async () => {
    const attempt = await service.openOrCreate(TRYOUT_ASSIGNMENT_ID);

    expect(attempt).toMatchObject({
      exerciseId: 'preview',
      userId: 'marta',
      assignmentId: TRYOUT_ASSIGNMENT_ID,
      number: 1,
      currentCode: '',
      finalCode: null,
      status: 'in_progress',
    });
    expect(await service.openOrCreate(TRYOUT_ASSIGNMENT_ID)).toEqual(attempt);
    expect(await service.list()).toEqual([attempt]);
  });

  it('opens an attempt by its number, or says there is none', async () => {
    const first = await service.openOrCreate(TRYOUT_ASSIGNMENT_ID);

    expect(await service.openOrCreate(TRYOUT_ASSIGNMENT_ID, 1)).toEqual(first);
    await expect(service.openOrCreate(TRYOUT_ASSIGNMENT_ID, 2)).rejects.toEqual(
      new DataError('not_found'),
    );
  });

  it('saves the code, which takes a run back to in progress', async () => {
    const { id } = await service.openOrCreate(TRYOUT_ASSIGNMENT_ID);
    service.recordRun(id, 'a', PASSED);

    expect(await service.saveCode(id, 'a')).toMatchObject({ status: 'passed' });
    expect(await service.saveCode(id, 'b')).toMatchObject({
      currentCode: 'b',
      status: 'in_progress',
    });
  });

  it('records a run with its status and its event, as the server does', async () => {
    const { id } = await service.openOrCreate(TRYOUT_ASSIGNMENT_ID);

    expect(service.recordRun(id, 'code', FAILED)).toMatchObject({
      currentCode: 'code',
      status: 'tests_failed',
    });
    const { events } = await service.history(id);
    expect(events).toEqual([
      expect.objectContaining({
        attemptId: id,
        type: 'run',
        detail: { passed: 1, failed: 1, failedTestIds: ['test-2'] },
      }),
    ]);
    expect(service.lastRun(id)).toEqual({ passed: 1, failed: 1, failedTestIds: ['test-2'] });
  });

  it('submits only a passed attempt, freezing its code', async () => {
    const { id } = await service.openOrCreate(TRYOUT_ASSIGNMENT_ID);
    await expect(service.submit(id)).rejects.toEqual(
      new DataError('invalid', 'Only a passed attempt can be submitted'),
    );
    service.recordRun(id, 'done', PASSED);

    expect(await service.submit(id)).toMatchObject({ status: 'submitted', finalCode: 'done' });
    await expect(service.saveCode(id, 'x')).rejects.toEqual(
      new DataError('invalid', 'A submitted attempt cannot change'),
    );
  });

  it('practises again with a new attempt once submitted, and keeps an open one', async () => {
    await expect(service.retry()).rejects.toEqual(
      new DataError('invalid', 'Only a submitted attempt can be practised again'),
    );
    const first = await service.openOrCreate(TRYOUT_ASSIGNMENT_ID);
    expect(await service.retry()).toEqual(first);
    service.recordRun(first.id, 'done', PASSED);
    await service.submit(first.id);

    const second = await service.retry();

    expect(second).toMatchObject({ number: 2, currentCode: '', status: 'in_progress' });
    expect(second.id).not.toBe(first.id);
    expect((await service.list()).map((each) => each.number)).toEqual([1, 2]);
    // Changing one leaves the other as it was
    await service.saveCode(second.id, 'x');
    expect(service.find(first.id)).toMatchObject({ status: 'submitted', finalCode: 'done' });
  });

  it('keeps the answers of the tutor with their attempt, for its history', async () => {
    const { id } = await service.openOrCreate(TRYOUT_ASSIGNMENT_ID);
    service.recordAnswer(answer(id));
    service.recordAnswer(answer('another'));

    expect((await service.history(id)).interactions).toEqual([answer(id)]);
    expect(service.answers(id)).toEqual([answer(id)]);
  });

  it('opens an attempt without a user while the session is still being restored', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        TryoutAttemptService,
        { provide: TRYOUT_EXERCISE, useValue: EXERCISE },
        { provide: AuthStore, useValue: { userId: () => undefined } },
      ],
    });

    const attempt = await TestBed.inject(TryoutAttemptService).openOrCreate(TRYOUT_ASSIGNMENT_ID);

    expect(attempt.userId).toBe('');
  });

  it('says it does not know an attempt of another try', async () => {
    await expect(service.saveCode('nope', '')).rejects.toEqual(new DataError('not_found'));
    expect(() => service.recordRun('nope', '', PASSED)).toThrow(new DataError('not_found'));
    expect(service.lastRun('nope')).toBeNull();
  });

  it('starts again from nothing', async () => {
    const first = await service.openOrCreate(TRYOUT_ASSIGNMENT_ID);
    service.recordAnswer(answer(first.id));

    service.reset();

    const fresh = await service.openOrCreate(TRYOUT_ASSIGNMENT_ID);
    expect(fresh.id).not.toBe(first.id);
    expect(await service.list()).toEqual([fresh]);
    expect(service.answers(first.id)).toEqual([]);
  });
});
