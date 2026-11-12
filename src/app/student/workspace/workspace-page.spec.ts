import { BreakpointObserver } from '@angular/cdk/layout';
import { LOCALE_ID } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { EditorView, runScopeHandlers } from '@codemirror/view';
import { screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import type { Attempt, RunResult, StoredAttemptStatus } from '../../data/attempt';
import { EventLogger } from '../../core/event-logger';
import { ToolRegistry } from '../../core/tools/app-tool';
import { PageReloader } from '../../core/page-reloader';
import { AttemptService } from '../../data/attempt-service';
import { CodeRunnerService } from '../../data/code-runner-service';
import { DataError } from '../../data/data-error';
import { EventService } from '../../data/event-service';
import type { AssignedExercise, ExerciseDetail } from '../../data/exercise';
import type { TutorEvent } from '../../data/tutor';
import { TutorService } from '../../data/tutor-service';
import { ExerciseService } from '../../data/exercise-service';
import { buildRunResult } from '../../data/code-runner/run-result';
import { SEED } from '../../data/mock/fixtures/seed';
import { AttemptStore } from './attempt-store';
import { BrowserSignals } from './browser-signals';
import { FakeTabChannel, provideTestEditingTab, takenByOtherTab } from './editing-tab-testing';
import { CODE_SHARE, paneShareKey, STATEMENT_SHARE, tutorFloatingKey } from './pane-share';
import { SettingsStore } from '../settings/settings-store';
import { TutorStore } from './tutor-store';
import { COMPACT_WORKSPACE_QUERY, WorkspacePage } from './workspace-page';

/** The detail of a seed exercise (0-based index), as the exercise service returns it. */
function detailOf(index: number): ExerciseDetail {
  const exercise = SEED.exercises[index];
  const tests = SEED.tests
    .filter((test) => test.exerciseId === exercise.id)
    .sort((a, b) => a.position - b.position);
  const assignment = SEED.assignments.find((a) => a.exerciseId === exercise.id)!;
  const group = SEED.groups.find((g) => g.id === assignment.groupId)!;
  return {
    exercise,
    assignmentId: assignment.id,
    group: {
      id: group.id,
      name: group.name,
      subject: SEED.subjects.find((subject) => subject.id === group.subjectId)!,
    },
    block: SEED.classBlocks.find((block) => block.id === assignment.blockId)!,
    visibleTests: tests.filter((test) => !test.isHidden),
    hiddenTestCount: tests.filter((test) => test.isHidden).length,
  };
}

const SUM = detailOf(2);

/** Every test of exercise 3, visible and hidden, in order. */
const SUM_TESTS = SEED.tests
  .filter((test) => test.exerciseId === SUM.exercise.id)
  .sort((a, b) => a.position - b.position);

/** A run of exercise 3 in which each test returned the given value. */
function runReturning(...values: unknown[]): RunResult {
  return buildRunResult(SUM_TESTS, { outcomes: values.map((value) => ({ ok: true, value })) });
}

const ALL_PASSED = runReturning(6, 5, 0, 10, 5, -10);
const SOME_FAILED = runReturning(6, 5, Number.NaN, 10, 4);

function attemptOf(exerciseId: string, status: StoredAttemptStatus = 'in_progress'): Attempt {
  return {
    id: `attempt-${exerciseId}`,
    exerciseId,
    userId: 'student-1',
    assignmentId: null,
    number: 1,
    currentCode: '',
    finalCode: null,
    status,
    startedAt: '2026-11-08T10:00:00.000Z',
    finishedAt: null,
    updatedAt: '2026-11-08T10:00:00.000Z',
  };
}

/** What the tutor answers in these tests: a short hint of level 1. */
async function* tutorAnswer(): AsyncGenerator<TutorEvent> {
  yield { type: 'meta', emotion: 'joy', intensity: 1, hintLevel: 1 };
  yield { type: 'delta', text: 'Mira el bucle.' };
  yield { type: 'done', interactionId: 'interaction-1', silent: false };
}

function text(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

interface Setup {
  getDetail?: ExerciseService['getDetail'];
  listAssigned?: ExerciseService['listAssigned'];
  openOrCreate?: AttemptService['openOrCreate'];
  list?: AttemptService['list'];
  retry?: AttemptService['retry'];
  /** The URL the page opens with, for its query parameters. */
  url?: string;
  saveCode?: AttemptService['saveCode'];
  submit?: AttemptService['submit'];
  run?: CodeRunnerService['run'];
  compact?: boolean;
  /** Below 1024 px; phones are narrow too. */
  narrow?: boolean;
  /** False when a request never answers: then the page cannot become stable. */
  settle?: boolean;
  /** The language of the interface. */
  locale?: string;
}

describe('WorkspacePage', () => {
  /**
   * Creates the page with TestBed rather than `render()`, which waits until the page is stable: a
   * request that never answers would keep it waiting forever.
   */
  async function renderPage({
    getDetail = () => Promise.resolve(SUM),
    listAssigned = () => Promise.resolve([]),
    openOrCreate = () => Promise.resolve(attemptOf(SUM.exercise.id)),
    list = () => Promise.resolve([]),
    retry = () => Promise.resolve({ ...attemptOf(SUM.exercise.id), id: 'attempt-2', number: 2 }),
    url = '/',
    saveCode = (attemptId, code) =>
      Promise.resolve({ ...attemptOf(SUM.exercise.id), id: attemptId, currentCode: code }),
    submit = (attemptId) =>
      Promise.resolve({
        ...attemptOf(SUM.exercise.id, 'submitted'),
        id: attemptId,
        finishedAt: '2026-11-08T10:30:00.000Z',
      }),
    run = () => Promise.resolve(SOME_FAILED),
    compact = false,
    narrow = compact,
    settle = true,
    locale = 'es',
  }: Setup = {}) {
    const reload = vi.fn();
    const save = vi.fn(saveCode);
    const submitAttempt = vi.fn(submit);
    const runTests = vi.fn(run);
    const sendEvents = vi.fn<EventService['send']>(() => Promise.resolve());
    const channel = new FakeTabChannel();
    TestBed.configureTestingModule({
      // The editor is deferred: each test chooses the state of the block, since jsdom has no viewport.
      deferBlockBehavior: DeferBlockBehavior.Manual,
      providers: [
        { provide: PageReloader, useValue: { reload } },
        { provide: LOCALE_ID, useValue: locale },
        provideRouter([]),
        AttemptStore,
        ...provideTestEditingTab(channel),
        TutorStore,
        BrowserSignals,
        { provide: TutorService, useValue: { ask: () => tutorAnswer() } },
        { provide: EventService, useValue: { send: sendEvents } },
        {
          provide: ExerciseService,
          useValue: { getDetail: vi.fn(getDetail), listAssigned: vi.fn(listAssigned) },
        },
        {
          provide: AttemptService,
          useValue: {
            openOrCreate: vi.fn(openOrCreate),
            list: vi.fn(list),
            retry: vi.fn(retry),
            saveCode: save,
            submit: submitAttempt,
            history: () =>
              Promise.resolve({
                attempt: attemptOf(SUM.exercise.id),
                events: [],
                interactions: [],
              }),
          },
        },
        { provide: CodeRunnerService, useValue: { run: runTests } },
        ...provideSessionOf('student'),
        {
          provide: BreakpointObserver,
          useValue: {
            observe: (query: string) =>
              of({
                matches: query === COMPACT_WORKSPACE_QUERY ? compact : narrow,
                breakpoints: {},
              }),
          },
        },
      ],
    });
    await restoreSession();
    await TestBed.inject(Router).navigateByUrl(url);
    const fixture = TestBed.createComponent(WorkspacePage);
    fixture.componentRef.setInput('id', SUM.assignmentId);
    fixture.autoDetectChanges();
    if (settle) {
      await fixture.whenStable();
    } else {
      fixture.detectChanges();
    }
    return { fixture, reload, save, submitAttempt, runTests, sendEvents, channel };
  }

  /** Renders the deferred editor block in a state, and waits for the page to settle. */
  async function showEditor(
    fixture: Awaited<ReturnType<typeof renderPage>>['fixture'],
    state = DeferBlockState.Complete,
  ) {
    const [block] = await fixture.getDeferBlocks();
    await block.render(state);
  }

  /** The CodeMirror view of the editor, to edit as the student types (jsdom cannot type into it). */
  function editorView(): EditorView {
    const view = EditorView.findFromDOM(screen.getByRole('textbox', { name: 'Código' }));
    if (!view) throw new Error('CodeMirror view not found');
    return view;
  }

  function type(code: string): void {
    const view = editorView();
    view.dispatch({
      changes: { from: view.state.doc.length, insert: code },
      userEvent: 'input.type',
    });
  }

  function hideTab(state: DocumentVisibilityState = 'hidden'): void {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
    document.dispatchEvent(new Event('visibilitychange'));
  }

  it('shows the exercise in the language of the interface, with the same code', async () => {
    await renderPage({ locale: 'en' });

    expect(
      screen.getByRole('heading', { level: 1, name: 'Sum of the elements of an array' }),
    ).toBeTruthy();
    expect(document.title).toBe('Sum of the elements of an array · TutorIA');
    const statement = screen.getByRole('region', { name: 'Enunciado' });
    expect(text(statement)).toContain('Write a function sum');
  });

  it('shows the title in its own language when it has no translation', async () => {
    const exercise = { ...SUM.exercise, translations: {} };
    await renderPage({ locale: 'en', getDetail: () => Promise.resolve({ ...SUM, exercise }) });

    const heading = screen.getByRole('heading', { level: 1, name: SUM.exercise.title });
    expect(heading.querySelector('[lang]')?.getAttribute('lang')).toBe('es');
  });

  it('shows the exercise with its statement, its examples and its hidden checks', async () => {
    await renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Suma de los elementos de un vector' }),
    ).toBeTruthy();
    expect(document.title).toBe('Suma de los elementos de un vector · TutorIA');
    expect(screen.getByText('Media')).toBeTruthy();
    const statement = screen.getByRole('region', { name: 'Enunciado' });
    expect(text(statement)).toContain('Escribe una función sum');
    const rows = within(statement).getAllByRole('row').slice(1).map(text);
    expect(rows).toEqual(['sum([1, 2, 3]) 6', 'sum([5]) 5', 'sum([]) 0', 'sum([-2, 2, 10]) 10']);
    expect(
      within(statement).getByText(
        'Y 2 comprobaciones ocultas: verás si las superas, pero no sus datos.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Código' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Tutor' })).toBeTruthy();
  });

  it('opens or creates the attempt and shows its status', async () => {
    const openOrCreate = vi.fn(() => Promise.resolve(attemptOf(SUM.exercise.id, 'tests_failed')));
    await renderPage({ openOrCreate });

    expect(openOrCreate).toHaveBeenCalledWith(SUM.assignmentId, undefined);
    expect(screen.getByText('Con fallos')).toBeTruthy();
  });

  it('counts a single hidden check, and none', async () => {
    await renderPage({ getDetail: () => Promise.resolve({ ...SUM, hiddenTestCount: 1 }) });
    expect(
      screen.getByText('Y 1 comprobación oculta: verás si la superas, pero no sus datos.'),
    ).toBeTruthy();
  });

  it('says nothing about hidden checks when there are none', async () => {
    await renderPage({ getDetail: () => Promise.resolve({ ...SUM, hiddenTestCount: 0 }) });
    const statement = screen.getByRole('region', { name: 'Enunciado' });
    expect(within(statement).queryByText(/comprobaci/)).toBeNull();
  });

  it('shows a text the function returns line by line', async () => {
    const table = detailOf(1);
    await renderPage({ getDetail: () => Promise.resolve(table) });

    const multiline = table.visibleTests.find(
      (test) => typeof test.expectedOutput === 'string' && test.expectedOutput.includes('\n'),
    );
    const pre = document.querySelector('pre');
    expect(pre?.textContent).toBe(multiline?.expectedOutput);
  });

  it('folds and unfolds the statement', async () => {
    await renderPage();
    const toggle = screen.getByRole('button', { name: 'Enunciado' });

    await userEvent.setup().click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById('statement-body')?.hidden).toBe(true);

    await userEvent.setup().click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById('statement-body')?.hidden).toBe(false);
  });

  it('shows the zones as tabs on a phone', async () => {
    await renderPage({ compact: true });

    expect(screen.getAllByRole('tab').map(text)).toEqual(['Ejercicio', 'Código', 'Tutor']);
    expect(screen.queryByRole('button', { name: 'Enunciado' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Enunciado' })).toBeTruthy();
  });

  it('keeps the heading while it loads, so the focus has somewhere to land', async () => {
    await renderPage({ getDetail: () => new Promise(() => undefined), settle: false });

    const heading = screen.getByRole('heading', { level: 1, name: 'Ejercicio' });
    expect(heading.querySelector('.sr-only')?.textContent).toBe('Ejercicio');
    expect(heading.querySelector('app-loading-skeleton')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Enunciado' }).getAttribute('aria-busy')).toBe(
      'true',
    );
  });

  it('offers the way back instead of retrying when the exercise is not assigned', async () => {
    const notFound = () => Promise.reject(new DataError('not_found'));
    await renderPage({ getDetail: notFound, openOrCreate: notFound });

    const heading = screen.getByRole('heading', { level: 1, name: 'Ejercicio' });
    expect(heading.querySelector('.sr-only')).toBeNull();
    expect(heading.querySelector('app-loading-skeleton')).toBeNull();
    expect(text(screen.getByRole('alert'))).toContain('No tienes acceso a este contenido');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Volver a los ejercicios' })).toHaveLength(2);
  });

  it('retries only what failed', async () => {
    const getDetail = vi
      .fn<ExerciseService['getDetail']>()
      .mockRejectedValueOnce(new DataError('network'))
      .mockResolvedValue(SUM);
    const openOrCreate = vi.fn(() => Promise.resolve(attemptOf(SUM.exercise.id)));
    const { fixture } = await renderPage({ getDetail, openOrCreate });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    await fixture.whenStable();

    expect(getDetail).toHaveBeenCalledTimes(2);
    expect(openOrCreate).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { level: 1, name: SUM.exercise.title })).toBeTruthy();
  });

  it('retries opening the attempt when only that failed', async () => {
    const openOrCreate = vi
      .fn<AttemptService['openOrCreate']>()
      .mockRejectedValueOnce(new DataError('network'))
      .mockResolvedValue(attemptOf(SUM.exercise.id));
    const { fixture } = await renderPage({ openOrCreate });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    await fixture.whenStable();

    expect(openOrCreate).toHaveBeenCalledTimes(2);
    expect(screen.getByText('En curso')).toBeTruthy();
  });

  it('leaves the tab title alone if the student left before the exercise arrived', async () => {
    let answer!: (detail: ExerciseDetail) => void;
    document.title = 'Ejercicios · TutorIA';
    const { fixture } = await renderPage({
      getDetail: () => new Promise((resolve) => (answer = resolve)),
      settle: false,
    });

    fixture.destroy();
    answer(SUM);
    await Promise.resolve();

    expect(document.title).toBe('Ejercicios · TutorIA');
  });

  describe('editor', () => {
    afterEach(() => vi.restoreAllMocks());

    it('keeps the room of the editor until its zone shows, and then its code and help', async () => {
      const { fixture } = await renderPage({
        openOrCreate: () =>
          Promise.resolve({ ...attemptOf(SUM.exercise.id), currentCode: 'function sum' }),
      });
      expect(screen.queryByRole('textbox', { name: 'Código' })).toBeNull();

      await showEditor(fixture);

      expect(editorView().state.doc.toString()).toBe('function sum');
      expect(screen.getByText(/Esc y después Tab/)).toBeTruthy();
    });

    it('starts an empty attempt with the name of the function as help', async () => {
      const { fixture } = await renderPage();
      await showEditor(fixture);

      expect(screen.getByText('Escribe aquí la función sum')).toBeTruthy();
    });

    it('shows a skeleton while the editor downloads', async () => {
      const { fixture } = await renderPage();
      await showEditor(fixture, DeferBlockState.Loading);

      expect(screen.queryByRole('textbox', { name: 'Código' })).toBeNull();
      expect(fixture.nativeElement.querySelector('app-loading-skeleton')).toBeTruthy();
    });

    it('offers to reload the page when the editor cannot download', async () => {
      const { fixture, reload } = await renderPage();
      await showEditor(fixture, DeferBlockState.Error);

      expect(screen.getByRole('alert').textContent).toContain('No se ha podido cargar el editor');
      await userEvent.setup().click(screen.getByRole('button', { name: 'Recargar' }));

      expect(reload).toHaveBeenCalledOnce();
    });

    it('waits for the attempt before creating the editor', async () => {
      const { fixture } = await renderPage({
        openOrCreate: () => new Promise(() => undefined),
        settle: false,
      });
      await showEditor(fixture);

      expect(screen.queryByRole('textbox', { name: 'Código' })).toBeNull();
    });

    it('saves what the student typed when the tab is hidden, and says so', async () => {
      const { fixture, save } = await renderPage();
      await showEditor(fixture);

      type('function sum() {}');
      await fixture.whenStable();
      expect(screen.getByText('Guardando…')).toBeTruthy();
      hideTab();
      await fixture.whenStable();

      expect(save).toHaveBeenCalledExactlyOnceWith(
        `attempt-${SUM.exercise.id}`,
        'function sum() {}',
      );
      expect(screen.getByText('Guardado')).toBeTruthy();
    });

    it('does not save early when the tab shows again', async () => {
      const { fixture, save } = await renderPage();
      await showEditor(fixture);

      type('x');
      hideTab('visible');

      expect(save).not.toHaveBeenCalled();
    });

    it('asks before leaving with unsaved changes, and only then', async () => {
      const { fixture } = await renderPage();
      await showEditor(fixture);
      const leave = () => {
        const event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      };

      expect(leave()).toBe(false);
      type('x');
      expect(leave()).toBe(true);
    });

    it('says a save failed and saves again on retry', async () => {
      const saveCode = vi
        .fn<AttemptService['saveCode']>()
        .mockRejectedValueOnce(new DataError('network'))
        .mockImplementation((attemptId, code) =>
          Promise.resolve({ ...attemptOf(SUM.exercise.id), id: attemptId, currentCode: code }),
        );
      const { fixture, save } = await renderPage({ saveCode });
      await showEditor(fixture);

      type('x');
      hideTab();
      await fixture.whenStable();
      expect(screen.getByRole('alert').textContent).toContain('No se ha guardado');
      await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
      await fixture.whenStable();

      expect(save).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Guardado')).toBeTruthy();
    });

    it('only shows the code of a submitted attempt', async () => {
      const { fixture } = await renderPage({
        openOrCreate: () => Promise.resolve(attemptOf(SUM.exercise.id, 'submitted')),
      });
      await showEditor(fixture);

      expect(screen.getByRole('textbox', { name: 'Código' }).getAttribute('aria-readonly')).toBe(
        'true',
      );
      expect(screen.queryByText(/Guard/)).toBeNull();
    });
  });

  describe('browser signals', () => {
    const attemptId = `attempt-${SUM.exercise.id}`;

    /** Sends what the logger has queued, as its timer would. */
    function sendQueuedEvents(): Promise<void> {
      return TestBed.inject(EventLogger).flush();
    }

    it('records a paste from outside the code with its length', async () => {
      const { fixture, sendEvents } = await renderPage();
      await showEditor(fixture);

      editorView().dispatch({
        changes: { from: 0, insert: 'return 42;' },
        userEvent: 'input.paste',
      });
      await sendQueuedEvents();

      expect(sendEvents).toHaveBeenCalledExactlyOnceWith([
        expect.objectContaining({ attemptId, type: 'paste', detail: { length: 10 } }),
      ]);
    });

    it('records leaving the window for another tab and coming back, with the time away', async () => {
      const { sendEvents } = await renderPage();

      window.dispatchEvent(new Event('blur'));
      hideTab();
      await vi.waitFor(() => expect(sendEvents).toHaveBeenCalled());
      hideTab('visible');
      window.dispatchEvent(new Event('focus'));
      await sendQueuedEvents();

      expect(sendEvents.mock.calls.flat(2)).toEqual([
        expect.objectContaining({ attemptId, type: 'focus_lost', detail: null }),
        expect.objectContaining({
          attemptId,
          type: 'focus_gained',
          detail: { awayMs: expect.any(Number) },
        }),
      ]);
    });

    it('takes the tab shown again with the focus as a return, as some browsers fire no focus', async () => {
      const { sendEvents } = await renderPage();
      const hasFocus = vi.spyOn(document, 'hasFocus');

      hideTab();
      await vi.waitFor(() => expect(sendEvents).toHaveBeenCalled());
      hasFocus.mockReturnValue(false);
      hideTab('visible');
      await sendQueuedEvents();
      expect(sendEvents).toHaveBeenCalledOnce();
      hasFocus.mockReturnValue(true);
      hideTab('visible');
      await sendQueuedEvents();

      expect(sendEvents.mock.calls.flat(2).map((event) => event.type)).toEqual([
        'focus_lost',
        'focus_gained',
      ]);
    });
  });

  describe('running the tests and submitting', () => {
    afterEach(() => localStorage.clear());

    function runButton(): HTMLElement {
      return screen.getByRole('button', { name: /Ejecutar pruebas|Ejecutando…/ });
    }

    function submitButton(): HTMLElement {
      return screen.getByRole('button', { name: /^(Entregar|Entregando…)$/ });
    }

    it('invites to run the tests before the first run, and does not let submit yet', async () => {
      await renderPage();

      expect(screen.getByText(/Ejecuta las pruebas para comprobar tu código/)).toBeTruthy();
      expect(submitButton().getAttribute('aria-disabled')).toBe('true');
    });

    it('runs the tests and shows each example with what the code returned', async () => {
      const { fixture, runTests } = await renderPage();
      await showEditor(fixture);
      type('function sum(v) {}');

      await userEvent.setup().click(runButton());
      await fixture.whenStable();

      expect(runTests).toHaveBeenCalledExactlyOnceWith(
        `attempt-${SUM.exercise.id}`,
        'function sum(v) {}',
      );
      const results = screen.getByRole('group', { name: 'Resultados de las pruebas' });
      expect(text(results)).toContain('3 de 6 superadas');
      expect(text(results)).toContain('No superada: sum([])');
      expect(text(results)).toMatch(/Obtenido:\s?NaN/);
      expect(text(document.querySelector('p[aria-live="polite"]'))).toBe(
        '3 de 6 pruebas superadas.',
      );
      expect(text(document.querySelector('app-status-chip'))).toContain('Con fallos · 3/6');
      expect(submitButton().getAttribute('aria-disabled')).toBe('true');
    });

    it('runs the tests with Ctrl + Enter from the editor', async () => {
      const { fixture, runTests } = await renderPage();
      await showEditor(fixture);

      runScopeHandlers(
        editorView(),
        new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }),
        'editor',
      );
      await fixture.whenStable();

      expect(runTests).toHaveBeenCalledOnce();
    });

    it('says it is running and keeps the focus on the button meanwhile', async () => {
      let answer!: (result: RunResult) => void;
      const { fixture } = await renderPage({
        run: () => new Promise((resolve) => (answer = resolve)),
      });
      const button = runButton();

      await userEvent.setup().click(button);

      expect(text(button)).toContain('Ejecutando…');
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(document.activeElement).toBe(button);
      answer(SOME_FAILED);
      await fixture.whenStable();
      expect(text(button)).toContain('Ejecutar pruebas');
    });

    it('marks the results as outdated when the code changes', async () => {
      const { fixture } = await renderPage();
      await showEditor(fixture);
      await userEvent.setup().click(runButton());
      await fixture.whenStable();

      type('// more');
      fixture.detectChanges();

      expect(screen.getByText(/estos resultados son de la versión anterior/)).toBeTruthy();
      expect(text(document.querySelector('app-status-chip'))).not.toContain('3/5');
    });

    it('explains code that cannot run instead of failing every test', async () => {
      const { fixture } = await renderPage({
        run: () =>
          Promise.resolve(
            buildRunResult(SUM_TESTS, { outcomes: [], loadError: { kind: 'missing_function' } }),
          ),
      });

      await userEvent.setup().click(runButton());
      await fixture.whenStable();

      expect(screen.getByText(/No se encuentra la función/)).toBeTruthy();
      expect(text(document.querySelector('p[aria-live="polite"]'))).toBe(
        'El código no se ha podido ejecutar.',
      );
    });

    it('says a run failed and runs again on retry', async () => {
      const run = vi
        .fn<CodeRunnerService['run']>()
        .mockRejectedValueOnce(new DataError('network'))
        .mockResolvedValueOnce(SOME_FAILED);
      const { fixture } = await renderPage({ run });

      await userEvent.setup().click(runButton());
      await fixture.whenStable();
      const alert = screen.getByRole('alert');
      expect(text(alert)).toContain(
        'No se han podido ejecutar las pruebas. Comprueba la conexión e inténtalo de nuevo.',
      );

      await userEvent.setup().click(within(alert).getByRole('button', { name: 'Reintentar' }));
      await fixture.whenStable();

      expect(run).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('offers to sign in again instead of retrying when the session expired', async () => {
      const { fixture } = await renderPage({
        run: () => Promise.reject(new DataError('unauthorized')),
      });

      await userEvent.setup().click(runButton());
      await fixture.whenStable();
      const alert = screen.getByRole('alert');

      expect(text(alert)).toContain('Tu sesión ha caducado');
      expect(within(alert).getByRole('button', { name: 'Volver a entrar' })).toBeTruthy();
      expect(within(alert).queryByRole('button', { name: 'Reintentar' })).toBeNull();
    });

    it('submits a passed attempt after confirming, and moves the focus to the note', async () => {
      const { fixture, submitAttempt } = await renderPage({
        run: () => Promise.resolve(ALL_PASSED),
      });
      await userEvent.setup().click(runButton());
      await fixture.whenStable();
      expect(text(document.querySelector('p[aria-live="polite"]'))).toBe(
        'Todas las pruebas superadas. Ya puedes entregar.',
      );
      expect(submitButton().getAttribute('aria-disabled')).toBeNull();

      await userEvent.setup().click(submitButton());
      const dialog = await screen.findByRole('dialog');
      expect(text(dialog)).toContain('¿Entregar el ejercicio?');
      await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Entregar' }));

      await vi.waitFor(() => expect(submitAttempt).toHaveBeenCalledOnce());
      await fixture.whenStable();
      const note = await screen.findByText(/El código ya no se puede cambiar/);
      await vi.waitFor(() => expect(document.activeElement).toBe(note.parentElement));
      expect(screen.queryByRole('button', { name: /Ejecutar pruebas/ })).toBeNull();
      expect(screen.getAllByRole('link', { name: 'Volver a los ejercicios' })).toHaveLength(2);
    });

    it('closes «¿Entregar el ejercicio?» when the page goes away with it open', async () => {
      const { fixture, submitAttempt } = await renderPage({
        run: () => Promise.resolve(ALL_PASSED),
      });
      await userEvent.setup().click(runButton());
      await fixture.whenStable();
      await userEvent.setup().click(submitButton());
      expect(await screen.findByRole('dialog')).toBeTruthy();

      fixture.destroy();

      await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(submitAttempt).not.toHaveBeenCalled();
    });

    it('does not submit when the student keeps reviewing', async () => {
      const { fixture, submitAttempt } = await renderPage({
        run: () => Promise.resolve(ALL_PASSED),
      });
      await userEvent.setup().click(runButton());
      await fixture.whenStable();

      await userEvent.setup().click(submitButton());
      const dialog = await screen.findByRole('dialog');
      await userEvent
        .setup()
        .click(within(dialog).getByRole('button', { name: 'Seguir revisando' }));

      await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(submitAttempt).not.toHaveBeenCalled();
    });

    it('does nothing with a click on «Entregar» before passing', async () => {
      await renderPage();

      await userEvent.setup().click(submitButton());

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('says a submission failed and submits again on retry, without asking again', async () => {
      const submit = vi
        .fn<AttemptService['submit']>()
        .mockRejectedValueOnce(new DataError('network'))
        .mockResolvedValueOnce({
          ...attemptOf(SUM.exercise.id, 'submitted'),
          finishedAt: '2026-11-08T10:30:00.000Z',
        });
      const { fixture } = await renderPage({ run: () => Promise.resolve(ALL_PASSED), submit });
      await userEvent.setup().click(runButton());
      await fixture.whenStable();
      await userEvent.setup().click(submitButton());
      await userEvent
        .setup()
        .click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Entregar' }));
      const alert = await screen.findByRole('alert');
      expect(text(alert)).toContain('No se ha podido entregar.');

      await userEvent.setup().click(within(alert).getByRole('button', { name: 'Reintentar' }));
      await fixture.whenStable();

      expect(submit).toHaveBeenCalledTimes(2);
      expect(await screen.findByText(/El código ya no se puede cambiar/)).toBeTruthy();
    });

    it('shows when a submitted attempt was submitted, without the buttons', async () => {
      await renderPage({
        openOrCreate: () =>
          Promise.resolve({
            ...attemptOf(SUM.exercise.id, 'submitted'),
            finishedAt: '2026-11-08T10:30:00.000Z',
          }),
      });

      expect(
        screen.getByText(/Entregado el .*2026.* El código ya no se puede cambiar/),
      ).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Ejecutar pruebas' })).toBeNull();
      expect(screen.queryByText(/Ejecuta las pruebas para comprobar/)).toBeNull();
      expect(screen.queryByRole('button', { name: 'Formatear el código' })).toBeNull();
    });
  });

  describe('formatting the code', () => {
    it('puts the code of the editor in order with its button, and saves it', async () => {
      const { fixture } = await renderPage();
      await showEditor(fixture);
      const view = editorView();
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: 'function sum(v){\nreturn 0}' },
        userEvent: 'input.type',
      });

      await userEvent.setup().click(screen.getByRole('button', { name: 'Formatear el código' }));

      await waitFor(() =>
        expect(view.state.doc.toString()).toBe('function sum(v) {\n  return 0;\n}\n'),
      );
    });

    it('does nothing before the editor has arrived', async () => {
      await renderPage();

      await userEvent.setup().click(screen.getByRole('button', { name: 'Formatear el código' }));

      expect(screen.queryByRole('textbox', { name: 'Código' })).toBeNull();
    });
  });

  describe('expanding the code', () => {
    it('gives the code the room of the statement with the same editor, and goes back', async () => {
      const { fixture } = await renderPage();
      await showEditor(fixture);
      const view = editorView();
      const toggle = screen.getByRole('button', { name: 'Ampliar el código' });
      expect(toggle.getAttribute('aria-pressed')).toBe('false');

      await userEvent.setup().click(toggle);

      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      expect(screen.queryByRole('region', { name: 'Enunciado' })).toBeNull();
      expect(screen.queryByRole('separator', { name: 'Tamaño del enunciado' })).toBeNull();
      // The tutor folds into the floating mascot, still at hand (D-033)
      expect(screen.queryByRole('region', { name: 'Tutor' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Abrir el tutor' })).toBeTruthy();
      // The same CodeMirror: nothing typed nor its undo history is lost
      expect(editorView()).toBe(view);

      await userEvent.setup().click(toggle);

      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      expect(screen.getByRole('region', { name: 'Enunciado' })).toBeTruthy();
      expect(screen.getByRole('region', { name: 'Tutor' })).toBeTruthy();
      expect(editorView()).toBe(view);
    });

    it('is not offered on a phone, where each zone already takes the screen', async () => {
      await renderPage({ compact: true });

      expect(screen.queryByRole('button', { name: 'Ampliar el código' })).toBeNull();
    });
  });

  describe('splitter', () => {
    afterEach(() => localStorage.clear());

    function statementZone(): HTMLElement {
      return document.getElementById('statement-zone') as HTMLElement;
    }

    it('sizes the statement and remembers the share for the student', async () => {
      await renderPage();
      const splitter = screen.getByRole('separator', { name: 'Tamaño del enunciado' });
      expect(statementZone().style.flexBasis).toBe('45%');

      splitter.focus();
      await userEvent.setup().keyboard('{ArrowDown}');

      expect(statementZone().style.flexBasis).toBe('50%');
      expect(localStorage.getItem(paneShareKey(STATEMENT_SHARE, 'student-1'))).toBe('50');
    });

    it('starts with the share the student left', async () => {
      localStorage.setItem(paneShareKey(STATEMENT_SHARE, 'student-1'), '60');

      await renderPage();

      expect(statementZone().style.flexBasis).toBe('60%');
    });

    it('goes away while the statement is folded', async () => {
      await renderPage();
      await userEvent.setup().click(screen.getByRole('button', { name: 'Enunciado' }));

      expect(screen.queryByRole('separator', { name: 'Tamaño del enunciado' })).toBeNull();
      expect(statementZone().style.flexBasis).toBe('');
    });

    it('sizes the code beside the tutor and remembers the share for the student', async () => {
      await renderPage();
      const splitter = screen.getByRole('separator', { name: 'Ancho del código' });
      const grid = splitter.parentElement as HTMLElement;
      expect(splitter.getAttribute('aria-controls')).toBe('code-zone');
      expect(grid.style.getPropertyValue('--tutor-width')).toBe('max(16rem, 30%)');

      splitter.focus();
      await userEvent.setup().keyboard('{ArrowLeft}');

      expect(grid.style.getPropertyValue('--tutor-width')).toBe('max(16rem, 35%)');
      expect(localStorage.getItem(paneShareKey(CODE_SHARE, 'student-1'))).toBe('65');
    });

    it('does not show on a phone, where each zone is a tab', async () => {
      await renderPage({ compact: true });

      expect(screen.queryByRole('separator')).toBeNull();
    });
  });

  describe('tutor tab', () => {
    function tutorTab(): HTMLElement {
      return screen.getAllByRole('tab')[2];
    }

    it('marks an answer that arrives while the student looks at another tab, until they open it', async () => {
      const { fixture } = await renderPage({ compact: true });
      const user = userEvent.setup();
      await user.click(screen.getByRole('tab', { name: 'Código' }));

      await TestBed.inject(TutorStore).requestHint();
      await fixture.whenStable();
      expect(tutorTab().textContent).toContain('Tutor, respuesta nueva');
      expect(screen.getByRole('tab', { name: 'Tutor, respuesta nueva' })).toBe(tutorTab());

      await user.click(tutorTab());
      expect(text(tutorTab())).toBe('Tutor');
      await user.click(screen.getByRole('tab', { name: 'Ejercicio' }));
      expect(text(tutorTab())).toBe('Tutor');
    });

    it('does not mark the answers read in the tab itself', async () => {
      const { fixture } = await renderPage({ compact: true });
      await userEvent.setup().click(tutorTab());

      await TestBed.inject(TutorStore).requestHint();
      await fixture.whenStable();

      expect(text(tutorTab())).toBe('Tutor');
    });
  });

  describe('floating tutor', () => {
    afterEach(() => localStorage.clear());

    const mascot = () => screen.getByRole('button', { name: /^(Abrir|Cerrar) el tutor$/ });
    const question = () => screen.getByRole('textbox', { name: 'Pregunta al tutor' });

    async function expand(): Promise<void> {
      await userEvent.setup().click(screen.getByRole('button', { name: 'Ampliar el código' }));
    }

    it('opens from the mascot ready to ask, and folds back with «Minimizar», the mascot or Esc', async () => {
      const { fixture } = await renderPage();
      const user = userEvent.setup();
      await expand();
      expect(mascot().getAttribute('aria-expanded')).toBe('false');
      expect(mascot().getAttribute('aria-label')).toBe('Abrir el tutor');

      await user.click(mascot());
      await fixture.whenStable();
      expect(screen.getByRole('region', { name: 'Tutor' })).toBeTruthy();
      expect(mascot().getAttribute('aria-expanded')).toBe('true');
      expect(mascot().getAttribute('aria-label')).toBe('Cerrar el tutor');
      expect(mascot().querySelector('app-mascot')?.classList).toContain('mascot-chat');
      expect(document.activeElement).toBe(question());

      await user.click(screen.getByRole('button', { name: 'Minimizar el tutor' }));
      await fixture.whenStable();
      expect(screen.queryByRole('region', { name: 'Tutor' })).toBeNull();
      expect(document.activeElement).toBe(mascot());

      await user.click(mascot());
      await fixture.whenStable();
      await user.keyboard('{Escape}');
      await fixture.whenStable();
      expect(screen.queryByRole('region', { name: 'Tutor' })).toBeNull();
      expect(document.activeElement).toBe(mascot());

      await user.click(mascot());
      await user.click(mascot());
      expect(screen.queryByRole('region', { name: 'Tutor' })).toBeNull();
    });

    it('lets the student float the tutor and fix it again, and remembers the choice', async () => {
      const { fixture } = await renderPage();
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Hacer flotante el tutor' }));
      await fixture.whenStable();
      expect(screen.queryByRole('separator', { name: 'Ancho del código' })).toBeNull();
      expect(screen.getByRole('region', { name: 'Enunciado' })).toBeTruthy();
      expect(document.activeElement).toBe(question());
      expect(localStorage.getItem(tutorFloatingKey('student-1'))).toBe('true');

      await user.click(screen.getByRole('button', { name: 'Fijar el tutor a la derecha' }));
      await fixture.whenStable();
      expect(screen.getByRole('separator', { name: 'Ancho del código' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Hacer flotante el tutor' })).toBeTruthy();
      expect(localStorage.getItem(tutorFloatingKey('student-1'))).toBe('false');
    });

    it('fixes the tutor from the expanded code, which goes back to the normal view', async () => {
      const { fixture } = await renderPage();
      const user = userEvent.setup();
      await expand();
      await user.click(mascot());
      await fixture.whenStable();

      await user.click(screen.getByRole('button', { name: 'Fijar el tutor a la derecha' }));

      expect(screen.getByRole('region', { name: 'Enunciado' })).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Ampliar el código' }).getAttribute('aria-pressed'),
      ).toBe('false');
      expect(screen.getByRole('separator', { name: 'Ancho del código' })).toBeTruthy();
    });

    it('starts floating when the student chose it', async () => {
      localStorage.setItem(tutorFloatingKey('student-1'), 'true');

      await renderPage();

      expect(screen.queryByRole('region', { name: 'Tutor' })).toBeNull();
      expect(mascot()).toBeTruthy();
    });

    it('floats on a tablet, where its column does not fit, with no way to fix it', async () => {
      const { fixture } = await renderPage({ narrow: true });

      expect(screen.getByRole('region', { name: 'Enunciado' })).toBeTruthy();
      expect(screen.queryByRole('separator', { name: 'Ancho del código' })).toBeNull();
      await userEvent.setup().click(mascot());
      await fixture.whenStable();

      expect(screen.getByRole('region', { name: 'Tutor' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Fijar/ })).toBeNull();
    });

    it('shows and reads aloud a new answer beside the folded mascot, which opens the tutor', async () => {
      const { fixture } = await renderPage();
      await expand();

      await TestBed.inject(TutorStore).requestHint();
      await fixture.whenStable();
      const bubble = screen.getByRole('button', { name: 'Mira el bucle.' });
      const announced = [...document.querySelectorAll('[aria-live="polite"]')].map((live) =>
        live.textContent?.trim(),
      );
      expect(announced).toContain('Mira el bucle.');

      await userEvent.setup().click(bubble);
      await fixture.whenStable();
      expect(screen.getByRole('region', { name: 'Tutor' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Mira el bucle.' })).toBeNull();
    });

    it('tilts the head of the folded mascot while the tutor answers', async () => {
      const { fixture } = await renderPage();
      await expand();

      const answering = TestBed.inject(TutorStore).requestHint();
      fixture.detectChanges();
      expect(mascot().querySelector('app-mascot')?.classList).toContain('mascot-thinking');

      await answering;
      await fixture.whenStable();
      expect(mascot().querySelector('app-mascot')?.classList).not.toContain('mascot-thinking');
    });

    it('plays the reaction of a new answer and moves the folded mascot, unless they are off', async () => {
      const { fixture } = await renderPage();
      await expand();
      // The overlay is decorative (aria-hidden): only its data-testid finds it (4.8)
      const pieces = () =>
        screen.getByTestId('reaction-overlay').querySelectorAll('.reaction-piece').length;
      const moving = () =>
        [...(mascot().querySelector('app-mascot')?.classList ?? [])].some((name) =>
          name.startsWith('mascot-move-'),
        );

      const tutor = TestBed.inject(TutorStore);
      await tutor.requestHint();
      await fixture.whenStable();
      const playing = pieces();
      expect(playing).toBeGreaterThan(0);
      expect(moving()).toBe(true);

      // Turned off, the next answer brings no reaction and the mascot stays still
      TestBed.inject(SettingsStore).setReactions('off');
      await tutor.requestHint();
      await fixture.whenStable();
      expect(pieces()).toBe(playing);
      expect(moving()).toBe(false);
      localStorage.clear();
    });

    it('celebrates a run that passes every test, and the next answer of the tutor plays too', async () => {
      const run = vi
        .fn<CodeRunnerService['run']>()
        .mockResolvedValueOnce(SOME_FAILED)
        .mockResolvedValueOnce(ALL_PASSED);
      const { fixture } = await renderPage({ run });
      const overlay = () => screen.getByTestId('reaction-overlay');
      const runTests = () =>
        userEvent.setup().click(screen.getByRole('button', { name: /Ejecutar pruebas/ }));

      // A run with failures gets no reaction
      await runTests();
      await fixture.whenStable();
      expect(overlay().querySelectorAll('.reaction-piece')).toHaveLength(0);

      await runTests();
      await fixture.whenStable();
      const celebrating = overlay().querySelectorAll('.reaction-piece').length;
      expect(celebrating).toBeGreaterThan(0);

      await TestBed.inject(TutorStore).requestHint();
      await fixture.whenStable();
      expect(overlay().querySelectorAll('.reaction-piece').length).toBeGreaterThan(celebrating);
    });

    it('does not bring back an answer already read in the column', async () => {
      const { fixture } = await renderPage();
      await TestBed.inject(TutorStore).requestHint();
      await fixture.whenStable();

      await expand();

      expect(screen.queryByRole('button', { name: 'Mira el bucle.' })).toBeNull();
    });
  });

  it('says the code came back from the local draft, and keeps saying it until the student types', async () => {
    localStorage.setItem(
      `tutoria.code-draft.attempt-${SUM.exercise.id}`,
      JSON.stringify({ code: 'function sumar() {}', base: '' }),
    );
    const { fixture } = await renderPage();
    await showEditor(fixture);

    expect(text(screen.getByRole('status'))).toContain(
      'Hemos recuperado el código que no llegó a guardarse. Ya se está guardando.',
    );
    expect(editorView().state.doc.toString()).toBe('function sumar() {}');

    type(' ');
    await fixture.whenStable();
    expect(screen.queryByText(/Hemos recuperado el código/)).toBeNull();
    localStorage.clear();
  });

  it('only shows the code when another tab takes the exercise, until the student continues here', async () => {
    const { fixture, channel } = await renderPage();
    await showEditor(fixture);
    expect(editorView().state.readOnly).toBe(false);

    channel.fromOtherTab(takenByOtherTab(`attempt-${SUM.exercise.id}`));
    await fixture.whenStable();

    const notice = screen.getByRole('status');
    expect(text(notice)).toContain('Este ejercicio está abierto en otra pestaña');
    expect(editorView().state.readOnly).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Ejecutar pruebas' }).getAttribute('aria-disabled'),
    ).toBe('true');

    await userEvent.setup().click(within(notice).getByRole('button', { name: 'Seguir aquí' }));
    await fixture.whenStable();
    await showEditor(fixture);

    expect(screen.queryByText(/abierto en otra pestaña/)).toBeNull();
    expect(editorView().state.readOnly).toBe(false);
  });
  describe('blocks and practice (2.5c)', () => {
    const SUBMITTED = {
      ...attemptOf(SUM.exercise.id, 'submitted'),
      id: 'attempt-1',
      finishedAt: '2026-11-08T10:30:00.000Z',
    };
    const PRACTICE = { ...attemptOf(SUM.exercise.id), id: 'attempt-2', number: 2 };

    it('says where the exercise is, with a link to the tab of its subject', async () => {
      await renderPage();

      const place = screen.getByRole('navigation', { name: 'Ubicación' });
      expect(within(place).getAllByRole('listitem').map(text)).toEqual([
        'Programación básica',
        'chevron_rightTema 2: Vectores',
      ]);
      expect(
        within(place).getByRole('link', { name: 'Programación básica' }).getAttribute('href'),
      ).toBe(`/alumno?grupo=${SUM.group.id}`);
    });

    it('says where the exercise is in the language of the interface, or in their own one', async () => {
      const block = { ...SUM.block, translations: {} };
      await renderPage({ locale: 'en', getDetail: () => Promise.resolve({ ...SUM, block }) });

      const place = screen.getByRole('navigation', { name: 'Ubicación' });
      expect(
        within(place).getByRole('link', { name: 'Basic programming' }).getAttribute('lang'),
      ).toBeNull();
      expect(within(place).getByText('Tema 2: Vectores').getAttribute('lang')).toBe('es');
    });

    it('marks the subject with its own language when it has no translation', async () => {
      const group = { ...SUM.group, subject: { ...SUM.group.subject, translations: {} } };
      await renderPage({ locale: 'en', getDetail: () => Promise.resolve({ ...SUM, group }) });

      const place = screen.getByRole('navigation', { name: 'Ubicación' });
      const subject = within(place).getByRole('link', { name: 'Programación básica' });
      expect(subject.getAttribute('lang')).toBe('es');
      expect(within(place).getByText('Topic 2: Arrays').getAttribute('lang')).toBeNull();
    });

    it('opens the attempt asked for in the URL and lets the student choose among them', async () => {
      const openOrCreate = vi.fn(() => Promise.resolve(SUBMITTED));
      const { fixture } = await renderPage({
        url: '/?intento=1',
        openOrCreate,
        list: () => Promise.resolve([SUBMITTED, { ...PRACTICE, status: 'tests_failed' }]),
      });
      await fixture.whenStable();

      expect(openOrCreate).toHaveBeenCalledWith(SUM.assignmentId, 1);
      await userEvent.setup().click(screen.getByRole('button', { name: /Intento 1 de 2/ }));
      const items = screen.getAllByRole('menuitem');
      expect(items.map(text)).toEqual([
        'checkIntento 1 task_alt Entregado',
        'Intento 2 error Con fallos',
      ]);
      expect(items[0].getAttribute('aria-current')).toBe('page');
      expect(items[0].getAttribute('href')).toBe('/?intento=1');
      // The latest has no number: it is the one the exercise opens with
      expect(items[1].getAttribute('href')).toBe('/');
      // An earlier attempt cannot be practised again: only the latest
      expect(screen.queryByRole('button', { name: 'Practicar de nuevo' })).toBeNull();
    });

    it('ignores a number in the URL that is not one', async () => {
      const openOrCreate = vi.fn(() => Promise.resolve(SUBMITTED));
      await renderPage({ url: '/?intento=uno', openOrCreate });

      expect(openOrCreate).toHaveBeenCalledWith(SUM.assignmentId, undefined);
      expect(screen.queryByRole('button', { name: /^Intento/ })).toBeNull();
    });

    it('practises again a submitted attempt, empty, and takes the number out of the URL', async () => {
      const retry = vi.fn(() => Promise.resolve(PRACTICE));
      const { fixture } = await renderPage({
        url: '/?intento=1',
        openOrCreate: (_, number) => Promise.resolve(number === 1 ? SUBMITTED : PRACTICE),
        list: () => Promise.resolve([SUBMITTED]),
        retry,
      });
      await fixture.whenStable();

      await userEvent.setup().click(screen.getByRole('button', { name: 'Practicar de nuevo' }));
      await fixture.whenStable();

      expect(retry).toHaveBeenCalledWith(SUM.assignmentId);
      expect(TestBed.inject(Router).url).toBe('/');
      expect(screen.getByText('En curso')).toBeTruthy();
      expect(
        screen.getByText(/Estás practicando: este intento no cuenta para la clase/),
      ).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Código' }));
    });

    it('keeps the URL when practising again from the latest attempt', async () => {
      const { fixture } = await renderPage({ openOrCreate: () => Promise.resolve(SUBMITTED) });
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

      await userEvent.setup().click(screen.getByRole('button', { name: 'Practicar de nuevo' }));
      await fixture.whenStable();

      expect(navigate).not.toHaveBeenCalled();
    });

    it('says practising again failed and tries again on retry', async () => {
      const retry = vi
        .fn<AttemptService['retry']>()
        .mockRejectedValueOnce(new DataError('network'))
        .mockResolvedValueOnce(PRACTICE);
      const { fixture } = await renderPage({
        openOrCreate: () => Promise.resolve(SUBMITTED),
        retry,
      });

      await userEvent.setup().click(screen.getByRole('button', { name: 'Practicar de nuevo' }));
      const alert = await screen.findByRole('alert');
      expect(text(alert)).toContain('No se ha podido empezar otro intento.');
      await userEvent.setup().click(within(alert).getByRole('button', { name: 'Reintentar' }));
      await fixture.whenStable();

      expect(retry).toHaveBeenCalledTimes(2);
      expect(screen.getByText('En curso')).toBeTruthy();
    });

    it('goes on to the next exercise of the block once submitted, or back to the catalog', async () => {
      const next: AssignedExercise = {
        exercise: SEED.exercises[3],
        assignmentId: 'next-assignment',
        group: SUM.group,
        block: SUM.block,
        updatedAt: null,
        status: 'not_started',
        hintCount: 0,
        hintLevel: null,
        practice: null,
        repetitions: 0,
      };
      const current = {
        ...next,
        exercise: SUM.exercise,
        assignmentId: SUM.assignmentId,
        status: 'submitted' as const,
      };
      const { fixture } = await renderPage({
        openOrCreate: () => Promise.resolve(SUBMITTED),
        listAssigned: () => Promise.resolve([current, next]),
      });
      await fixture.whenStable();

      expect(screen.getByRole('link', { name: /Siguiente ejercicio/ }).getAttribute('href')).toBe(
        '/alumno/ejercicio/next-assignment',
      );
    });

    it('goes back to the catalog when the rest of the block is submitted', async () => {
      const { fixture } = await renderPage({ openOrCreate: () => Promise.resolve(SUBMITTED) });
      await fixture.whenStable();

      expect(screen.queryByRole('link', { name: /Siguiente ejercicio/ })).toBeNull();
      expect(
        within(screen.getByText(/El código ya no se puede cambiar/).parentElement!).getByRole(
          'link',
          {
            name: 'Volver a los ejercicios',
          },
        ),
      ).toBeTruthy();
    });
  });

  describe('tools of the tutor (2.5e)', () => {
    // jsdom does not scroll: what the tutor points at only has to be asked to show itself
    beforeEach(() => (Element.prototype.scrollIntoView = vi.fn()));
    afterEach(() => {
      localStorage.clear();
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    });

    const selected = () =>
      screen.getAllByRole('tab').findIndex((tab) => tab.getAttribute('aria-selected') === 'true');

    it('changes the layout as setLayout asks, only what it names', async () => {
      const { fixture } = await renderPage();
      await showEditor(fixture);
      const tools = TestBed.inject(ToolRegistry);

      expect(await tools.run('setLayout', { codeExpanded: true })).toEqual({
        ok: true,
        result: { codeExpanded: true, tutor: 'floating', tab: 'exercise' },
      });
      await fixture.whenStable();
      expect(
        screen.getByRole('button', { name: 'Ampliar el código' }).getAttribute('aria-pressed'),
      ).toBe('true');

      // Docked again, the code goes back to its place, as «Fijar» does
      await tools.run('setLayout', { tutor: 'docked' });
      await fixture.whenStable();
      expect(screen.getByRole('region', { name: 'Tutor' })).toBeTruthy();
      expect(screen.getByRole('region', { name: 'Enunciado' })).toBeTruthy();

      await tools.run('setLayout', { tutor: 'floating' });
      await fixture.whenStable();
      expect(screen.getByRole('button', { name: 'Cerrar el tutor' })).toBeTruthy();

      // Already floating: nothing to change
      expect(await tools.run('setLayout', { tutor: 'floating', codeExpanded: false })).toEqual({
        ok: true,
        result: { codeExpanded: false, tutor: 'floating', tab: 'exercise' },
      });
    });

    it('shows on a phone the tab of what the tutor marks or points at', async () => {
      const { fixture } = await renderPage({ compact: true });
      const tutor = TestBed.inject(TutorStore);
      const show = async (change: () => void) => {
        change();
        await fixture.whenStable();
      };
      expect(selected()).toBe(0);

      await show(() => void TestBed.inject(ToolRegistry).run('setLayout', { tab: 'tutor' }));
      await vi.waitFor(() => expect(selected()).toBe(2));

      await show(() => tutor.mark([{ line: 1 }]));
      expect(selected()).toBe(1);

      await show(() => tutor.pointAt('example', 1));
      expect(selected()).toBe(0);

      await show(() => tutor.pointAt('failingTest'));
      expect(selected()).toBe(1);

      await show(() => tutor.pointAt('hiddenTests'));
      expect(selected()).toBe(0);

      // Clearing the marks shows nothing new
      await show(() => tutor.clearMarks());
      expect(selected()).toBe(0);
    });
  });
});
