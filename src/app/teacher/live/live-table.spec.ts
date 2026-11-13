import { LiveAnnouncer } from '@angular/cdk/a11y';
import { LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { testEvents as e } from '../../data/process-event-testing';
import type { LiveRow } from './live-row';
import { LiveTable } from './live-table';
import {
  ago,
  BLOCK_EXERCISES,
  MINUTE,
  NOW,
  testAttempt,
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
      e.paste('a1', ago(5)),
      e.focusLost('a1', ago(9)),
      e.focusGained('a1', ago(8)),
      e.run('b2', ago(5)),
    ],
  }),
);

async function renderTable(rows: readonly LiveRow[] = ROWS, now = NOW, locale = 'es') {
  const view = await render(LiveTable, {
    inputs: { rows, caption: '1.º DAW A · Tema 1', now },
    providers: [provideRouter([]), { provide: LOCALE_ID, useValue: locale }],
  });
  const announcer = view.fixture.debugElement.injector.get(LiveAnnouncer);
  const announce = vi.spyOn(announcer, 'announce').mockResolvedValue();
  return { view, announce, table: screen.getByRole('table', { name: '1.º DAW A · Tema 1' }) };
}

function bodyRows(table: HTMLElement): HTMLElement[] {
  return within(table).getAllByRole('row').slice(1);
}

function names(table: HTMLElement): string[] {
  return bodyRows(table).map((row) => text(within(row).getAllByRole('cell')[0]));
}

describe('LiveTable', () => {
  it('puts first who needs attention, then whoever moved last', async () => {
    const { table } = await renderTable();

    expect(names(table)).toEqual(['Ana', 'Bea', 'Cai']);
  });

  it('puts something to review before whoever just works, and the quiet ones by name', async () => {
    const rows = testRows(
      testSnapshot({
        attempts: [
          testAttempt('a1', 'cai', { updatedAt: ago(1) }),
          testAttempt('a2', 'bea', { status: 'submitted', finishedAt: ago(2), updatedAt: ago(2) }),
        ],
        events: [e.paste('a2', ago(3), 400), e.submit('a2', ago(2))],
      }),
    ).map((row) => (row.student.id === 'ana' ? { ...row, patterns: [] } : row));
    const { table } = await renderTable([
      ...rows,
      { ...rows[0], student: { id: 'abe', name: 'Abel' } },
    ]);

    expect(names(table)).toEqual(['Bea', 'Cai', 'Abel', 'Ana']);
  });

  it('shows what each student does now', async () => {
    const { table } = await renderTable();
    const [ana, bea, cai] = bodyRows(table).map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => text(cell)),
    );

    expect(ana).toEqual([
      'Ana',
      expect.stringMatching(/^1\. /),
      expect.stringContaining('Con fallos'),
      '12 min',
      '1 (nivel 2)',
      '1',
      '1',
      '4/5',
      'Hace 1 min',
      'replay Atascado',
    ]);
    expect(bea[1]).toMatch(/Repitiendo$/);
    expect(bea.at(-1)).toBe('hourglass_empty Sin avanzar replay Repite ejercicios');
    expect(cai).toEqual([
      'Cai',
      '—',
      expect.stringContaining('Sin empezar'),
      '—',
      '0',
      '0',
      '0',
      '—',
      '—',
      '',
    ]);
    expect(within(table).getByRole('link', { name: 'Ana' }).getAttribute('href')).toBe(
      '/docente/en-vivo/a1',
    );
  });

  it('says «ahora mismo» for what happened this minute', async () => {
    const { table } = await renderTable(ROWS, ago(1));

    expect(text(bodyRows(table)[0])).toContain('Ahora mismo');
  });

  it('gives the date and time of what happened over an hour ago', async () => {
    const { table } = await renderTable(ROWS, NOW + 2 * 60 * MINUTE);

    expect(text(bodyRows(table)[0])).toMatch(/13 nov, \d\d:59/);
  });

  it('sorts by any column, says it aloud and goes back to attention', async () => {
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

  it('gives a card per student for less room, with the same data', async () => {
    await renderTable();
    const cards = screen.getAllByRole('listitem').filter((item) => item.querySelector('dl'));

    expect(cards).toHaveLength(3);
    expect(text(cards[0])).toMatch(/Pistas ?1/);
    expect(text(cards[0])).toContain('Atascado');
    expect(text(cards[2])).not.toContain('Sin empezar Sin empezar');
  });

  it('marks the language of an untranslated exercise', async () => {
    const untranslated = ROWS.map((row) => ({
      ...row,
      exercise: row.exercise && {
        ...row.exercise,
        exercise: { ...row.exercise.exercise, translations: {} },
      },
    }));
    const { table } = await renderTable(untranslated, NOW, 'ca');

    expect(within(table).getAllByRole('cell')[1].querySelector('[lang="es"]')).not.toBeNull();
    expect(BLOCK_EXERCISES).toHaveLength(2);
  });
});
