import { Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { EditorView } from '@codemirror/view';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { TEACHER_PARAMS } from '../../core/app-paths';
import { AppTitleStrategy } from '../../core/app-title-strategy';
import { PageReloader } from '../../core/page-reloader';
import { DataError } from '../../data/data-error';
import { LiveService } from '../../data/live-service';
import { testEvents as e } from '../../data/process-event-testing';
import { LiveStore } from '../live/live-store';
import {
  ago,
  BLOCK_EXERCISES,
  FakeLiveService,
  NOW,
  testAttempt,
  testDetail,
  testInteraction,
  testSnapshot,
} from '../live/live-testing';
import { AttemptDetailPage } from './attempt-detail-page';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/** Ana's attempt a1, open and failing, with a hint and its answer, a paste and a time away. */
const ATTEMPT = testAttempt('a1', 'ana', {
  startedAt: ago(30),
  updatedAt: ago(5),
  status: 'tests_failed',
  currentCode: 'function sum() {}',
});
const EVENTS = [
  e.run('a1', ago(25), ['e1-t1']),
  e.hint('a1', ago(20), 2),
  e.paste('a1', ago(15), 80),
  e.focusLost('a1', ago(12)),
  e.focusGained('a1', ago(10), 2 * 60_000),
];
const ANSWER = testInteraction('a1', ago(20), {
  hintLevel: 2,
  transcript: 'Mira el caso de la lista vacía.',
});

describe('AttemptDetailPage', () => {
  let service: FakeLiveService;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(NOW);
    service = new FakeLiveService();
    service.details = () =>
      Promise.resolve(testDetail({ attempt: ATTEMPT, events: EVENTS, interactions: [ANSWER] }));
    service.snapshots = () =>
      Promise.resolve(testSnapshot({ attempts: [ATTEMPT], events: EVENTS }));
  });

  afterEach(() => vi.useRealTimers());

  async function renderPage(url = '/', attemptId = 'a1', settle = true) {
    const reload = vi.fn();
    TestBed.configureTestingModule({
      // The editor is deferred, and jsdom has no viewport: each test renders it when it needs it
      deferBlockBehavior: DeferBlockBehavior.Manual,
      providers: [
        // A route with the generic title, as the real one: correcting the URL must not bring it back
        provideRouter([{ path: '**', title: 'Detalle del intento', children: [] }]),
        { provide: TitleStrategy, useExisting: AppTitleStrategy },
        LiveStore,
        { provide: LiveService, useValue: service },
        { provide: PageReloader, useValue: { reload } },
      ],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    const fixture = TestBed.createComponent(AttemptDetailPage);
    fixture.componentRef.setInput('attemptId', attemptId);
    fixture.autoDetectChanges();
    if (settle) await fixture.whenStable();
    return { fixture, router, reload, store: TestBed.inject(LiveStore) };
  }

  const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  it('shows whose attempt it is, its figures and its timeline', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Ana' })).toBeTruthy();
    expect(screen.getByText(/ejercicio 1/)).toBeTruthy();
    expect(screen.getByText('En directo')).toBeTruthy();
    const figures = screen.getByRole('region', { name: 'Cifras del intento' });
    expect(text(figures)).toMatch(/Tiempo ?30 min/);
    expect(text(figures)).toContain('Pistas 1 · nivel 2');
    expect(text(figures)).toContain('Pegados 1 · 80 caracteres');
    expect(text(figures)).toContain('Fuera de la ventana 1 · 2 min');
    const timeline = screen.getByRole('list', { name: 'Línea temporal del intento' });
    const entries = within(timeline)
      .getAllByRole('listitem')
      .filter((item) => item.parentElement === timeline);
    expect(entries.map((entry) => text(entry).replace(/^\S+ \d\d:\d\d |^\d\d:\d\d /, ''))).toEqual([
      expect.stringContaining('Abrió el ejercicio'),
      expect.stringContaining('Ejecutó las pruebas: 4 de 5 superadas'),
      expect.stringContaining('Pidió una pista · nivel 2'),
      expect.stringContaining('Pegó 80 caracteres'),
      expect.stringContaining('Salió de la ventana · 2 min'),
    ]);
    expect(text(timeline)).toContain('Mira el caso de la lista vacía.');
    expect(TestBed.inject(Title).getTitle()).toBe(
      `Ana · ${BLOCK_EXERCISES[0].exercise.title} · TutorIA`,
    );
  });

  it('names the tab after the attempt the teacher ends up on, not one left while loading', async () => {
    let answerFirst: (detail: ReturnType<typeof testDetail>) => void = () => undefined;
    service.details = (attemptId) =>
      attemptId === 'a1'
        ? new Promise((resolve) => (answerFirst = resolve))
        : Promise.resolve(testDetail({ student: { id: 'bea', name: 'Bea' } }));
    const { fixture } = await renderPage('/', 'a1', false);

    fixture.componentRef.setInput('attemptId', 'a2');
    await fixture.whenStable();
    answerFirst(testDetail());
    await fixture.whenStable();

    expect(TestBed.inject(Title).getTitle()).toMatch(/^Bea · /);
  });

  it('puts the group and the block of the attempt in the URL, and goes back to them', async () => {
    const { router } = await renderPage();

    const query = router.parseUrl(router.url).queryParamMap;
    expect(query.get(TEACHER_PARAMS.group)).toBe('g1');
    expect(query.get(TEACHER_PARAMS.block)).toBe('b1');
    expect(service.snapshotCalls).toContain('g1/b1');
    expect(screen.getByRole('link', { name: 'Volver a la sesión' }).getAttribute('href')).toBe(
      '/docente/en-vivo?grupo=g1&bloque=b1',
    );
  });

  it('leaves the URL alone when it already has the group and the block', async () => {
    const { router } = await renderPage('/?grupo=g1&bloque=b1');
    const navigate = vi.spyOn(router, 'navigate');

    service.send({ type: 'event', event: e.run('a1', NOW) });

    expect(navigate).not.toHaveBeenCalled();
    expect(service.snapshotCalls).toEqual(['g1/b1']);
  });

  it('adds what arrives live, sliding it in', async () => {
    const { fixture } = await renderPage('/?grupo=g1&bloque=b1');
    const later = NOW + 5000;
    vi.setSystemTime(later);

    service.send({ type: 'event', event: e.submit('a1', later) });
    service.send({
      type: 'interaction',
      interaction: testInteraction('a1', later, {
        trigger: 'question',
        studentMessage: '¿Por qué falla?',
      }),
    });
    await fixture.whenStable();

    const timeline = screen.getByRole('list', { name: 'Línea temporal del intento' });
    expect(text(timeline)).toContain('Preguntó al tutor');
    expect(text(timeline)).toContain('¿Por qué falla?');
    expect(text(timeline)).toContain('Entregó el ejercicio');
    expect(timeline.querySelectorAll('.animate-live-in')).toHaveLength(2);
  });

  it('filters the timeline, without the silences outside «Todo»', async () => {
    service.details = () =>
      Promise.resolve(
        testDetail({
          attempt: ATTEMPT,
          events: [e.run('a1', ago(25)), e.run('a1', ago(10))],
          interactions: [ANSWER],
        }),
      );
    service.snapshots = () => Promise.resolve(testSnapshot({ attempts: [ATTEMPT] }));
    const { fixture } = await renderPage();
    expect(screen.getByText(/10 min sin actividad/)).toBeTruthy();

    await user().click(screen.getByRole('radio', { name: 'Tutor 1' }));
    await fixture.whenStable();

    const timeline = screen.getByRole('list', { name: 'Línea temporal del intento' });
    expect(text(timeline)).toContain('Pidió una pista');
    expect(text(timeline)).not.toContain('Ejecutó');
    expect(screen.queryByText(/sin actividad/)).toBeNull();

    await user().click(screen.getByRole('radio', { name: 'Pegados y salidas 0' }));
    await fixture.whenStable();
    expect(screen.getByText('Nada de esto en este intento.')).toBeTruthy();
  });

  it('says why the student waits and takes them out of the queue when attended', async () => {
    const stuck = [1, 2, 3, 4].map((minutes) => e.run('a1', ago(minutes), ['e1-t1']));
    service.snapshots = () => Promise.resolve(testSnapshot({ attempts: [ATTEMPT], events: stuck }));
    const { fixture } = await renderPage('/?grupo=g1&bloque=b1');

    expect(text(screen.getByRole('status'))).toContain('Falla 4 veces seguidas la misma prueba');

    await user().click(screen.getByRole('button', { name: 'Marcar como atendido: Ana' }));
    await fixture.whenStable();

    expect(screen.queryByRole('button', { name: /Marcar como atendido/ })).toBeNull();
  });

  it('links the other attempts of the student at the exercise', async () => {
    const practice = testAttempt('a2', 'ana', { number: 2, updatedAt: ago(1) });
    service.details = () =>
      Promise.resolve(testDetail({ attempt: practice, events: [], interactions: [] }));
    service.snapshots = () =>
      Promise.resolve(testSnapshot({ attempts: [ATTEMPT, practice], events: [] }));
    await renderPage('/?grupo=g1&bloque=b1', 'a2');

    expect(screen.getByText('Intento 2 · Repitiendo')).toBeTruthy();
    const attempts = screen.getByRole('navigation', {
      name: 'Intentos del alumno en este ejercicio',
    });
    const [first, second] = within(attempts).getAllByRole('link');
    expect(first.getAttribute('href')).toBe('/docente/en-vivo/a1?grupo=g1&bloque=b1');
    expect(second.getAttribute('aria-current')).toBe('page');
  });

  it('shows the code read only and offers the latest when the student changes it', async () => {
    const { fixture } = await renderPage('/?grupo=g1&bloque=b1');
    const [block] = await fixture.getDeferBlocks();
    await block.render(DeferBlockState.Complete);
    const code = () =>
      EditorView.findFromDOM(
        screen.getByRole('textbox', { name: 'Código del alumno' }),
      )?.state.doc.toString();
    expect(screen.getByRole('heading', { name: 'Código actual' })).toBeTruthy();
    expect(code()).toBe('function sum() {}');

    service.send({
      type: 'attempt',
      attempt: {
        ...ATTEMPT,
        currentCode: 'function sum(items) {}',
        updatedAt: new Date(NOW).toISOString(),
      },
    });
    await fixture.whenStable();
    await user().click(screen.getByRole('button', { name: 'Ver el actual' }));
    await fixture.whenStable();

    expect(code()).toBe('function sum(items) {}');
    expect(screen.queryByText('El código ha cambiado')).toBeNull();
  });

  it('marks an exercise without translation, and leaves out a block the panel does not know', async () => {
    const [entry] = BLOCK_EXERCISES;
    service.details = () =>
      Promise.resolve(
        testDetail({
          blockId: 'gone',
          exercise: {
            ...entry,
            exercise: { ...entry.exercise, sourceLocale: 'en', translations: {} },
          },
        }),
      );
    await renderPage();

    const title = screen.getByText(entry.exercise.title);
    expect(title.getAttribute('lang')).toBe('en');
    expect(text(title.parentElement)).not.toContain('b1');
  });

  it('shows the submitted code of a submitted attempt', async () => {
    const submitted = {
      ...ATTEMPT,
      status: 'submitted' as const,
      finalCode: 'function sum(items) { return 0; }',
      finishedAt: new Date(ago(5)).toISOString(),
    };
    service.details = () => Promise.resolve(testDetail({ attempt: submitted }));
    await renderPage();

    expect(screen.getByRole('heading', { name: 'Código entregado' })).toBeTruthy();
    expect(screen.queryByText('En directo')).toBeNull();
  });

  it('offers to reload the page when the editor cannot load', async () => {
    const { fixture, reload } = await renderPage();
    const [block] = await fixture.getDeferBlocks();
    await block.render(DeferBlockState.Error);

    await user().click(screen.getByRole('button', { name: 'Recargar' }));

    expect(reload).toHaveBeenCalled();
  });

  it('says it cannot find an attempt it cannot see', async () => {
    service.details = () => Promise.reject(new DataError('not_found'));
    await renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Detalle del intento' })).toBeTruthy();
    expect(screen.getByText('No encontramos este intento')).toBeTruthy();
  });

  it('tries again after an error', async () => {
    service.details = () => Promise.reject(new DataError('network'));
    const { fixture } = await renderPage();
    service.details = () => Promise.resolve(testDetail());

    await user().click(screen.getByRole('button', { name: 'Reintentar' }));
    await fixture.whenStable();

    expect(screen.getByRole('heading', { level: 1, name: 'Ana' })).toBeTruthy();
  });

  it('shows a skeleton while it loads', async () => {
    service.details = () => new Promise(() => undefined);
    const { fixture } = await renderPage('/', 'a1', false);

    vi.advanceTimersByTime(1000);
    fixture.detectChanges();

    expect(screen.getByText('Cargando el intento…')).toBeTruthy();
  });
});
