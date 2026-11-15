import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { LanguageService } from '../../../core/i18n/language-service';
import { type AppTool, runTool } from '../../../core/tools/app-tool';
import type { Attempt } from '../../../data/attempt';
import { AttemptService } from '../../../data/attempt-service';
import { ExerciseService } from '../../../data/exercise-service';
import { AttemptStore } from '../../../student/workspace/attempt-store';
import { TutorStore } from '../../../student/workspace/tutor-store';
import { TryoutAttemptService } from './tryout-attempt-service';
import { TRYOUT_ASSIGNMENT_ID } from './tryout-exercise';
import { tryoutInjector } from './tryout-testing';
import { tryoutTools } from './tryout-tools';

describe('tryoutTools', () => {
  let attempts: TryoutAttemptService;
  let current: ReturnType<typeof signal<Attempt | undefined>>;
  let tools: AppTool[];

  const stats = () =>
    runTool(
      tools.find((tool) => tool.name === 'getExerciseStats')!,
      {},
    );

  beforeEach(() => {
    current = signal<Attempt | undefined>(undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: LanguageService, useValue: { locale: 'es' } },
        { provide: ExerciseService, useValue: {} },
        { provide: TutorStore, useValue: {} },
      ],
    });
    const injector = tryoutInjector([
      { provide: AttemptService, useExisting: TryoutAttemptService },
      { provide: AttemptStore, useValue: { attempt: current } },
    ]);
    attempts = injector.get(TryoutAttemptService);
    tools = injector.runInContext(() => tryoutTools());
  });

  it('are those of the workspace, with the stats of the try instead of the assigned', () => {
    expect(tools.map((tool) => tool.name)).toEqual([
      'highlightLines',
      'pointAt',
      'runTests',
      'getExerciseStats',
    ]);
  });

  it('give the stats of the try: its attempts, runs and hints', async () => {
    const attempt = await attempts.openOrCreate(TRYOUT_ASSIGNMENT_ID);
    attempts.recordRun(attempt.id, 'c', {
      status: 'tests_failed',
      results: [{ testId: 'test-1', passed: false, timeout: false }],
    });
    current.set(attempts.find(attempt.id));

    expect(await stats()).toEqual({
      ok: true,
      result: {
        exercise: 'Suma',
        status: 'tests_failed',
        attempts: [{ number: 1, status: 'tests_failed' }],
        runs: 1,
        failedRuns: 1,
        lastRun: { passed: 0, failed: 1 },
        hints: 0,
        hintLevel: 0,
      },
    });
  });

  it('say so before the try opens', async () => {
    expect(await stats()).toEqual({ ok: false, error: 'The try is not open yet' });
  });
});
