import { TestBed } from '@angular/core/testing';

import type { RunResult } from '../../../data/attempt';
import { CodeRunnerService } from '../../../data/code-runner-service';
import { DataError } from '../../../data/data-error';
import { TryoutAttemptService } from './tryout-attempt-service';
import { concealHidden, TryoutCodeRunner } from './tryout-code-runner';
import { TRYOUT_ASSIGNMENT_ID } from './tryout-exercise';
import { TRYOUT_SUM, tryoutInjector } from './tryout-testing';

/** What `check` gives: every test with its details, the hidden one too. */
const CHECKED: RunResult = {
  status: 'tests_failed',
  results: [
    { testId: 'test-1', passed: true, timeout: false, input: [[1, 2]], expected: 3, actual: 3 },
    {
      testId: 'test-2',
      passed: false,
      timeout: false,
      input: [[]],
      expected: 0,
      error: 'boom',
      line: 2,
    },
  ],
};

describe('TryoutCodeRunner', () => {
  let check: ReturnType<typeof vi.fn>;
  let runner: TryoutCodeRunner;
  let attempts: TryoutAttemptService;

  beforeEach(() => {
    check = vi.fn().mockResolvedValue(CHECKED);
    TestBed.configureTestingModule({
      providers: [{ provide: CodeRunnerService, useValue: { check } }],
    });
    const injector = tryoutInjector([TryoutCodeRunner]);
    runner = injector.get(TryoutCodeRunner);
    attempts = injector.get(TryoutAttemptService);
  });

  it('runs the code against the tests of the form, as a student sees the result', async () => {
    const { id } = await attempts.openOrCreate(TRYOUT_ASSIGNMENT_ID);

    const result = await runner.run(id, 'code');

    expect(check).toHaveBeenCalledWith({
      code: 'code',
      functionName: 'sum',
      tests: TRYOUT_SUM.tests,
    });
    expect(result.results).toEqual([
      CHECKED.results[0],
      { testId: 'test-2', passed: false, timeout: false },
    ]);
    expect(attempts.find(id)).toMatchObject({ currentCode: 'code', status: 'tests_failed' });
  });

  it('does not run a submitted attempt', async () => {
    const { id } = await attempts.openOrCreate(TRYOUT_ASSIGNMENT_ID);
    attempts.recordRun(id, 'done', { status: 'passed', results: [] });
    await attempts.submit(id);

    await expect(runner.run(id, 'done')).rejects.toEqual(
      new DataError('invalid', 'The attempt is submitted'),
    );
    expect(check).not.toHaveBeenCalled();
  });

  it('checks a solution with the runner of the app', async () => {
    const solution = { code: 'c', functionName: 'sum', tests: TRYOUT_SUM.tests };

    expect(await runner.check(solution)).toBe(CHECKED);
    expect(check).toHaveBeenCalledWith(solution);
  });

  it('keeps a load error, which tells nothing of the hidden tests', () => {
    const failed: RunResult = {
      status: 'tests_failed',
      results: [{ testId: 'test-1', passed: false, timeout: false }],
      loadError: { kind: 'missing_function' },
    };

    expect(concealHidden(failed, [])).toEqual(failed);
  });
});
