import { LiveAnnouncer } from '@angular/cdk/a11y';
import { LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { testEvents as e } from '../../data/process-event-testing';
import type { LiveRow } from './live-row';
import { LIVE_CARDS_PAGE, LIVE_TABLE_PAGE, LiveTable } from './live-table';
import {
  ago,
  BLOCK_EXERCISES,
  GROUP_EXERCISES,
  GROUPS,
  MINUTE,
  NOW,
  testAttempt,
  testRow,
  testRows,
  testSnapshot,
} from './live-testing';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/** Ana stuck with hints, Bea practising a submitted exercise, Cai without starting. */
const ROWS = testRows(
  testSnapshot({
    attempts: [
      testAttempt('a1', 'ana', { status: 'tests_failed', startedAt: ago(12), updatedAt: ago(1) }),
      testAttempt('b1', 'bea', {
        status: 'submitted',
        startedAt: ago(200),
        finishedAt: ago(190),
        updatedAt: ago(190),
      }),
      testAttempt('b2', 'bea', { number: 2, startedAt: ago(10), updatedAt: ago(5) }),
    ],
    events: [
      e.hint('a1', ago(6), 2),
      ...[4, 3, 2].map((m) => e.run('a1', ago(m), ['e1-t1'])),
      e.run('b2', ago(5)),
    ],
  }),
);

/** `count` students working, named so that their order by name is their number. */
function manyRows(count: number): LiveRow[] {
  return Array.from({ length: count }, (_, index) =>
    testRow({
      student: { id: `s${index}`, name: `Alumno ${String(index + 1).padStart(2, '0')}` },
      work: 'working',
      lastActivity: ago(index % 3),
    }),
  );
}

interface Options {
  readonly now?: number;
  readonly locale?: string;
  readonly blockId?: string | null;
  readonly inClass?: boolean;
}

async function renderTable(rows: readonly LiveRow[] = ROWS, options: Options = {}) {
  const { now = NOW, locale = 'es', blockId = 'b1', inClass = true } = options;
  const view = await render(LiveTable, {
    inputs: {
      rows,
      caption: '1.º DAW A · Tema 1',
      now,
      blocks: GROUPS[0].blocks,
      blockId,
      inClass,
      pageKey: 'all',
    },
    providers: [provideRouter([]), { provide: LOCALE_ID, useValue: locale }],
  });
  const announcer = view.fixture.debugElement.injector.get(LiveAnnouncer);
  const announce = vi.spyOn(announcer, 'announce').mockResolvedValue();
  const set = (name: string, value: unknown) => {
    view.fixture.componentRef.setInput(name, value);
    view.fixture.detectChanges();
  };
  return { view, set, announce, table: screen.getByRole('table', { name: '1.º DAW A · Tema 1' }) };
}

function bodyRows(table: HTMLElement): HTMLElement[] {
  return within(table).getAllByRole('row').slice(1);
}

function names(table: HTMLElement): string[] {
  return bodyRows(table).map((row) => text(within(row).getAllByRole('cell')[0]));
}

/** The cards, which are the list items with a name. */
function cards(): HTMLElement[] {
  return screen.getAllByRole('listitem');
}

describe('LiveTable', () => {
  it('puts the queue first, then the session and then who has not come in, by name', async () => {
    const reason = (since: number) => ({ kind: 'hints_exhausted', since }) as const;
    const { table } = await renderTable([
      testRow({ student: { id: 'z', name: 'Zoe' }, work: 'stopped', lastActivity: ago(9) }),
      testRow({ student: { id: 'y', name: 'Yan' } }),
      testRow({ student: { id: 'x', name: 'Xia' }, work: 'working', lastActivity: ago(1) }),
      testRow({ student: { id: 'w', name: 'Wes' }, work: 'working', reason: reason(ago(2)) }),
      testRow({ student: { id: 's', name: 'Sol' }, work: 'working', reason: reason(ago(2)) }),
      testRow({ student: { id: 'v', name: 'Ven' }, work: 'working', reason: reason(ago(5)) }),
      testRow({ student: { id: 'u', name: 'Uma' } }),
      testRow({
        student: { id: 't', name: 'Teo' },
        work: 'working',
        reason: { kind: 'hint_rush', hints: 3, since: ago(9) },
      }),
    ]);

    expect(names(table)).toEqual(['Ven', 'Sol', 'Wes', 'Teo', 'Xia', 'Zoe', 'Uma', 'Yan']);
  });

  it('shows what each student does now, without columns of times, pastes or absences', async () => {
    const { table } = await renderTable();
    const headers = within(table).getAllByRole('columnheader').map(text);
    const [ana, bea, cai] = bodyRows(table).map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => text(cell)),
    );

    expect(headers).toEqual([
      'Alumno',
      'Ejercicio',
      'Estado',
      'Pistas',
      'Última actividad',
      'Observaciones',
    ]);
    expect(ana).toEqual([
      'Ana',
      expect.stringMatching(/^1\. /),
      'error Con fallos · 4/5, 4 de 5 pruebas superadas',
      '1 (nivel 2)',
      'Hace 1 min',
      'replay Atascado',
    ]);
    expect(bea[1]).toMatch(/Repitiendo$/);
    expect(bea.at(-1)).toBe('replay Repite ejercicios');
    expect(cai).toEqual(['Cai', '', 'radio_button_unchecked Sin empezar', '', '', '']);
    expect(within(table).getByRole('link', { name: 'Ana' }).getAttribute('href')).toBe(
      '/docente/en-vivo/a1',
    );
  });

  it('draws the share of tests passed next to the status', async () => {
    const { table } = await renderTable();
    const bar = bodyRows(table)[0].querySelector<HTMLElement>('.bg-chart-done');

    expect(bar?.style.width).toBe('80%');
    expect(bar?.parentElement?.getAttribute('aria-hidden')).toBe('true');
  });

  it('names the block of an exercise that is not in the block shown', async () => {
    const rows = testRows(
      testSnapshot({
        exercises: GROUP_EXERCISES,
        attempts: [
          testAttempt('a1', 'ana', { updatedAt: ago(1) }),
          testAttempt('b3', 'bea', { assignmentId: 'as3', updatedAt: ago(2) }),
        ],
      }),
    );
    const { table } = await renderTable(rows);
    const [ana, bea] = bodyRows(table).map((row) => text(within(row).getAllByRole('cell')[1]));

    expect(ana).not.toContain('·');
    expect(bea).toMatch(/^1\. .* · b2$/);
  });

  it('greys out whoever has not come in, only while others work', async () => {
    const { table, set } = await renderTable();
    const [, , cai] = bodyRows(table);
    expect(bodyRows(table)[1].classList).not.toContain('text-on-surface-variant');
    expect(cai.classList).toContain('text-on-surface-variant');

    set('inClass', false);

    expect(bodyRows(table).some((row) => row.classList.contains('text-on-surface-variant'))).toBe(
      false,
    );
  });

  it('says «ahora mismo» for what happened this minute', async () => {
    const { table } = await renderTable(ROWS, { now: ago(1) });

    expect(text(bodyRows(table)[0])).toContain('Ahora mismo');
  });

  it('gives the date and time of what happened over an hour ago', async () => {
    const { table } = await renderTable(ROWS, { now: NOW + 2 * 60 * MINUTE });

    expect(text(bodyRows(table)[0])).toMatch(/13 nov, \d\d:59/);
  });

  it('sorts by any column, says it aloud and goes back to the default order', async () => {
    const { table, announce } = await renderTable();
    const user = userEvent.setup();
    const headers = within(table).getAllByRole('columnheader');

    for (const header of headers) {
      await user.click(within(header).getByRole('button'));
      expect(names(table)).toHaveLength(3);
    }
    const student = within(headers[0]).getByRole('button');
    await user.click(student);
    expect(names(table)).toEqual(['Ana', 'Bea', 'Cai']);
    expect(announce).toHaveBeenLastCalledWith('Ordenado por Alumno, de menor a mayor');
    await user.click(student);
    expect(names(table)).toEqual(['Cai', 'Bea', 'Ana']);
    expect(announce).toHaveBeenLastCalledWith('Ordenado por Alumno, de mayor a menor');
    await user.click(student);
    expect(announce).toHaveBeenLastCalledWith('Ordenado por quién necesita atención');
  });

  it('sorts the exercises by the position of their block and their own', async () => {
    const rows = testRows(
      testSnapshot({
        exercises: GROUP_EXERCISES,
        attempts: [
          testAttempt('a1', 'ana', { assignmentId: 'as3', updatedAt: ago(1) }),
          testAttempt('b1', 'bea', { assignmentId: 'as2', updatedAt: ago(1) }),
          testAttempt('c1', 'cai', { updatedAt: ago(1) }),
        ],
      }),
    );
    const { table } = await renderTable(rows);

    await userEvent.setup().click(within(table).getByRole('button', { name: 'Ejercicio' }));

    expect(names(table)).toEqual(['Cai', 'Bea', 'Ana']);
  });

  it('shows 8 rows a page, with the paginator only when there are more', async () => {
    const { table } = await renderTable(manyRows(LIVE_TABLE_PAGE));

    expect(bodyRows(table)).toHaveLength(LIVE_TABLE_PAGE);
    // The cards, 6 a page, do have one
    expect(screen.getAllByRole('button', { name: 'Next page' })).toHaveLength(1);
  });

  it('pages the table and the cards, each with its own size', async () => {
    const { table } = await renderTable(manyRows(14));
    const user = userEvent.setup();
    const [tableNext, cardsNext] = screen.getAllByRole('button', { name: 'Next page' });

    expect(names(table)).toHaveLength(LIVE_TABLE_PAGE);
    expect(cards()).toHaveLength(LIVE_CARDS_PAGE);
    await user.click(tableNext);
    expect(names(table)).toEqual(
      Array.from({ length: 6 }, (_, index) => `Alumno ${String(index + 9).padStart(2, '0')}`),
    );
    await user.click(cardsNext);
    expect(text(cards()[0])).toContain('Alumno 07');
  });

  it('goes back to the first page when the filters change, and not with live changes', async () => {
    const { table, set } = await renderTable(manyRows(14));
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: 'Next page' })[0]);

    set('rows', manyRows(15));
    expect(names(table)[0]).toBe('Alumno 09');

    set('pageKey', 'help');
    expect(names(table)[0]).toBe('Alumno 01');
  });

  it('shows the last page left when the rows shrink under the one shown', async () => {
    const { table, set } = await renderTable(manyRows(14));
    await userEvent.setup().click(screen.getAllByRole('button', { name: 'Next page' })[0]);

    set('rows', manyRows(5));

    expect(names(table)).toHaveLength(5);
  });

  it('gives a card per student for less room, with only what exists', async () => {
    await renderTable();
    const [ana, , cai] = cards();

    expect(text(ana)).toMatch(/Pistas ?1 \(nivel 2\)/);
    expect(text(ana)).toContain('Atascado');
    expect(text(cai)).toBe('Cai radio_button_unchecked Sin empezar');
  });

  it('says so when no student matches the filters', async () => {
    await render(LiveTable, {
      inputs: {
        rows: [],
        caption: '1.º DAW A · Tema 1',
        now: NOW,
        blocks: GROUPS[0].blocks,
        blockId: 'b1',
        inClass: true,
        pageKey: 'help',
      },
      providers: [provideRouter([])],
    });

    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('Ningún alumno coincide con el filtro.')).toBeTruthy();
  });

  it('marks the language of an untranslated exercise', async () => {
    const untranslated = ROWS.map((row) => ({
      ...row,
      exercise: row.exercise && {
        ...row.exercise,
        exercise: { ...row.exercise.exercise, translations: {} },
      },
    }));
    const { table } = await renderTable(untranslated, { locale: 'ca' });

    expect(within(table).getAllByRole('cell')[1].querySelector('[lang="es"]')).not.toBeNull();
    expect(BLOCK_EXERCISES).toHaveLength(2);
  });
});
