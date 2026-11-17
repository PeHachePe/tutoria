import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { render, screen, within } from '@testing-library/angular';

import type { ActivityMinute } from './activity-by-minute';
import { LiveRhythm } from './live-rhythm';
import { MINUTE, NOW } from './live-testing';
import type { RhythmReading } from './rhythm-reading';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/** Minutes with these runs and hints, the current one last. */
function minutes(...counts: [runs: number, hints: number][]): ActivityMinute[] {
  return counts.map(([runs, hints], index) => ({
    start: NOW - (counts.length - 1 - index) * MINUTE,
    runs,
    hints,
  }));
}

/** 20 complete minutes, the 10 before with `before` each and the last 10 with `now`, and the current one. */
function series(now: [number, number], before: [number, number]): ActivityMinute[] {
  return minutes(
    ...Array.from({ length: 10 }, () => before),
    ...Array.from({ length: 10 }, () => now),
    [5, 5],
  );
}

async function renderRhythm(activity: ActivityMinute[], reading: RhythmReading | null = 'steady') {
  const view = await render(LiveRhythm, { inputs: { minutes: activity, reading } });
  return { view, region: screen.getByRole('region', { name: 'Ritmo de la clase' }) };
}

describe('LiveRhythm', () => {
  it.each<[RhythmReading, string]>([
    ['steady', 'La clase trabaja a buen ritmo'],
    ['stuck', 'Las pistas suben y las ejecuciones bajan: la clase se está atascando'],
    ['slowing', 'La actividad ha bajado: la clase ha parado o está terminando'],
    ['starting', 'La clase acaba de empezar'],
  ])('reads the pace as %s', async (reading, sentence) => {
    const { region } = await renderRhythm(minutes([1, 0], [1, 0]), reading);

    expect(text(region)).toContain(sentence);
  });

  it('marks a class getting stuck with the warning colour and its icon', async () => {
    const { region } = await renderRhythm(minutes([1, 0], [1, 0]), 'stuck');

    const warning = region.querySelector('.bg-warning-container');
    expect(text(warning)).toMatch(/^trending_down ?Las pistas suben/);
  });

  it('compares the last 10 complete minutes with the 10 before, measure by measure', async () => {
    const { region } = await renderRhythm(series([2, 1], [1, 0]));

    expect(text(region)).toContain('Todo el grupo · últimos 10 min, frente a los anteriores');
    expect(text(region)).toContain('20 ejecuciones (antes: 10)');
    expect(text(region)).toContain('10 pistas (antes: 0)');
  });

  it('says one of each in singular, and nothing before when the class has just started', async () => {
    const { region } = await renderRhythm(minutes([1, 0], [0, 1], [0, 0]), 'starting');

    expect(text(region)).toContain('1 ejecución');
    expect(text(region)).toContain('1 pista');
    expect(text(region)).not.toContain('antes');
  });

  it('draws a sparkline per measure, each on its own scale, ending at the last complete minute', async () => {
    const { region } = await renderRhythm(minutes([2, 0], [4, 1], [1, 1], [9, 9]));

    const [runs, hints] = [...region.querySelectorAll('polyline')].map((line) =>
      line.getAttribute('points'),
    );
    expect(runs).toBe('0,22 80,4 160,31');
    expect(hints).toBe('0,40 80,4 160,4');
  });

  it('makes the last point of each line beat, still for whoever asks for less motion', async () => {
    const { region } = await renderRhythm(minutes([0, 0], [4, 2], [0, 0]));

    const points = [...region.querySelectorAll<HTMLElement>('.animate-ping')];
    expect(points).toHaveLength(2);
    expect(points.every((point) => point.classList.contains('motion-reduce:animate-none'))).toBe(
      true,
    );
    expect(points.map((point) => point.parentElement?.style.top)).toEqual(['10%', '10%']);
  });

  it('says the counts of each complete minute on hover, in both sparklines', async () => {
    const { view } = await renderRhythm(minutes([3, 1], [0, 2], [7, 7]));

    const tooltips = view.fixture.debugElement
      .queryAll(By.directive(MatTooltip))
      .map((node) => node.injector.get(MatTooltip).message);
    expect(tooltips).toEqual([
      'Hace 2 min · ejecuciones: 3 · pistas: 1',
      'Hace 1 min · ejecuciones: 0 · pistas: 2',
      'Hace 2 min · ejecuciones: 3 · pistas: 1',
      'Hace 1 min · ejecuciones: 0 · pistas: 2',
    ]);
  });

  it('draws flat lines when only the current minute moved', async () => {
    const { region } = await renderRhythm(minutes([0, 0], [0, 0], [2, 0]), 'starting');

    expect(region.querySelector('polyline')?.getAttribute('points')).toBe('0,40 160,40');
  });

  it('draws no line yet when the class only has its current minute', async () => {
    const { region } = await renderRhythm(minutes([3, 1]), 'starting');

    expect(region.querySelector('polyline')?.getAttribute('points')).toBe('');
  });

  it('says so, without any reading, when nobody did anything', async () => {
    const { region } = await renderRhythm(minutes([0, 0], [0, 0]), null);

    expect(region.querySelector('svg')).toBeNull();
    expect(text(region)).toBe(
      'Ritmo de la clase Nadie ha ejecutado las pruebas ni pedido pistas en este rato.',
    );
    expect(within(region).queryByText(/antes/)).toBeNull();
  });
});
