import { TestBed } from '@angular/core/testing';
import { GuideStore } from '../../core/guide/guide-store';
import { FakeGuideStore } from '../../core/guide/guide-testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { BlockService } from '../../data/block-service';
import { DataError } from '../../data/data-error';
import type { AssignedGroup } from '../../data/exercise';
import { type BlockStats, type GroupHistory, StatsService } from '../../data/stats-service';
import { LOADING_INDICATOR_DELAY_MS } from '../../shared/skeleton/loading-skeleton';
import { HistoryPage } from './history-page';
import { blockStats, deadlineStats } from './history-testing';

const DAW: AssignedGroup = {
  id: 'g1',
  name: '1.º DAW A',
  label: null,
  subject: { id: 's1', name: 'Programación básica', sourceLocale: 'es', translations: {} },
};
const WEB: AssignedGroup = {
  id: 'g2',
  name: '1.º DAW A',
  label: null,
  subject: { id: 's2', name: 'Desarrollo web', sourceLocale: 'es', translations: {} },
};

/** 24 students; three topics with fewer and fewer hints, a resit with one student, one to come. */
function seriesHistory(changes: Partial<GroupHistory> = {}): GroupHistory {
  return {
    students: 24,
    blocks: [
      blockStats('Tema 1', {
        hints: 54,
        attempts: 48,
        solved: 48,
        medianSeconds: 720,
        stuckStudents: 6,
      }),
      blockStats('Tema 2', { hints: 27, attempts: 48 }),
      blockStats('Tema 3', {
        assignments: 3,
        attempts: 59,
        activeStudents: 24,
        hints: 0,
        solved: 41,
        medianSeconds: 360,
      }),
      blockStats('Recuperación', { attempts: 1, activeStudents: 1, hints: 1, medianSeconds: null }),
      blockStats('Tema 5', { attempts: 0, activeStudents: 0, hints: 0 }),
    ],
    deadlines: [],
    ...changes,
  };
}

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('HistoryPage', () => {
  let groups: () => Promise<AssignedGroup[]>;
  let history: (groupId: string) => Promise<GroupHistory>;
  let harness: RouterTestingHarness;

  beforeEach(() => {
    groups = () => Promise.resolve([DAW, WEB]);
    history = () => Promise.resolve(seriesHistory());
  });

  async function renderHistory(url = '/docente/historico', wait = true): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: 'docente/historico', component: HistoryPage }],
          withComponentInputBinding(),
        ),
        { provide: BlockService, useValue: { listGroups: () => groups() } },
        { provide: StatsService, useValue: { groupHistory: (id: string) => history(id) } },
      ],
    });
    harness = await RouterTestingHarness.create(url);
    if (wait) await settle();
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await harness.fixture.whenStable();
    }
  }

  function blockHeading(): string {
    return text(document.getElementById('history-block-heading'));
  }

  function figures(): string {
    return text(document.querySelector('dl'));
  }

  function chart(): HTMLElement {
    return screen.getByRole('list', { name: 'Pistas por ejercicio, bloque a bloque' });
  }

  /** An ISO date `days` from now (negative, before). */
  function daysFromNow(days: number): string {
    return new Date(Date.now() + days * 86_400_000).toISOString();
  }

  describe('header', () => {
    it('says the group and its subject, with the selector of the groups', async () => {
      await renderHistory();

      expect(text(screen.getByRole('heading', { level: 1 }))).toBe('1.º DAW A · Histórico');
      expect(screen.getByText('Programación básica')).toBeTruthy();
      expect(text(screen.getByRole('combobox', { name: 'Grupo' }))).toContain(
        '1.º DAW A · Programación básica',
      );
    });

    it('marks the language of a subject and a block without translation', async () => {
      groups = () =>
        Promise.resolve([
          { ...DAW, subject: { ...DAW.subject, name: 'Coding', sourceLocale: 'en' } },
        ]);
      const english = blockStats('b1', { medianSeconds: null });
      history = () =>
        Promise.resolve(
          seriesHistory({
            blocks: [
              { ...english, block: { ...english.block, title: 'Loops', sourceLocale: 'en' } },
            ],
          }),
        );
      await renderHistory();

      expect(screen.getByText('Coding').getAttribute('lang')).toBe('en');
      expect(document.getElementById('history-block-heading')?.getAttribute('lang')).toBe('en');
    });

    it('has no selector with a single group', async () => {
      groups = () => Promise.resolve([DAW]);
      await renderHistory();

      expect(screen.queryByRole('combobox', { name: 'Grupo' })).toBeNull();
    });

    it('changes the group and forgets the block chosen', async () => {
      const asked: string[] = [];
      history = (id) => {
        asked.push(id);
        return Promise.resolve(seriesHistory());
      };
      await renderHistory('/docente/historico?grupo=g1&bloque=Tema%201');

      await userEvent.click(screen.getByRole('combobox', { name: 'Grupo' }));
      await userEvent.click(screen.getByRole('option', { name: '1.º DAW A · Desarrollo web' }));
      await settle();

      expect(TestBed.inject(Router).url).toBe('/docente/historico?grupo=g2');
      expect(asked).toEqual(['g1', 'g2']);
      expect(screen.getByText('Desarrollo web')).toBeTruthy();
    });
  });

  describe('chart', () => {
    it('reads a falling trend from the blocks half the class worked on', async () => {
      await renderHistory();

      expect(
        screen.getByText(
          'Las pistas bajan de 1,1 a 0,0 por ejercicio: el grupo recurre cada vez menos a la ayuda.',
        ),
      ).toBeTruthy();
      expect(within(chart()).getAllByRole('link')).toHaveLength(4);
      expect(screen.getByText('Menos de media clase: no cuenta')).toBeTruthy();
    });

    it('reads a rising trend and a steady one', async () => {
      history = () =>
        Promise.resolve(
          seriesHistory({
            blocks: [
              blockStats('Tema 1', { hints: 20, attempts: 40 }),
              blockStats('Tema 2', { hints: 40, attempts: 40 }),
            ],
          }),
        );
      await renderHistory();
      expect(
        screen.getByText(
          'Las pistas suben de 0,5 a 1,0 por ejercicio: los últimos bloques piden más ayuda.',
        ),
      ).toBeTruthy();
      expect(screen.queryByText('Menos de media clase: no cuenta')).toBeNull();

      TestBed.resetTestingModule();
      history = () =>
        Promise.resolve(
          seriesHistory({
            blocks: [
              blockStats('Tema 1', { hints: 20, attempts: 40 }),
              blockStats('Tema 2', { hints: 21, attempts: 40 }),
            ],
          }),
        );
      await renderHistory();
      expect(
        screen.getByText(
          'El grupo pide las mismas pistas que al principio: unas 0,5 por ejercicio.',
        ),
      ).toBeTruthy();
    });

    it('says there is no evolution to compare with a single block, instead of a lone bar', async () => {
      history = () => Promise.resolve(seriesHistory({ blocks: [blockStats('Tema 1')] }));
      await renderHistory();

      expect(
        screen.getByText(
          'Aún no hay evolución que comparar: el grupo solo ha trabajado un bloque.',
        ),
      ).toBeTruthy();
      expect(
        screen.queryByRole('list', { name: 'Pistas por ejercicio, bloque a bloque' }),
      ).toBeNull();
      expect(screen.queryByText(/Las pistas|El grupo pide/)).toBeNull();
      expect(blockHeading()).toBe('Tema 1');
    });

    it('draws the bars without a sentence when fewer than two blocks read the trend', async () => {
      history = () =>
        Promise.resolve(
          seriesHistory({
            blocks: [blockStats('Tema 1'), blockStats('Tema 2', { activeStudents: 2 })],
          }),
        );
      await renderHistory();

      expect(within(chart()).getAllByRole('link')).toHaveLength(2);
      expect(screen.queryByText(/Las pistas|El grupo pide/)).toBeNull();
    });
  });

  describe('chosen block', () => {
    it('shows the latest block half the class worked on, with its figures', async () => {
      await renderHistory();

      expect(blockHeading()).toBe('Tema 3');
      expect(screen.getByText(/3 ejercicios/)).toBeTruthy();
      expect(screen.getByText('lo han trabajado 24 de 24 alumnos')).toBeTruthy();
      expect(figures()).toContain('Tiempo por ejercicio 6 min');
      expect(figures()).toContain('Ejercicios superados 57 % 41 de 72');
      expect(figures()).toContain('Se atascaron en alguna prueba Nadie');
    });

    it('shows the block of the URL, with who got stuck', async () => {
      await renderHistory('/docente/historico?grupo=g1&bloque=Tema%201');

      expect(blockHeading()).toBe('Tema 1');
      expect(figures()).toContain('Tiempo por ejercicio 12 min');
      expect(figures()).toContain('Ejercicios superados 100 % 48 de 48');
      expect(figures()).toContain('Se atascaron en alguna prueba 6 de 24');
    });

    it('says a block has no submissions', async () => {
      await renderHistory('/docente/historico?bloque=Recuperaci%C3%B3n');

      expect(blockHeading()).toBe('Recuperación');
      expect(figures()).toContain('Tiempo por ejercicio Sin entregas');
    });

    it('picks a block from its bar, keeping the group and the focus on the bar', async () => {
      await renderHistory('/docente/historico?grupo=g1');

      const bar = within(chart()).getAllByRole('link')[1];
      await userEvent.click(bar);
      await settle();

      expect(TestBed.inject(Router).url).toBe('/docente/historico?grupo=g1&bloque=Tema%202');
      expect(blockHeading()).toBe('Tema 2');
      expect(bar.isConnected).toBe(true);
      expect(bar.getAttribute('aria-current')).toBe('true');
    });

    it('says a single exercise in singular', async () => {
      history = () =>
        Promise.resolve(seriesHistory({ blocks: [blockStats('Tema 1', { assignments: 1 })] }));
      await renderHistory();

      expect(screen.getByText('1 ejercicio')).toBeTruthy();
    });
  });

  describe('due dates', () => {
    it('shows those of the chosen block, by date, with who is missing', async () => {
      history = () =>
        Promise.resolve(
          seriesHistory({
            deadlines: [
              deadlineStats('Tema 3', daysFromNow(-5), {
                onTime: 47,
                missing: [{ student: { id: 's1', name: 'Ana López' }, pending: 1 }],
              }),
              deadlineStats('Tema 3', daysFromNow(-20), { onTime: 48 }),
              deadlineStats('Tema 5', daysFromNow(2)),
            ],
          }),
        );
      await renderHistory();

      const block = document.querySelector('app-block-detail') as HTMLElement;
      expect(within(block).getAllByRole('heading', { level: 3 })).toHaveLength(2);
      expect(text(block)).toContain('Falta 1: Ana López (falta 1 de 2)');
      expect(text(block).indexOf('Todo entregado')).toBeLessThan(text(block).indexOf('Ana López'));
      expect(screen.queryByText(/Tema 5/)).toBeNull();
    });
  });

  describe('states', () => {
    it('shows the skeletons and announces the wait past the threshold', async () => {
      history = () => new Promise(() => undefined);
      await renderHistory('/docente/historico', false);
      await new Promise((resolve) => setTimeout(resolve));
      harness.fixture.detectChanges();

      expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
      await new Promise((resolve) => setTimeout(resolve, LOADING_INDICATOR_DELAY_MS + 50));
      harness.fixture.detectChanges();
      expect(text(screen.getByRole('status'))).toBe('Cargando el histórico…');
      expect(document.querySelectorAll('app-skeleton')).toHaveLength(2);
    });

    it('shows the skeletons while the groups load', async () => {
      groups = () => new Promise(() => undefined);
      await renderHistory('/docente/historico', false);

      expect(text(screen.getByRole('heading', { level: 1 }))).toBe('Histórico');
      expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    });

    it('shows the errors of the groups and of the history, with «Reintentar»', async () => {
      let failGroups = true;
      let failHistory = true;
      groups = () =>
        failGroups ? Promise.reject(new DataError('unknown')) : Promise.resolve([DAW, WEB]);
      history = () =>
        failHistory
          ? Promise.reject(new DataError('unavailable'))
          : Promise.resolve(seriesHistory());
      await renderHistory();

      failGroups = false;
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      await settle();
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();

      failHistory = false;
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      await settle();
      expect(blockHeading()).toBe('Tema 3');
    });

    it('says when the teacher has no groups, with the way to create their class', async () => {
      groups = () => Promise.resolve([]);
      TestBed.overrideProvider(GuideStore, { useValue: new FakeGuideStore() });
      await renderHistory();

      expect(screen.getByText('Aún no tienes grupos')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Crear tu clase' })).toBeTruthy();
    });

    it('says when the group has no activity', async () => {
      const notStarted: BlockStats = blockStats('Tema 1', { attempts: 0, activeStudents: 0 });
      history = () =>
        Promise.resolve(
          seriesHistory({
            blocks: [notStarted],
            deadlines: [deadlineStats('Tema 1', daysFromNow(3))],
          }),
        );
      await renderHistory();

      expect(screen.getByText('Este grupo aún no tiene actividad')).toBeTruthy();
      expect(screen.queryByRole('table')).toBeNull();
      expect(screen.queryByText(/Entrega/)).toBeNull();
    });
  });
});
