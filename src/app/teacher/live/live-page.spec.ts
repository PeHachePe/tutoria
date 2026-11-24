import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GuideStore } from '../../core/guide/guide-store';
import { FakeGuideStore } from '../../core/guide/guide-testing';
import { provideRouter, Router } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { TEACHER_PARAMS } from '../../core/app-paths';
import { DataError } from '../../data/data-error';
import { LiveService, type LiveSnapshot } from '../../data/live-service';
import { testEvents } from '../../data/process-event-testing';
import { LOADING_INDICATOR_DELAY_MS } from '../../shared/skeleton/loading-skeleton';
import { LivePage } from './live-page';
import { LiveStore } from './live-store';
import {
  ago,
  FakeLiveService,
  GROUPS,
  NOW,
  STUDENTS,
  testAttempt,
  testSnapshot,
} from './live-testing';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/** Ana working, Bea failing the same test for 9 minutes (stopped) and Cai with the block submitted. */
const SNAPSHOT = testSnapshot({
  students: [{ id: 'ana', name: 'Álvaro' }, ...STUDENTS.slice(1)],
  events: [11, 10, 9].map((m) => testEvents.run('a2', ago(m), ['e1-t1'])),
  attempts: [
    testAttempt('a1', 'ana', { updatedAt: ago(1) }),
    testAttempt('a2', 'bea', { status: 'tests_failed', updatedAt: ago(9) }),
    ...['as1', 'as2'].map((assignmentId, index) =>
      testAttempt(`c${index}`, 'cai', {
        assignmentId,
        status: 'submitted',
        finishedAt: ago(2),
        updatedAt: ago(2),
      }),
    ),
  ],
});

/** The three students fail the first test of the first exercise now. */
const FAILING = testSnapshot({
  attempts: STUDENTS.map((student) =>
    testAttempt(`f-${student.id}`, student.id, { status: 'tests_failed', updatedAt: ago(1) }),
  ),
  events: STUDENTS.map((student) => testEvents.run(`f-${student.id}`, ago(1), ['e1-t1'])),
});

/** Out of class: Ana submitted the first exercise long ago, Bea started the second one. */
const OFF_CLASS = testSnapshot({
  attempts: [
    testAttempt('o1', 'ana', {
      status: 'submitted',
      startedAt: ago(3000),
      finishedAt: ago(2900),
      updatedAt: ago(2900),
    }),
    testAttempt('o2', 'bea', { assignmentId: 'as2', startedAt: ago(4000), updatedAt: ago(4000) }),
  ],
});

describe('LivePage', () => {
  let service: FakeLiveService;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(NOW);
    service = new FakeLiveService();
    service.snapshots = () => Promise.resolve(SNAPSHOT);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as Partial<Window>).matchMedia;
  });

  async function renderPage(query: Record<string, string> = {}, snapshot?: LiveSnapshot) {
    if (snapshot) service.snapshots = () => Promise.resolve(snapshot);
    const view = await render(LivePage, {
      providers: [provideRouter([]), LiveStore, { provide: LiveService, useValue: service }],
    });
    const router = view.fixture.debugElement.injector.get(Router);
    await router.navigate([], { queryParams: query });
    await view.fixture.whenStable();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    return { ...view, router, user };
  }

  const tabs = () => screen.getAllByRole('tab').map((tab) => text(tab));
  const table = () => screen.getByRole('table');
  const names = () =>
    within(table())
      .getAllByRole('row')
      .slice(1)
      .map((row) => text(within(row).getAllByRole('cell')[0]));

  it('names the group and the block in the title, with the subject over it', async () => {
    await renderPage();

    expect(text(screen.getByRole('heading', { level: 1 }))).toBe('1.º DAW A · b1');
    expect(screen.getByText('En directo')).toBeTruthy();
    expect(screen.getByText(GROUPS[0].subject.name)).toBeTruthy();
    expect(document.title).toBe('1.º DAW A · En vivo · TutorIA');
    expect(text(screen.getByRole('combobox', { name: 'Grupo' }))).toBe('1.º DAW A');
    // The block in the field without the marks of its option
    expect(text(screen.getByRole('combobox', { name: 'Bloque' }))).toBe('b1');
    expect(screen.getByRole('region', { name: /^A quién atender/ })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Dónde está la clase' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Ritmo de la clase' })).toBeTruthy();
    expect(screen.getByRole('table', { name: '1.º DAW A · b1' })).toBeTruthy();
  });

  it('shows a tab per filter with its count, and announces the counts that change', async () => {
    await renderPage();

    expect(tabs()).toEqual([
      'Todos 3',
      'Necesitan ayuda 1',
      'Trabajando ahora 2',
      'Parados y sin entrar 1',
      'Han terminado 1',
    ]);
    expect(text(screen.getByRole('region', { name: 'Dónde está la clase' }))).toContain(
      'Avance del bloque 33 %',
    );
    expect(text(screen.getByText(/^Trabajando ahora: 2 de 3\./))).toBe(
      'Trabajando ahora: 2 de 3. Necesitan ayuda: 1.',
    );
  });

  it('counts who stopped and who has not come in together', async () => {
    await renderPage(
      {},
      testSnapshot({
        students: [...STUDENTS, { id: 'dan', name: 'Dan' }],
        attempts: [
          testAttempt('a1', 'ana', { updatedAt: ago(1) }),
          testAttempt('b1', 'bea', { updatedAt: ago(9) }),
          testAttempt('c1', 'cai', { updatedAt: ago(20) }),
        ],
      }),
    );

    expect(tabs()).toContain('Trabajando ahora 1');
    expect(tabs()).toContain('Parados y sin entrar 3');
  });

  it('filters the table with a tab, keeps it in the URL, and shows everybody with «Todos»', async () => {
    const { fixture, router, user } = await renderPage();

    await user.click(screen.getByRole('tab', { name: /^Parados y sin entrar/ }));
    await fixture.whenStable();

    expect(router.url).toContain(`${TEACHER_PARAMS.filter}=parados`);
    expect(
      screen.getByRole('tab', { name: /^Parados y sin entrar/ }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(names()).toEqual(['Bea']);

    await user.click(screen.getByRole('tab', { name: /^Todos/ }));
    await fixture.whenStable();
    expect(router.url).not.toContain(TEACHER_PARAMS.filter);
    expect(names()).toHaveLength(3);
  });

  it('keeps the filter of the URL', async () => {
    await renderPage({ [TEACHER_PARAMS.filter]: 'ayuda' });

    expect(names()).toEqual(['Bea']);
    expect(
      screen.getByRole('tab', { name: /^Necesitan ayuda/ }).getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('shows who fails a common test and takes the filter away with its chip', async () => {
    const { fixture, user } = await renderPage({}, FAILING);

    await user.click(screen.getByRole('button', { name: /^Ver quiénes fallan/ }));
    await fixture.whenStable();
    expect(names()).toHaveLength(3);
    expect(screen.getByText(/^Fallan \w+\(\[\]\)$/)).toBeTruthy();
    expect(screen.getByRole('tab', { name: /^Todos/ }).getAttribute('aria-selected')).toBe('false');

    await user.click(screen.getByRole('button', { name: 'Quitar el filtro' }));
    await fixture.whenStable();
    expect(screen.queryByText(/^Fallan /)).toBeNull();
  });

  it('filters by a part of a summary, which a tab takes away', async () => {
    const { fixture, user } = await renderPage();

    await user.click(screen.getByRole('button', { name: '1 con fallos' }));
    await fixture.whenStable();
    expect(names()).toEqual(['Bea']);
    expect(screen.getByText(/^Con fallos en 1\. /)).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: /^Han terminado/ }));
    await fixture.whenStable();
    expect(screen.queryByText(/^Con fallos en/)).toBeNull();
    expect(names()).toEqual(['Cai']);
  });

  it('marks the blocks with activity now in the selector', async () => {
    const { user } = await renderPage();

    await user.click(screen.getByRole('combobox', { name: 'Bloque' }));

    expect(text(screen.getByRole('option', { name: /^b1/ }))).toBe('b1 con actividad ahora');
    expect(text(screen.getByRole('option', { name: /^b2/ }))).toBe('b2');
  });

  it('follows the whole class from the selector, with the submissions of the class', async () => {
    const { fixture, router, user } = await renderPage();

    await user.click(screen.getByRole('combobox', { name: 'Bloque' }));
    expect(screen.getAllByRole('option')[0].textContent?.trim()).toBe('Toda la clase');
    await user.click(screen.getByRole('option', { name: 'Toda la clase' }));
    await fixture.whenStable();

    expect(router.url).toBe(`/?${TEACHER_PARAMS.group}=g1&${TEACHER_PARAMS.block}=todos`);
    expect(text(screen.getByRole('heading', { level: 1 }))).toBe('1.º DAW A · Toda la clase');
    expect(tabs()).toContain('Han entregado 0');
    expect(screen.queryByText(/Avance del bloque/)).toBeNull();
  });

  it('takes an attended student out of the queue', async () => {
    const { fixture, user } = await renderPage();

    await user.click(screen.getByRole('button', { name: 'Marcar como atendido: Bea' }));
    await fixture.whenStable();

    expect(text(screen.getByRole('region', { name: /^A quién atender/ }))).toContain(
      'Todo en orden',
    );
  });

  it('finds a student by name, without minding accents nor capitals', async () => {
    const { fixture, user } = await renderPage();

    await user.type(screen.getByRole('searchbox', { name: 'Buscar alumno' }), ' ALVARO ');
    await fixture.whenStable();

    expect(names()).toEqual(['Álvaro']);
  });

  describe('out of class', () => {
    it('shows what the block accumulated, without the queue nor the pace', async () => {
      await renderPage({ [TEACHER_PARAMS.block]: 'b1' }, OFF_CLASS);

      expect(text(screen.getByRole('heading', { level: 1 }).previousElementSibling)).toMatch(
        /^Fuera de clase · .+ · última actividad: \S+ 11 nov$/,
      );
      expect(screen.queryByText('En directo')).toBeNull();
      expect(screen.queryByRole('region', { name: /^A quién atender/ })).toBeNull();
      expect(screen.queryByRole('region', { name: 'Ritmo de la clase' })).toBeNull();
      expect(tabs()).toEqual(['Todos 3', 'Han empezado 2', 'Han terminado 0']);
      expect(text(screen.getByRole('region', { name: 'Dónde está la clase' }))).toContain(
        'Avance del bloque 17 %',
      );
      expect(screen.queryByText(/^Trabajando ahora:/)).toBeNull();
    });

    it('filters who started, and ignores a filter of the class', async () => {
      const { fixture, user } = await renderPage(
        { [TEACHER_PARAMS.block]: 'b1', [TEACHER_PARAMS.filter]: 'parados' },
        OFF_CLASS,
      );
      expect(names()).toHaveLength(3);

      await user.click(screen.getByRole('tab', { name: /^Han empezado/ }));
      await fixture.whenStable();

      expect(names()).toEqual(['Ana', 'Bea']);
    });

    it('asks to choose a block with the whole class, without tabs nor table', async () => {
      await renderPage({ [TEACHER_PARAMS.block]: 'todos' }, testSnapshot());

      expect(screen.queryByRole('tab')).toBeNull();
      expect(screen.queryByRole('table')).toBeNull();
      expect(text(screen.getByRole('region', { name: 'Dónde está la clase' }))).toContain(
        'Elige un bloque',
      );
      expect(text(screen.getByRole('heading', { level: 1 }).previousElementSibling)).toBe(
        `Fuera de clase · ${GROUPS[0].subject.name}`,
      );
    });

    it('takes the focus to the title when the teacher chooses a block there', async () => {
      const { fixture, user } = await renderPage(
        { [TEACHER_PARAMS.block]: 'todos' },
        testSnapshot(),
      );

      await user.click(screen.getByRole('link', { name: 'b2' }));
      await fixture.whenStable();

      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
    });
  });

  it('keeps still for whoever asks for less motion', async () => {
    await renderPage();

    const moving = [...document.querySelectorAll('.animate-ping')];
    expect(moving.length).toBeGreaterThan(0);
    for (const element of moving) {
      expect(element.classList).toContain('motion-reduce:animate-none');
    }
  });

  it('searches with its own clear button', async () => {
    const { fixture, user } = await renderPage();
    const search = screen.getByRole('searchbox', { name: 'Buscar alumno' });
    expect(screen.queryByRole('button', { name: 'Borrar la búsqueda' })).toBeNull();

    await user.type(search, 'bea');
    await fixture.whenStable();
    expect(names()).toEqual(['Bea']);

    await user.click(screen.getByRole('button', { name: 'Borrar la búsqueda' }));
    await fixture.whenStable();
    expect((search as HTMLInputElement).value).toBe('');
    expect(names()).toHaveLength(3);
  });

  it('changes the group and the block in the URL, the group without a block', async () => {
    const hidden = { ...GROUPS[0].blocks[1], isHidden: true };
    service.groups = () =>
      Promise.resolve([{ ...GROUPS[0], blocks: [GROUPS[0].blocks[0], hidden] }, GROUPS[1]]);
    const { fixture, router, user } = await renderPage();

    await user.click(screen.getByRole('combobox', { name: 'Bloque' }));
    expect(text(screen.getByRole('option', { name: /^b2/ }))).toBe('b2 (oculto)');
    await user.click(screen.getByRole('option', { name: /^b2/ }));
    await fixture.whenStable();
    expect(router.url).toBe(`/?${TEACHER_PARAMS.group}=g1&${TEACHER_PARAMS.block}=b2`);

    await user.click(screen.getByRole('combobox', { name: 'Grupo' }));
    await user.click(screen.getByRole('option', { name: /^1\.º DAM B/ }));
    await fixture.whenStable();
    expect(router.url).toBe(`/?${TEACHER_PARAMS.group}=g2`);
    expect(screen.getByText('Este grupo aún no tiene bloques')).toBeTruthy();
    expect(text(screen.getByRole('heading', { level: 1 }))).toBe('1.º DAM B · Toda la clase');
  });

  it('marks the language of a block title and of a subject that are not translated', async () => {
    const subject = { ...GROUPS[0].subject, translations: {} };
    service.groups = () => Promise.resolve([{ ...GROUPS[0], subject }]);
    const { fixture } = await render(LivePage, {
      providers: [
        provideRouter([]),
        LiveStore,
        { provide: LiveService, useValue: service },
        { provide: LOCALE_ID, useValue: 'en' },
      ],
    });
    await fixture.whenStable();

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByRole('combobox', { name: 'Bloque' }));

    expect(screen.getByRole('option', { name: /^b1/ }).querySelector('[lang="es"]')).not.toBeNull();
    expect(screen.getByText(GROUPS[0].subject.name).getAttribute('lang')).toBe('es');
  });

  it('says so when the teacher has no groups, with the way to create their class', async () => {
    service.groups = () => Promise.resolve([]);
    TestBed.overrideProvider(GuideStore, { useValue: new FakeGuideStore() });
    await renderPage();

    expect(screen.getByText('No tienes grupos este curso')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Crear tu clase' })).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(text(screen.getByRole('heading', { level: 1 }))).toBe('Sesión en vivo');
  });

  it('says so when the block has no exercises', async () => {
    await renderPage({}, testSnapshot({ exercises: [] }));

    expect(screen.getByText('Este bloque no tiene ejercicios')).toBeTruthy();
  });

  it('says so when the group has no exercises, with the whole class', async () => {
    await renderPage({ [TEACHER_PARAMS.block]: 'todos' }, testSnapshot({ exercises: [] }));

    expect(screen.getByText('Este grupo aún no tiene ejercicios')).toBeTruthy();
  });

  it('shows the error and loads again on retry', async () => {
    service.snapshots = () => Promise.reject(new DataError('network'));
    const { fixture, user } = await renderPage();
    expect(text(screen.getByRole('alert'))).toContain('No hay conexión');

    service.snapshots = () => Promise.resolve(SNAPSHOT);
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await fixture.whenStable();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('shows the skeletons and announces the wait only past the threshold', async () => {
    service.snapshots = () => new Promise(() => undefined);
    const { fixture, container } = await render(LivePage, {
      providers: [provideRouter([]), LiveStore, { provide: LiveService, useValue: service }],
    });
    await Promise.resolve();
    fixture.detectChanges();
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(text(screen.getByRole('heading', { level: 1 }))).toBe('1.º DAW A');

    vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS);
    fixture.detectChanges();

    expect(text(screen.getByRole('status'))).toBe('Cargando la sesión…');
  });
});
