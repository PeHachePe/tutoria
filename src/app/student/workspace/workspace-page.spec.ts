import { BreakpointObserver } from '@angular/cdk/layout';
import { provideRouter } from '@angular/router';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { EditorView, runScopeHandlers } from '@codemirror/view';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import { provideSessionOf, restoreSession } from '../../auth/auth-testing';
import type { Attempt, RunResult, StoredAttemptStatus } from '../../data/attempt';
import { PageReloader } from '../../core/page-reloader';
import { AttemptService } from '../../data/attempt-service';
import { CodeRunnerService } from '../../data/code-runner-service';
import { DataError } from '../../data/data-error';
import type { ExerciseDetail } from '../../data/exercise';
import { ExerciseService } from '../../data/exercise-service';
import { buildRunResult } from '../../data/mock/code-runner/build-run-result';
import { SEED } from '../../data/mock/fixtures/seed';
import { AttemptStore } from './attempt-store';
import { statementShareKey } from './statement-share';
import { WorkspacePage } from './workspace-page';

/** The detail of a seed exercise (0-based index), as the exercise service returns it. */
function detailOf(index: number): ExerciseDetail {
  const exercise = SEED.exercises[index];
  const tests = SEED.tests
    .filter((test) => test.exerciseId === exercise.id)
    .sort((a, b) => a.position - b.position);
  return {
    exercise,
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

const ALL_PASSED = runReturning(6, 5, 0, 10, 5);
const SOME_FAILED = runReturning(6, 5, Number.NaN, 10, 4);

function attemptOf(exerciseId: string, status: StoredAttemptStatus = 'in_progress'): Attempt {
  return {
    id: `attempt-${exerciseId}`,
    exerciseId,
    userId: 'student-1',
    assignmentId: null,
    currentCode: '',
    finalCode: null,
    status,
    startedAt: '2026-11-08T10:00:00.000Z',
    finishedAt: null,
    updatedAt: '2026-11-08T10:00:00.000Z',
  };
}

function text(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

interface Setup {
  getDetail?: ExerciseService['getDetail'];
  openOrCreate?: AttemptService['openOrCreate'];
  saveCode?: AttemptService['saveCode'];
  submit?: AttemptService['submit'];
  run?: CodeRunnerService['run'];
  compact?: boolean;
  /** False when a request never answers: then the page cannot become stable. */
  settle?: boolean;
}

describe('WorkspacePage', () => {
  /**
   * Creates the page with TestBed rather than `render()`, which waits until the page is stable: a
   * request that never answers would keep it waiting forever.
   */
  async function renderPage({
    getDetail = () => Promise.resolve(SUM),
    openOrCreate = (exerciseId) => Promise.resolve(attemptOf(exerciseId)),
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
    settle = true,
  }: Setup = {}) {
    const reload = vi.fn();
    const save = vi.fn(saveCode);
    const submitAttempt = vi.fn(submit);
    const runTests = vi.fn(run);
    TestBed.configureTestingModule({
      // The editor is deferred: each test chooses the state of the block, since jsdom has no viewport.
      deferBlockBehavior: DeferBlockBehavior.Manual,
      providers: [
        { provide: PageReloader, useValue: { reload } },
        provideRouter([]),
        AttemptStore,
        { provide: ExerciseService, useValue: { getDetail: vi.fn(getDetail) } },
        {
          provide: AttemptService,
          useValue: { openOrCreate: vi.fn(openOrCreate), saveCode: save, submit: submitAttempt },
        },
        { provide: CodeRunnerService, useValue: { run: runTests } },
        ...provideSessionOf('student'),
        {
          provide: BreakpointObserver,
          useValue: { observe: () => of({ matches: compact, breakpoints: {} }) },
        },
      ],
    });
    await restoreSession();
    const fixture = TestBed.createComponent(WorkspacePage);
    fixture.componentRef.setInput('id', SUM.exercise.id);
    fixture.autoDetectChanges();
    if (settle) {
      await fixture.whenStable();
    } else {
      fixture.detectChanges();
    }
    return { fixture, reload, save, submitAttempt, runTests };
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

  it('shows the exercise with its statement, its examples and its hidden checks', async () => {
    await renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Suma de los elementos de un vector' }),
    ).toBeTruthy();
    expect(document.title).toBe('Suma de los elementos de un vector · TutorIA');
    expect(screen.getByText('Media')).toBeTruthy();
    const statement = screen.getByRole('region', { name: 'Enunciado' });
    expect(text(statement)).toContain('Escribe una función suma');
    const rows = within(statement).getAllByRole('row').slice(1).map(text);
    expect(rows).toEqual([
      'suma([1, 2, 3]) 6',
      'suma([5]) 5',
      'suma([]) 0',
      'suma([-2, 2, 10]) 10',
    ]);
    expect(
      within(statement).getByText(
        'Y 1 comprobación oculta: verás si la superas, pero no sus datos.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Código' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Tutor' })).toBeTruthy();
  });

  it('opens or creates the attempt and shows its status', async () => {
    const openOrCreate = vi.fn((exerciseId: string) =>
      Promise.resolve(attemptOf(exerciseId, 'tests_failed')),
    );
    await renderPage({ openOrCreate });

    expect(openOrCreate).toHaveBeenCalledWith(SUM.exercise.id);
    expect(screen.getByText('Con fallos')).toBeTruthy();
  });

  it('counts several hidden checks, and none', async () => {
    await renderPage({ getDetail: () => Promise.resolve({ ...SUM, hiddenTestCount: 2 }) });
    expect(
      screen.getByText('Y 2 comprobaciones ocultas: verás si las superas, pero no sus datos.'),
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
    const openOrCreate = vi.fn((exerciseId: string) => Promise.resolve(attemptOf(exerciseId)));
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
        openOrCreate: (exerciseId) =>
          Promise.resolve({ ...attemptOf(exerciseId), currentCode: 'function suma' }),
      });
      expect(screen.queryByRole('textbox', { name: 'Código' })).toBeNull();

      await showEditor(fixture);

      expect(editorView().state.doc.toString()).toBe('function suma');
      expect(screen.getByText(/Esc y después Tab/)).toBeTruthy();
    });

    it('starts an empty attempt with the name of the function as help', async () => {
      const { fixture } = await renderPage();
      await showEditor(fixture);

      expect(screen.getByText('Escribe aquí la función suma')).toBeTruthy();
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

      type('function suma() {}');
      await fixture.whenStable();
      expect(screen.getByText('Guardando…')).toBeTruthy();
      hideTab();
      await fixture.whenStable();

      expect(save).toHaveBeenCalledExactlyOnceWith(
        `attempt-${SUM.exercise.id}`,
        'function suma() {}',
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
        openOrCreate: (exerciseId) => Promise.resolve(attemptOf(exerciseId, 'submitted')),
      });
      await showEditor(fixture);

      expect(screen.getByRole('textbox', { name: 'Código' }).getAttribute('aria-readonly')).toBe(
        'true',
      );
      expect(screen.queryByText(/Guard/)).toBeNull();
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
      type('function suma(v) {}');

      await userEvent.setup().click(runButton());
      await fixture.whenStable();

      expect(runTests).toHaveBeenCalledExactlyOnceWith(
        `attempt-${SUM.exercise.id}`,
        'function suma(v) {}',
      );
      const results = screen.getByRole('group', { name: 'Resultados de las pruebas' });
      expect(text(results)).toContain('3 de 5 superadas');
      expect(text(results)).toContain('No superada: suma([])');
      expect(text(results)).toMatch(/Obtenido:\s?NaN/);
      expect(text(document.querySelector('p[aria-live="polite"]'))).toBe(
        '3 de 5 pruebas superadas.',
      );
      expect(text(document.querySelector('app-status-chip'))).toContain('Con fallos · 3/5');
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
        openOrCreate: (exerciseId) =>
          Promise.resolve({
            ...attemptOf(exerciseId, 'submitted'),
            finishedAt: '2026-11-08T10:30:00.000Z',
          }),
      });

      expect(
        screen.getByText(/Entregado el .*2026.* El código ya no se puede cambiar/),
      ).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Ejecutar pruebas' })).toBeNull();
      expect(screen.queryByText(/Ejecuta las pruebas para comprobar/)).toBeNull();
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
      expect(localStorage.getItem(statementShareKey('student-1'))).toBe('50');
    });

    it('starts with the share the student left', async () => {
      localStorage.setItem(statementShareKey('student-1'), '60');

      await renderPage();

      expect(statementZone().style.flexBasis).toBe('60%');
    });

    it('goes away while the statement is folded, and on a phone', async () => {
      await renderPage();
      await userEvent.setup().click(screen.getByRole('button', { name: 'Enunciado' }));

      expect(screen.queryByRole('separator')).toBeNull();
      expect(statementZone().style.flexBasis).toBe('');
    });

    it('does not show on a phone, where each zone is a tab', async () => {
      await renderPage({ compact: true });

      expect(screen.queryByRole('separator')).toBeNull();
    });
  });
});
