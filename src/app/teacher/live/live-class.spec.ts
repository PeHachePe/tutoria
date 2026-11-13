import { LOCALE_ID } from '@angular/core';
import { render, screen } from '@testing-library/angular';

import { exerciseOverview } from './live-overview';
import { LiveClass } from './live-class';
import { liveState } from './live-state';
import { ago, BLOCK_EXERCISES, STUDENTS, testAttempt, testSnapshot } from './live-testing';
import { testEvents as e } from '../../data/process-event-testing';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

async function renderClass(snapshot = testSnapshot(), locale = 'es') {
  await render(LiveClass, {
    inputs: { overview: exerciseOverview(liveState(snapshot)) },
    providers: [{ provide: LOCALE_ID, useValue: locale }],
  });
  return screen.getByRole('region', { name: 'La clase en el bloque' });
}

function itemOf(title: RegExp): HTMLElement {
  return screen.getByRole('heading', { level: 3, name: title }).closest('li') as HTMLElement;
}

describe('LiveClass', () => {
  it('draws a bar per exercise with the legend, and says it in words', async () => {
    const region = await renderClass(
      testSnapshot({
        attempts: [
          testAttempt('a1', 'ana', { status: 'submitted', finishedAt: ago(1) }),
          testAttempt('a2', 'bea'),
        ],
      }),
    );

    expect(text(region.querySelector('ul'))).toBe(
      'Sin empezar En curso Con fallos Superado Entregado',
    );
    const first = itemOf(/^1\. /);
    expect(text(first.querySelector('.sr-only'))).toBe('Sin empezar: 1, En curso: 1, Entregado: 1');
    const widths = [...first.querySelectorAll<HTMLElement>('[aria-hidden="true"] span')].map(
      (segment) => segment.style.width,
    );
    expect(widths.filter((width) => width !== '0%')).toHaveLength(3);
    expect(screen.queryByText('Más falla ahora:')).toBeNull();
  });

  it('gives the test that fails most, marked to explain to everybody when it is common', async () => {
    const failing = ['ana', 'bea', 'cai'].map((user, index) =>
      testAttempt(`a${index}`, user, { status: 'tests_failed' }),
    );
    await renderClass(
      testSnapshot({
        attempts: failing,
        events: failing.map((attempt) => e.run(attempt.id, ago(1), ['e1-t1'])),
      }),
    );

    const first = itemOf(/^1\. /);
    expect(text(first)).toContain('Para explicar a todos');
    expect(text(first)).toContain('Más falla ahora:');
    expect(text(first)).toContain('· 3 alumnos');
    expect(text(first)).not.toContain('(prueba oculta)');
  });

  it('says when the test that fails is hidden, without the mark for a single student', async () => {
    await renderClass(
      testSnapshot({
        students: STUDENTS.slice(0, 1),
        attempts: [testAttempt('a1', 'ana', { status: 'tests_failed' })],
        events: [e.run('a1', ago(1), ['e1-t5'])],
      }),
    );

    const first = itemOf(/^1\. /);
    expect(text(first)).toContain('(prueba oculta)');
    expect(text(first)).toContain('· 1 alumno');
    expect(text(first)).not.toContain('Para explicar a todos');
  });

  it('leaves the bars empty for a block without students', async () => {
    await renderClass(testSnapshot({ students: [] }));

    const widths = [
      ...itemOf(/^1\. /).querySelectorAll<HTMLElement>('[aria-hidden="true"] span'),
    ].map((segment) => segment.style.width);
    expect(new Set(widths)).toEqual(new Set(['0%']));
  });

  it('marks the language of a title that is not translated', async () => {
    const untranslated = BLOCK_EXERCISES.map((entry) => ({
      ...entry,
      exercise: { ...entry.exercise, translations: {} },
    }));
    await renderClass(testSnapshot({ exercises: untranslated }), 'ca');

    const heading = screen.getAllByRole('heading', { level: 3 })[0];
    expect(heading.getAttribute('lang')).toBe('es');
  });
});
