import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { testEvents as e } from '../../data/process-event-testing';
import { LiveQueue, QUEUE_SHOWN } from './live-queue';
import type { LiveRow } from './live-row';
import { ago, MINUTE, NOW, testAttempt, testRows, testSnapshot } from './live-testing';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

async function renderQueue(rows: readonly LiveRow[], now = NOW) {
  const attend = vi.fn();
  await render(LiveQueue, {
    inputs: { rows, now },
    on: { attend },
    providers: [provideRouter([])],
  });
  return { attend, region: screen.getByRole('region', { name: /^A quién atender/ }) };
}

/** Rows of students stuck on the first exercise, idle for 9 minutes. */
function idleRows(count: number): LiveRow[] {
  const students = Array.from({ length: count }, (_, index) => ({
    id: `s${index}`,
    name: `Alumno ${index + 1}`,
  }));
  return testRows(
    testSnapshot({
      students,
      attempts: students.map((student) =>
        testAttempt(`a-${student.id}`, student.id, { updatedAt: ago(9) }),
      ),
    }),
  );
}

describe('LiveQueue', () => {
  it('shows the mascot when nobody needs help', async () => {
    const { region } = await renderQueue([]);

    expect(text(region)).toContain('Todo en orden: nadie necesita ayuda ahora mismo.');
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('says who to help, why, at which exercise and for how long, with a link to the attempt', async () => {
    const rows = testRows(
      testSnapshot({
        attempts: [testAttempt('a1', 'ana', { status: 'tests_failed', updatedAt: ago(1) })],
        events: [3, 2, 1].map((m) => e.run('a1', ago(m), ['e1-t1'])),
      }),
    ).filter((row) => row.signal);
    const { region } = await renderQueue(rows, ago(1));

    const [item] = within(region).getAllByRole('listitem');
    expect(within(item).getByRole('link', { name: 'Ana' }).getAttribute('href')).toBe(
      '/docente/en-vivo/a1',
    );
    expect(text(item)).toContain(
      'Falla 3 veces seguidas la misma prueba y no ha pedido ninguna pista · ejercicio 1',
    );
    expect(text(item)).toContain('Ahora');
    expect(text(region)).not.toContain('Primero, quien se ha atascado con el código');
  });

  it('counts the waiting minutes and explains the order when there are several', async () => {
    const { region } = await renderQueue(idleRows(2), NOW + 3 * MINUTE);

    expect(text(within(region).getByRole('heading'))).toBe('A quién atender 2');
    expect(text(region)).toContain('Primero, quien se ha atascado con el código');
    expect(text(within(region).getAllByRole('listitem')[0])).toContain('Espera 8 min');
  });

  it('tells which student was attended', async () => {
    const { attend } = await renderQueue(idleRows(1));

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Marcar como atendido: Alumno 1' }));

    expect(attend).toHaveBeenCalledWith('s0');
  });

  it('shows the first ones and unfolds the rest', async () => {
    const { region } = await renderQueue(idleRows(QUEUE_SHOWN + 2));
    const user = userEvent.setup();
    expect(within(region).getAllByRole('listitem')).toHaveLength(QUEUE_SHOWN);

    await user.click(screen.getByRole('button', { name: `Ver los ${QUEUE_SHOWN + 2}` }));
    expect(within(region).getAllByRole('listitem')).toHaveLength(QUEUE_SHOWN + 2);

    await user.click(screen.getByRole('button', { name: 'Ver menos' }));
    expect(within(region).getAllByRole('listitem')).toHaveLength(QUEUE_SHOWN);
  });

  it('leaves out a row without a signal', async () => {
    const { region } = await renderQueue(testRows(testSnapshot()));

    expect(text(region)).toContain('Todo en orden');
  });
});
