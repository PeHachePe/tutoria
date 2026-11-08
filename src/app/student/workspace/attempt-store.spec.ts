import { TestBed } from '@angular/core/testing';

import { AuthStore } from '../../auth/auth-store';
import { FakeAuthService } from '../../auth/auth-testing';
import { AuthService } from '../../data/auth-service';
import type { Attempt, RunResult, StoredAttemptStatus } from '../../data/attempt';
import { AttemptService } from '../../data/attempt-service';
import { CodeRunnerService } from '../../data/code-runner-service';
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
  let submit: ReturnType<typeof vi.fn<AttemptService['submit']>>;
  let run: ReturnType<typeof vi.fn<CodeRunnerService['run']>>;
  let store: AttemptStore;
  let authService: FakeAuthService;

  beforeEach(() => {
    authService = new FakeAuthService();
    openOrCreate = vi.fn<AttemptService['openOrCreate']>();
    saveCode = vi.fn<AttemptService['saveCode']>();
    submit = vi.fn<AttemptService['submit']>();
    run = vi.fn<CodeRunnerService['run']>();
    TestBed.configureTestingModule({
      providers: [
        AttemptStore,
        { provide: AttemptService, useValue: { openOrCreate, saveCode, submit } },
        { provide: CodeRunnerService, useValue: { run } },
        { provide: AuthService, useValue: authService },
      ],
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

    it('saves the pending code before signing out, while the session still exists', async () => {
      const answer = deferred<Attempt>();
      saveCode.mockReturnValueOnce(answer.promise);
      store.updateCode('x');
      let signedOut = false;
      const signingOut = TestBed.inject(AuthStore)
        .signOut()
        .then(() => (signedOut = true));
      await vi.advanceTimersByTimeAsync(0);

      expect(saveCode).toHaveBeenCalledExactlyOnceWith(attempt.id, 'x');
      expect(signedOut).toBe(false);
      answer.resolve(savedAs(attempt, 'x'));
      await signingOut;
      expect(authService.signOut).toHaveBeenCalled();
    });

    it('no longer holds the sign-out once the student left the screen', async () => {
      store.updateCode('x');
      const auth = TestBed.inject(AuthStore);
      TestBed.resetTestingModule(); // which saves the pending code, as leaving the screen does
      saveCode.mockClear();

      await auth.signOut();

      expect(saveCode).not.toHaveBeenCalled();
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

  describe('running the tests', () => {
    const attempt = attemptOf('exercise-3');
    const passing: RunResult = {
      status: 'passed',
      results: [
        { testId: 't1', passed: true, timeout: false },
        { testId: 't2', passed: true, timeout: false },
      ],
    };
    const failing: RunResult = {
      status: 'tests_failed',
      results: [
        { testId: 't1', passed: true, timeout: false },
        { testId: 't2', passed: false, timeout: true },
      ],
    };

    beforeEach(async () => {
      vi.useFakeTimers();
      openOrCreate.mockResolvedValue(attempt);
      saveCode.mockImplementation((_id, code) => Promise.resolve(savedAs(attempt, code)));
      await store.open('exercise-3');
    });

    afterEach(() => vi.useRealTimers());

    it('starts without results, ready to run and not to submit', () => {
      expect(store.lastRun()).toBeUndefined();
      expect(store.testCount()).toBeUndefined();
      expect(store.canRun()).toBe(true);
      expect(store.canSubmit()).toBe(false);
    });

    it('runs the current code instead of waiting for the autosave, which it drops', async () => {
      run.mockResolvedValue(failing);
      store.updateCode('code');

      await store.run();
      await vi.advanceTimersByTimeAsync(800);

      expect(run).toHaveBeenCalledExactlyOnceWith(attempt.id, 'code');
      expect(saveCode).not.toHaveBeenCalled();
      expect(store.lastRun()).toEqual(failing);
      expect(store.status()).toBe('tests_failed');
      expect(store.testCount()).toEqual({ passed: 1, total: 2 });
      // The runner saved the code, as the server does
      expect(store.hasUnsavedChanges()).toBe(false);
    });

    it('says it is running and lets nothing else start meanwhile', async () => {
      const answer = deferred<RunResult>();
      run.mockReturnValueOnce(answer.promise);
      store.updateCode('code');

      const running = store.run();
      expect(store.running()).toBe(true);
      expect(store.canRun()).toBe(false);
      await store.run();
      expect(run).toHaveBeenCalledOnce();

      answer.resolve(passing);
      await running;
      expect(store.running()).toBe(false);
      expect(store.canSubmit()).toBe(true);
    });

    it('waits for a save on its way before running', async () => {
      const save = deferred<Attempt>();
      saveCode.mockReturnValueOnce(save.promise);
      run.mockResolvedValue(passing);
      store.updateCode('first');
      await vi.advanceTimersByTimeAsync(800);
      store.updateCode('second');

      const running = store.run();
      await vi.advanceTimersByTimeAsync(0);
      expect(run).not.toHaveBeenCalled();

      save.resolve(savedAs(attempt, 'first'));
      await running;
      expect(run).toHaveBeenCalledExactlyOnceWith(attempt.id, 'second');
      expect(store.status()).toBe('passed');
    });

    it('marks the results as outdated once the student changes the code', async () => {
      run.mockResolvedValue(passing);
      await store.run();
      expect(store.runOutdated()).toBe(false);

      store.updateCode('changed');

      expect(store.runOutdated()).toBe(true);
      expect(store.testCount()).toBeUndefined();
      expect(store.status()).toBe('in_progress');
      expect(store.canSubmit()).toBe(false);
    });

    it('keeps the attempt in progress when the student typed during the run', async () => {
      const answer = deferred<RunResult>();
      run.mockReturnValueOnce(answer.promise);
      store.updateCode('ran');
      const running = store.run();
      await vi.advanceTimersByTimeAsync(0);
      expect(run).toHaveBeenCalledExactlyOnceWith(attempt.id, 'ran');
      store.updateCode('ran and more');

      answer.resolve(passing);
      await running;

      expect(store.status()).toBe('in_progress');
      expect(store.runOutdated()).toBe(true);
      expect(store.saveStatus()).toBe('pending');
      await vi.advanceTimersByTimeAsync(800);
      expect(saveCode).toHaveBeenCalledExactlyOnceWith(attempt.id, 'ran and more');
    });

    it('keeps the error, and the code to save, when the run fails', async () => {
      const error = new DataError('network');
      run.mockRejectedValueOnce(error);
      store.updateCode('code');

      await store.run();

      expect(store.actionError()).toEqual({ action: 'run', error });
      expect(store.status()).toBe('in_progress');
      expect(store.running()).toBe(false);
      await vi.advanceTimersByTimeAsync(800);
      expect(saveCode).toHaveBeenCalledExactlyOnceWith(attempt.id, 'code');

      run.mockResolvedValueOnce(passing);
      await store.run();
      expect(store.actionError()).toBeUndefined();
    });

    it('does not run once the student opened another exercise while a save was on its way', async () => {
      const save = deferred<Attempt>();
      saveCode.mockReturnValueOnce(save.promise);
      store.updateCode('first');
      await vi.advanceTimersByTimeAsync(800);
      const running = store.run();
      openOrCreate.mockResolvedValueOnce(attemptOf('exercise-4'));
      await store.open('exercise-4');

      save.resolve(savedAs(attempt, 'first'));
      await running;

      expect(run).not.toHaveBeenCalled();
      expect(store.lastRun()).toBeUndefined();
    });

    it('keeps saying it is running the attempt now open when an earlier run ends', async () => {
      const first = deferred<RunResult>();
      const second = deferred<RunResult>();
      run.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const runningFirst = store.run();
      await vi.advanceTimersByTimeAsync(0);
      openOrCreate.mockResolvedValueOnce(attemptOf('exercise-4'));
      await store.open('exercise-4');
      const runningSecond = store.run();

      first.resolve(passing);
      await runningFirst;

      expect(store.running()).toBe(true);
      second.resolve(failing);
      await runningSecond;
      expect(store.running()).toBe(false);
      expect(store.status()).toBe('tests_failed');
    });

    it('has nothing to save after a failed run of saved code', async () => {
      run.mockRejectedValueOnce(new DataError('network'));

      await store.run();
      await vi.advanceTimersByTimeAsync(800);

      expect(store.actionError()?.action).toBe('run');
      expect(saveCode).not.toHaveBeenCalled();
    });

    it('ignores the answer of a run once the student opened another exercise', async () => {
      const answer = deferred<RunResult>();
      run.mockReturnValueOnce(answer.promise);
      const running = store.run();
      await vi.advanceTimersByTimeAsync(0);
      openOrCreate.mockResolvedValueOnce(attemptOf('exercise-4'));
      await store.open('exercise-4');
      expect(store.running()).toBe(false);

      answer.resolve(passing);
      await running;

      expect(store.lastRun()).toBeUndefined();
      expect(store.status()).toBe('in_progress');
    });

    it('ignores the error of a run once the student opened another exercise', async () => {
      const answer = deferred<RunResult>();
      run.mockReturnValueOnce(answer.promise);
      const running = store.run();
      await vi.advanceTimersByTimeAsync(0);
      openOrCreate.mockResolvedValueOnce(attemptOf('exercise-4'));
      await store.open('exercise-4');

      answer.reject(new DataError('network'));
      await running;

      expect(store.actionError()).toBeUndefined();
    });

    it('forgets the results when it opens another exercise', async () => {
      run.mockResolvedValue(failing);
      await store.run();
      openOrCreate.mockResolvedValueOnce(attemptOf('exercise-4'));

      await store.open('exercise-4');

      expect(store.lastRun()).toBeUndefined();
      expect(store.runOutdated()).toBe(false);
    });

    it('does not run without an attempt or once submitted', async () => {
      openOrCreate.mockResolvedValueOnce(attemptOf('exercise-5', 'submitted'));
      await store.open('exercise-5');

      await store.run();

      expect(store.canRun()).toBe(false);
      expect(run).not.toHaveBeenCalled();
    });
  });

  describe('submitting', () => {
    const attempt = attemptOf('exercise-3', 'passed');
    const submitted: Attempt = {
      ...attempt,
      currentCode: 'done',
      finalCode: 'done',
      status: 'submitted',
      finishedAt: '2026-11-08T10:30:00.000Z',
    };

    beforeEach(async () => {
      openOrCreate.mockResolvedValue(attempt);
      await store.open('exercise-3');
    });

    it('submits a passed attempt, which becomes read only', async () => {
      submit.mockResolvedValue(submitted);

      await expect(store.submit()).resolves.toBe(true);

      expect(submit).toHaveBeenCalledExactlyOnceWith(attempt.id);
      expect(store.attempt()).toEqual(submitted);
      expect(store.readonly()).toBe(true);
      expect(store.canRun()).toBe(false);
      expect(store.canSubmit()).toBe(false);
    });

    it('says it is submitting meanwhile', async () => {
      const answer = deferred<Attempt>();
      submit.mockReturnValueOnce(answer.promise);

      const submitting = store.submit();
      expect(store.submitting()).toBe(true);
      expect(store.canSubmit()).toBe(false);
      expect(store.canRun()).toBe(false);

      answer.resolve(submitted);
      await submitting;
      expect(store.submitting()).toBe(false);
    });

    it('keeps the error when it fails, and the attempt as it was', async () => {
      const error = new DataError('network');
      submit.mockRejectedValueOnce(error);

      await expect(store.submit()).resolves.toBe(false);

      expect(store.actionError()).toEqual({ action: 'submit', error });
      expect(store.status()).toBe('passed');
      expect(store.submitting()).toBe(false);
    });

    it('only submits a passed attempt', async () => {
      openOrCreate.mockResolvedValueOnce(attemptOf('exercise-4', 'tests_failed'));
      await store.open('exercise-4');

      await expect(store.submit()).resolves.toBe(false);

      expect(submit).not.toHaveBeenCalled();
    });

    it('ignores the answer once the student opened another exercise', async () => {
      const answer = deferred<Attempt>();
      submit.mockReturnValueOnce(answer.promise);
      const submitting = store.submit();
      openOrCreate.mockResolvedValueOnce(attemptOf('exercise-4'));
      await store.open('exercise-4');

      answer.resolve(submitted);

      await expect(submitting).resolves.toBe(false);
      expect(store.status()).toBe('in_progress');
      expect(store.submitting()).toBe(false);
    });

    it('keeps saying it is submitting the attempt now open when an earlier one answers', async () => {
      const first = deferred<Attempt>();
      const second = deferred<Attempt>();
      submit.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const submittingFirst = store.submit();
      openOrCreate.mockResolvedValueOnce(attemptOf('exercise-4', 'passed'));
      await store.open('exercise-4');
      const submittingSecond = store.submit();

      first.resolve(submitted);
      await submittingFirst;

      expect(store.submitting()).toBe(true);
      second.resolve({ ...attemptOf('exercise-4', 'submitted') });
      await expect(submittingSecond).resolves.toBe(true);
      expect(store.submitting()).toBe(false);
    });

    it('ignores the error once the student opened another exercise', async () => {
      const answer = deferred<Attempt>();
      submit.mockReturnValueOnce(answer.promise);
      const submitting = store.submit();
      openOrCreate.mockResolvedValueOnce(attemptOf('exercise-4'));
      await store.open('exercise-4');

      answer.reject(new DataError('network'));

      await expect(submitting).resolves.toBe(false);
      expect(store.actionError()).toBeUndefined();
    });
  });
});
