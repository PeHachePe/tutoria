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
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** What the mock server answers to a save: the code it got, back in `in_progress` (2.4). */
function savedAs(attempt: Attempt, code: string): Attempt {
  return {
    ...attempt,
    currentCode: code,
    status: 'in_progress',
    updatedAt: '2026-11-08T10:05:00.000Z',
  };
}

describe('AttemptStore', () => {
  let openOrCreate: ReturnType<typeof vi.fn<AttemptService['openOrCreate']>>;
  let saveCode: ReturnType<typeof vi.fn<AttemptService['saveCode']>>;
  let store: AttemptStore;

  beforeEach(() => {
    openOrCreate = vi.fn<AttemptService['openOrCreate']>();
    saveCode = vi.fn<AttemptService['saveCode']>();
    TestBed.configureTestingModule({
      providers: [AttemptStore, { provide: AttemptService, useValue: { openOrCreate, saveCode } }],
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

  describe('autosave', () => {
    const attempt = attemptOf('exercise-3', 'passed');

    beforeEach(async () => {
      vi.useFakeTimers();
      openOrCreate.mockResolvedValue(attempt);
      saveCode.mockImplementation((_id, code) => Promise.resolve(savedAs(attempt, code)));
      await store.open('exercise-3');
    });

    afterEach(() => vi.useRealTimers());

    it('starts with everything saved', () => {
      expect(store.saveStatus()).toBe('idle');
      expect(store.hasUnsavedChanges()).toBe(false);
    });

    it('keeps the code at once and invalidates the last run, as the server will', () => {
      store.updateCode('function suma() {}');

      expect(store.attempt()?.currentCode).toBe('function suma() {}');
      expect(store.status()).toBe('in_progress');
      expect(store.saveStatus()).toBe('pending');
      expect(store.hasUnsavedChanges()).toBe(true);
    });

    it('saves the latest code once the student stops typing for 800 ms', async () => {
      store.updateCode('function');
      await vi.advanceTimersByTimeAsync(500);
      store.updateCode('function suma');
      await vi.advanceTimersByTimeAsync(799);
      expect(saveCode).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);

      expect(saveCode).toHaveBeenCalledExactlyOnceWith(attempt.id, 'function suma');
      expect(store.saveStatus()).toBe('saved');
      expect(store.hasUnsavedChanges()).toBe(false);
      expect(store.attempt()?.updatedAt).toBe('2026-11-08T10:05:00.000Z');
    });

    it('says it is saving while the answer has not arrived', async () => {
      const answer = deferred<Attempt>();
      saveCode.mockReturnValueOnce(answer.promise);
      store.updateCode('x');
      await vi.advanceTimersByTimeAsync(800);

      expect(store.saveStatus()).toBe('saving');
      expect(store.hasUnsavedChanges()).toBe(true);

      answer.resolve(savedAs(attempt, 'x'));
      await vi.advanceTimersByTimeAsync(0);
      expect(store.saveStatus()).toBe('saved');
    });

    it('does not schedule a save when the code does not change', async () => {
      store.updateCode('');
      await vi.advanceTimersByTimeAsync(800);

      expect(saveCode).not.toHaveBeenCalled();
      expect(store.status()).toBe('passed');
    });

    it('keeps what the student typed while a save was on its way', async () => {
      const answer = deferred<Attempt>();
      saveCode.mockReturnValueOnce(answer.promise);
      store.updateCode('first');
      await vi.advanceTimersByTimeAsync(800);

      store.updateCode('first and more');
      answer.resolve(savedAs(attempt, 'first'));
      await vi.advanceTimersByTimeAsync(0);

      expect(store.attempt()?.currentCode).toBe('first and more');
      expect(store.saveStatus()).toBe('pending');
    });

    it('sends one save at a time and then the latest code', async () => {
      const answer = deferred<Attempt>();
      saveCode.mockReturnValueOnce(answer.promise);
      store.updateCode('first');
      await vi.advanceTimersByTimeAsync(800);
      store.updateCode('second');
      await vi.advanceTimersByTimeAsync(800);
      expect(saveCode).toHaveBeenCalledOnce();

      answer.resolve(savedAs(attempt, 'first'));
      await vi.advanceTimersByTimeAsync(0);

      expect(saveCode).toHaveBeenCalledTimes(2);
      expect(saveCode).toHaveBeenLastCalledWith(attempt.id, 'second');
      expect(store.saveStatus()).toBe('saved');
    });

    it('says the code was not saved, keeps it and saves it again on retry', async () => {
      saveCode.mockRejectedValueOnce(new DataError('network'));
      store.updateCode('x');
      await vi.advanceTimersByTimeAsync(800);

      expect(store.saveStatus()).toBe('error');
      expect(store.hasUnsavedChanges()).toBe(true);
      expect(store.attempt()?.currentCode).toBe('x');

      await store.retrySave();

      expect(saveCode).toHaveBeenCalledTimes(2);
      expect(store.saveStatus()).toBe('saved');
    });

    it('sends nothing on retry when everything is saved', async () => {
      await store.retrySave();

      expect(saveCode).not.toHaveBeenCalled();
    });

    it('clears the error when the student keeps typing', async () => {
      saveCode.mockRejectedValueOnce(new DataError('network'));
      store.updateCode('x');
      await vi.advanceTimersByTimeAsync(800);

      store.updateCode('xy');

      expect(store.saveStatus()).toBe('pending');
    });

    it('saves at once on saveNow, without waiting', async () => {
      store.updateCode('x');

      store.saveNow();
      await vi.advanceTimersByTimeAsync(0);

      expect(saveCode).toHaveBeenCalledExactlyOnceWith(attempt.id, 'x');
    });

    it('saves the pending code of an exercise before opening another', async () => {
      store.updateCode('x');
      openOrCreate.mockResolvedValueOnce(attemptOf('exercise-4'));

      await store.open('exercise-4');

      expect(saveCode).toHaveBeenCalledExactlyOnceWith(attempt.id, 'x');
      expect(store.attempt()?.exerciseId).toBe('exercise-4');
      expect(store.saveStatus()).toBe('idle');
    });

    it('does not let a late save of the previous exercise touch the new one', async () => {
      const answer = deferred<Attempt>();
      saveCode.mockReturnValueOnce(answer.promise);
      store.updateCode('x');
      store.saveNow();
      openOrCreate.mockResolvedValueOnce(attemptOf('exercise-4'));
      await store.open('exercise-4');

      answer.resolve(savedAs(attempt, 'x'));
      await vi.advanceTimersByTimeAsync(0);

      expect(store.attempt()?.exerciseId).toBe('exercise-4');
      expect(store.saveStatus()).toBe('idle');
    });

    it('does not show a failed save of the previous exercise in the new one', async () => {
      const answer = deferred<Attempt>();
      saveCode.mockReturnValueOnce(answer.promise);
      store.updateCode('x');
      store.saveNow();
      openOrCreate.mockResolvedValueOnce(attemptOf('exercise-4'));
      await store.open('exercise-4');

      answer.reject(new DataError('network'));
      await vi.advanceTimersByTimeAsync(0);

      expect(store.saveStatus()).toBe('idle');
    });

    it('saves the pending code when the student leaves the screen', () => {
      store.updateCode('x');

      TestBed.resetTestingModule();

      expect(saveCode).toHaveBeenCalledExactlyOnceWith(attempt.id, 'x');
    });

    it('does not change a submitted attempt, which is read only', async () => {
      openOrCreate.mockResolvedValueOnce(attemptOf('exercise-5', 'submitted'));
      await store.open('exercise-5');

      store.updateCode('x');
      await vi.advanceTimersByTimeAsync(800);

      expect(store.attempt()?.currentCode).toBe('');
      expect(store.status()).toBe('submitted');
      expect(saveCode).not.toHaveBeenCalled();
    });
  });

  it('ignores the code while there is no attempt', () => {
    store.updateCode('x');

    expect(store.attempt()).toBeUndefined();
    expect(store.saveStatus()).toBe('idle');
  });
});
