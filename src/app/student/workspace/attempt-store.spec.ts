import { TestBed } from '@angular/core/testing';

import type { Attempt, StoredAttemptStatus } from '../../data/attempt';
import { AttemptService } from '../../data/attempt-service';
import { DataError } from '../../data/data-error';
import { AttemptStore } from './attempt-store';

function attemptOf(exerciseId: string, status: StoredAttemptStatus = 'in_progress'): Attempt {
  return {
    id: `attempt-${exerciseId}`,
    exerciseId,
    userId: 'student-1',
    assignmentId: `assignment-${exerciseId}`,
    currentCode: '',
    finalCode: null,
    status,
    startedAt: '2026-11-08T10:00:00.000Z',
    finishedAt: null,
    updatedAt: '2026-11-08T10:00:00.000Z',
  };
}

/** A promise the test resolves when it wants, to control the order of the answers. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

describe('AttemptStore', () => {
  let openOrCreate: ReturnType<typeof vi.fn<AttemptService['openOrCreate']>>;
  let store: AttemptStore;

  beforeEach(() => {
    openOrCreate = vi.fn<AttemptService['openOrCreate']>();
    TestBed.configureTestingModule({
      providers: [AttemptStore, { provide: AttemptService, useValue: { openOrCreate } }],
    });
    store = TestBed.inject(AttemptStore);
  });

  it('starts without an attempt', () => {
    expect(store.attempt()).toBeUndefined();
    expect(store.status()).toBe('not_started');
  });

  it('opens or creates the attempt of the exercise and returns it', async () => {
    const attempt = attemptOf('exercise-3', 'tests_failed');
    openOrCreate.mockResolvedValue(attempt);

    await expect(store.open('exercise-3')).resolves.toEqual(attempt);

    expect(openOrCreate).toHaveBeenCalledWith('exercise-3');
    expect(store.attempt()).toEqual(attempt);
    expect(store.status()).toBe('tests_failed');
  });

  it('forgets the previous attempt while it opens another exercise', async () => {
    openOrCreate.mockResolvedValueOnce(attemptOf('exercise-1'));
    await store.open('exercise-1');
    const next = deferred<Attempt>();
    openOrCreate.mockReturnValueOnce(next.promise);

    const opening = store.open('exercise-2');

    expect(store.attempt()).toBeUndefined();
    next.resolve(attemptOf('exercise-2'));
    await opening;
    expect(store.attempt()?.exerciseId).toBe('exercise-2');
  });

  it('ignores an answer that arrives after the student opened another exercise', async () => {
    const first = deferred<Attempt>();
    const second = deferred<Attempt>();
    openOrCreate.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const openingFirst = store.open('exercise-1');
    const openingSecond = store.open('exercise-2');
    second.resolve(attemptOf('exercise-2'));
    await openingSecond;
    first.resolve(attemptOf('exercise-1'));
    await openingFirst;

    expect(store.attempt()?.exerciseId).toBe('exercise-2');
  });

  it('stays without an attempt and passes on the error when it cannot open it', async () => {
    openOrCreate.mockRejectedValue(new DataError('not_found'));

    await expect(store.open('exercise-9')).rejects.toEqual(new DataError('not_found'));

    expect(store.attempt()).toBeUndefined();
  });
});
