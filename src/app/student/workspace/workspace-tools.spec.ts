import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthStore } from '../../auth/auth-store';
import { LanguageService } from '../../core/i18n/language-service';
import { type AppTool, runTool } from '../../core/tools/app-tool';
import type { Attempt, AttemptHistory, RunResult } from '../../data/attempt';
import { AttemptService } from '../../data/attempt-service';
import type { AssignedExercise } from '../../data/exercise';
import { ExerciseService } from '../../data/exercise-service';
import type { ProcessEvent } from '../../data/process-event';
import type { TutorInteraction } from '../../data/tutor';
import { type ActionError, AttemptStore } from './attempt-store';
import { TutorStore } from './tutor-store';
import { workspaceTools } from './workspace-tools';

function entry(id: string, title: string): AssignedExercise {
  return {
    exercise: {
      id,
      title,
      statement: '',
      topics: [],
      sourceLocale: 'es',
      translations: {},
      difficulty: 'initial',
    } as unknown as AssignedExercise['exercise'],
    assignmentId: `a-${id}`,
    group: {
      id: 'g',
      name: '1.º DAM B',
      subject: { id: 's', name: 'Programación básica', sourceLocale: 'es', translations: {} },
    },
    block: {
      id: 'b',
      groupId: 'g',
      position: 1,
      title: 'Tema 1',
      sourceLocale: 'es',
      translations: {},
      isHidden: false,
    },
    updatedAt: null,
    status: 'tests_failed',
    hintCount: 0,
    hintLevel: null,
    practice: null,
    repetitions: 0,
  };
}

const run = (passed: number, failed: number): ProcessEvent => ({
  id: `run-${passed}-${failed}`,
  attemptId: 't1',
  type: 'run',
  timestamp: '2026-11-12T10:00:00Z',
  detail: { passed, failed, failedTestIds: [] },
});

const hint = (level: 1 | 2): TutorInteraction => ({
  id: `h${level}`,
  attemptId: 't1',
  trigger: 'hint',
  hintLevel: level,
  studentMessage: null,
  transcript: 'Pista',
  emotion: 'encouragement',
  intensity: 1,
  elusion: false,
  promptVersion: 'v4',
  createdAt: '2026-11-12T10:00:00Z',
});

describe('workspaceTools', () => {
  let userId: ReturnType<typeof signal<string | undefined>>;
  let current: ReturnType<typeof signal<Partial<Attempt> | undefined>>;
  let list: ReturnType<typeof vi.fn>;
  let history: ReturnType<typeof vi.fn>;
  let tutor: { mark: ReturnType<typeof vi.fn>; pointAt: ReturnType<typeof vi.fn> };
  let attemptStore: {
    attempt: typeof current;
    canRun: ReturnType<typeof signal<boolean>>;
    run: ReturnType<typeof vi.fn>;
    lastRun: ReturnType<typeof signal<RunResult | undefined>>;
    actionError: ReturnType<typeof signal<ActionError | undefined>>;
  };
  let tools: AppTool[];

  const use = (name: string, args: unknown) =>
    runTool(
      tools.find((tool) => tool.name === name)!,
      args,
    );

  beforeEach(() => {
    userId = signal<string | undefined>('u1');
    current = signal<Partial<Attempt> | undefined>({ assignmentId: 'a-1' });
    list = vi.fn(() =>
      Promise.resolve([
        { id: 't0', number: 1, status: 'submitted' },
        { id: 't1', number: 2, status: 'tests_failed' },
      ]),
    );
    history = vi.fn((): Promise<Partial<AttemptHistory>> =>
      Promise.resolve({
        events: [run(1, 3), run(2, 2), { ...run(0, 0), type: 'paste' } as ProcessEvent, run(4, 0)],
        interactions: [hint(1), { ...hint(2), trigger: 'question' }, hint(2)],
      }),
    );
    tutor = { mark: vi.fn(), pointAt: vi.fn() };
    attemptStore = {
      attempt: current,
      canRun: signal(true),
      run: vi.fn(() => Promise.resolve()),
      lastRun: signal<RunResult | undefined>(undefined),
      actionError: signal<ActionError | undefined>(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthStore, useValue: { userId } },
        { provide: LanguageService, useValue: { locale: 'es' } },
        {
          provide: ExerciseService,
          useValue: {
            listAssigned: () => Promise.resolve([entry('1', 'Suma'), entry('2', 'Media')]),
          },
        },
        { provide: AttemptService, useValue: { list, history } },
        { provide: AttemptStore, useValue: attemptStore },
        { provide: TutorStore, useValue: tutor },
      ],
    });
    tools = TestBed.runInInjectionContext(() => workspaceTools());
  });

  it('are the tools of the workspace, open to WebMCP but running the tests (2.5f)', () => {
    expect(tools.map((tool) => [tool.name, tool.webMcp])).toEqual([
      ['getExerciseStats', true],
      ['highlightLines', true],
      ['pointAt', true],
      ['runTests', false],
    ]);
  });

  it('run the tests, as «Ejecutar» does, and say how it went (2.5f)', async () => {
    const result = (passed: boolean) => ({ testId: 't', passed, timeout: false });
    attemptStore.run.mockImplementation(() => {
      attemptStore.lastRun.set({
        status: 'tests_failed',
        results: [result(true), result(false), result(true)],
      });
      return Promise.resolve();
    });
    expect(await use('runTests', {})).toEqual({ ok: true, result: { passed: 2, total: 3 } });

    attemptStore.run.mockImplementation(() => {
      attemptStore.lastRun.set({
        status: 'tests_failed',
        results: [result(false)],
        loadError: { kind: 'invalid_code', message: 'SyntaxError: x' },
      });
      return Promise.resolve();
    });
    expect(await use('runTests', {})).toEqual({ ok: true, result: { loaded: false } });
  });

  it('say why the tests did not run', async () => {
    attemptStore.run.mockImplementation(() => {
      attemptStore.actionError.set({ action: 'run', error: new Error('offline') });
      return Promise.resolve();
    });
    expect(await use('runTests', {})).toEqual({ ok: false, error: 'The tests could not run' });
    attemptStore.canRun.set(false);
    expect(await use('runTests', {})).toEqual({
      ok: false,
      error: 'The tests cannot run now: the attempt is submitted, running or open elsewhere',
    });
  });

  it('tell how the student is doing with the exercise open now', async () => {
    expect(await use('getExerciseStats', {})).toEqual({
      ok: true,
      result: {
        exercise: 'Suma',
        status: 'tests_failed',
        attempts: [
          { number: 1, status: 'submitted' },
          { number: 2, status: 'tests_failed' },
        ],
        runs: 3,
        failedRuns: 2,
        lastRun: { passed: 4, failed: 0 },
        hints: 2,
        hintLevel: 2,
      },
    });
    expect(list).toHaveBeenCalledWith('a-1');
    expect(history).toHaveBeenCalledWith('t1');
  });

  it('tell it of another exercise, by words of its title, also before any attempt', async () => {
    list.mockResolvedValueOnce([]);
    expect(await use('getExerciseStats', { exercise: 'media' })).toEqual({
      ok: true,
      result: expect.objectContaining({
        exercise: 'Media',
        attempts: [],
        runs: 0,
        failedRuns: 0,
        lastRun: null,
        hints: 0,
        hintLevel: 0,
      }),
    });
    expect(list).toHaveBeenCalledWith('a-2');
  });

  it('say what they cannot find, and need a student', async () => {
    expect(await use('getExerciseStats', { exercise: 'química' })).toEqual({
      ok: false,
      error: 'No assigned exercise matches «química»',
    });
    current.set(undefined);
    expect(await use('getExerciseStats', {})).toEqual({
      ok: false,
      error: 'No assigned exercise matches «this one»',
    });
    userId.set(undefined);
    expect(await use('getExerciseStats', {})).toEqual({
      ok: false,
      error: 'The student is not signed in',
    });
  });

  it('mark lines of the code with their notes', async () => {
    const lines = [{ line: 3, note: 'Revisa la condición' }, { line: 5 }];
    expect(await use('highlightLines', { lines })).toEqual({
      ok: true,
      result: { marked: [3, 5] },
    });
    expect(tutor.mark).toHaveBeenCalledWith(lines);
  });

  it('point at an example, the failing test or the hidden checks', async () => {
    expect(await use('pointAt', { target: 'example', example: 2 })).toEqual({
      ok: true,
      result: { pointed: 'example' },
    });
    expect(tutor.pointAt).toHaveBeenLastCalledWith('example', 2);
    await use('pointAt', { target: 'failingTest', example: 2 });
    expect(tutor.pointAt).toHaveBeenLastCalledWith('failingTest', undefined);
    expect(await use('pointAt', { target: 'example' })).toEqual({
      ok: false,
      error: 'Say which example, from 1',
    });
  });
});
