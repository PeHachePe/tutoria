import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { testEvents as e } from '../../data/process-event-testing';
import { LiveQueue, QUEUE_SHOWN } from './live-queue';
import type { QueuedRow } from './live-store';
import {
  ago,
  GROUP_EXERCISES,
  GROUPS,
  MINUTE,
  NOW,
  testAttempt,
  testRows,
  testSnapshot,
} from './live-testing';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

async function renderQueue(rows: readonly QueuedRow[], now = NOW, blockId: string | null = 'b1') {
  const attend = vi.fn();
  await render(LiveQueue, {
    inputs: { rows, now, blocks: GROUPS[0].blocks, blockId },
    on: { attend },
    providers: [provideRouter([])],
  });
  return { attend, region: screen.getByRole('region', { name: /^A quién atender/ }) };
}

/** The rows of a snapshot that are in the queue. */
function queued(...args: Parameters<typeof testSnapshot>): QueuedRow[] {
  return testRows(testSnapshot(...args)).flatMap((row) =>
    row.reason ? [{ ...row, reason: row.reason }] : [],
  );
}

/** Rows of students failing the first test of `assignmentId` since 5 minutes ago. */
function stuckRows(count: number, assignmentId = 'as1'): QueuedRow[] {
  const students = Array.from({ length: count }, (_, index) => ({
    id: `s${index}`,
    name: `Alumno ${index + 1}`,
  }));
  return queued({
    students,
    exercises: GROUP_EXERCISES,
    attempts: students.map((student) =>
      testAttempt(`a-${student.id}`, student.id, {
        assignmentId,
        status: 'tests_failed',
        updatedAt: ago(5),
      }),
    ),
    events: students.flatMap((student) =>
      [7, 6, 5].map((m) => e.run(`a-${student.id}`, ago(m), ['t1'])),
    ),
  });
}

describe('LiveQueue', () => {
  it('shows the mascot when nobody needs help', async () => {
    const { region } = await renderQueue([]);

    expect(text(region)).toContain('Todo en orden: nadie necesita ayuda ahora mismo.');
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('says who to help, why, at which exercise and for how long, with a link to the attempt', async () => {
    const rows = queued({
      attempts: [testAttempt('a1', 'ana', { status: 'tests_failed', updatedAt: ago(1) })],
      events: [3, 2, 1].map((m) => e.run('a1', ago(m), ['e1-t1'])),
    });
    const { region } = await renderQueue(rows, ago(1));

    const [item] = within(region).getAllByRole('listitem');
    expect(within(item).getByRole('link', { name: 'Ana' }).getAttribute('href')).toBe(
      '/docente/en-vivo/a1',
    );
    expect(text(item)).toContain(
      'Falla 3 veces seguidas la misma prueba y no ha pedido ninguna pista · ejercicio 1',
    );
    expect(text(item)).not.toContain('· b1');
    expect(text(item)).toContain('Ahora');
    expect(text(region)).not.toContain('Primero, quien se ha atascado con el código');
  });

  it('names the block of an exercise that is not in the block shown', async () => {
    const { region } = await renderQueue(stuckRows(1, 'as3'));

    expect(text(within(region).getByRole('listitem'))).toContain('ejercicio 1 · b2');
  });

  it('names the block of every exercise with the whole class', async () => {
    const { region } = await renderQueue(stuckRows(1), NOW, null);

    expect(text(within(region).getByRole('listitem'))).toContain('ejercicio 1 · b1');
  });

  it('counts the waiting minutes and explains the order when there are several', async () => {
    const { region } = await renderQueue(stuckRows(2), NOW + 3 * MINUTE);

    expect(text(within(region).getByRole('heading'))).toBe('A quién atender 2');
    expect(text(region)).toContain('Primero, quien se ha atascado con el código');
    expect(text(within(region).getAllByRole('listitem')[0])).toContain('Espera 8 min');
  });

  it('tells which student was attended', async () => {
    const { attend } = await renderQueue(stuckRows(1));

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Marcar como atendido: Alumno 1' }));

    expect(attend).toHaveBeenCalledWith('s0');
  });

  it('shows the first ones and unfolds the rest', async () => {
    const { region } = await renderQueue(stuckRows(QUEUE_SHOWN + 2));
    const user = userEvent.setup();
    expect(within(region).getAllByRole('listitem')).toHaveLength(QUEUE_SHOWN);

    await user.click(screen.getByRole('button', { name: `Ver los ${QUEUE_SHOWN + 2}` }));
    expect(within(region).getAllByRole('listitem')).toHaveLength(QUEUE_SHOWN + 2);

    await user.click(screen.getByRole('button', { name: 'Ver menos' }));
    expect(within(region).getAllByRole('listitem')).toHaveLength(QUEUE_SHOWN);
  });

  it('leaves out a row without an attempt at an exercise of the group', async () => {
    const [row] = stuckRows(1);

    const { region } = await renderQueue([{ ...row, exercise: null }]);

    expect(text(region)).toContain('Todo en orden');
  });
});
