import { LOCALE_ID } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { TEACHER_PARAMS } from '../../core/app-paths';
import { DataError } from '../../data/data-error';
import { LiveService } from '../../data/live-service';
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

/** Ana working, Bea idle for 9 minutes and Cai with the block submitted. */
const SNAPSHOT = testSnapshot({
  students: [{ id: 'ana', name: 'Álvaro' }, ...STUDENTS.slice(1)],
  attempts: [
    testAttempt('a1', 'ana', { updatedAt: ago(1) }),
    testAttempt('a2', 'bea', { updatedAt: ago(9) }),
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

describe('LivePage', () => {
  let service: FakeLiveService;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(NOW);
    service = new FakeLiveService();
    service.snapshots = () => Promise.resolve(SNAPSHOT);
  });

  afterEach(() => vi.useRealTimers());

  async function renderPage(query: Record<string, string> = {}) {
    const view = await render(LivePage, {
      providers: [provideRouter([]), LiveStore, { provide: LiveService, useValue: service }],
    });
    const router = view.fixture.debugElement.injector.get(Router);
    await router.navigate([], { queryParams: query });
    await view.fixture.whenStable();
    return { ...view, router };
  }

  it('says how the class goes and shows the queue, the class and the students', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Sesión en vivo' })).toBeTruthy();
    expect(text(screen.getByText(/en la sesión/).parentElement)).toBe(
      '3 en la sesión · 1 con el bloque entregado',
    );
    const queue = screen.getByRole('region', { name: /^A quién atender/ });
    expect(within(queue).getByRole('link', { name: 'Bea' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'La clase en el bloque' })).toBeTruthy();
    expect(screen.getByRole('table', { name: '1.º DAW A · b2' })).toBeTruthy();
  });

  it('takes an attended student out of the queue', async () => {
    const { fixture } = await renderPage();

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByRole('button', { name: 'Marcar como atendido: Bea' }));
    await fixture.whenStable();

    expect(text(screen.getByRole('region', { name: /^A quién atender/ }))).toContain(
      'Todo en orden',
    );
  });

  it('finds a student by name, without minding accents nor capitals', async () => {
    const { fixture } = await renderPage();
    const table = screen.getByRole('table');

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .type(screen.getByRole('searchbox', { name: 'Buscar alumno' }), ' ALVARO ');
    await fixture.whenStable();

    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByRole('link', { name: 'Álvaro' })).toBeTruthy();
  });

  it('changes the group and the block in the URL, the group at its latest block', async () => {
    const hidden = { ...GROUPS[0].blocks[1], isHidden: true };
    service.groups = () =>
      Promise.resolve([{ ...GROUPS[0], blocks: [GROUPS[0].blocks[0], hidden] }, GROUPS[1]]);
    const { fixture, router } = await renderPage();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await user.click(screen.getByRole('combobox', { name: 'Bloque' }));
    expect(text(screen.getByRole('option', { name: /^b2/ }))).toBe('b2 (oculto)');
    await user.click(screen.getByRole('option', { name: 'b1' }));
    await fixture.whenStable();
    expect(router.url).toBe(`/?${TEACHER_PARAMS.group}=g1&${TEACHER_PARAMS.block}=b1`);

    await user.click(screen.getByRole('combobox', { name: 'Grupo' }));
    await user.click(screen.getByRole('option', { name: /^1\.º DAM B/ }));
    await fixture.whenStable();
    expect(router.url).toBe(`/?${TEACHER_PARAMS.group}=g2`);
    expect(screen.getByText('Este grupo aún no tiene bloques')).toBeTruthy();
  });

  it('marks the language of a block title that is not translated', async () => {
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

    expect(screen.getByRole('option', { name: 'b1' }).querySelector('[lang="es"]')).not.toBeNull();
  });

  it('says so when the teacher has no groups', async () => {
    service.groups = () => Promise.resolve([]);
    await renderPage();

    expect(screen.getByText('Todavía no tienes grupos')).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('says so when the block has no exercises', async () => {
    service.snapshots = () => Promise.resolve(testSnapshot({ exercises: [] }));
    await renderPage();

    expect(screen.getByText('Este bloque no tiene ejercicios')).toBeTruthy();
  });

  it('shows the error and loads again on retry', async () => {
    service.snapshots = () => Promise.reject(new DataError('network'));
    const { fixture } = await renderPage();
    expect(text(screen.getByRole('alert'))).toContain('No hay conexión');

    service.snapshots = () => Promise.resolve(SNAPSHOT);
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByRole('button', { name: 'Reintentar' }));
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

    vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS);
    fixture.detectChanges();

    expect(text(screen.getByRole('status'))).toBe('Cargando la sesión…');
  });
});
