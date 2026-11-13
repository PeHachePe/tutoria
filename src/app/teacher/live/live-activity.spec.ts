import { render, screen, within } from '@testing-library/angular';

import type { ActivityMinute } from './activity-by-minute';
import { LiveActivity } from './live-activity';
import { MINUTE, NOW } from './live-testing';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/** Three minutes, the current one last, with these runs and hints. */
function minutes(...counts: [runs: number, hints: number][]): ActivityMinute[] {
  return counts.map(([runs, hints], index) => ({
    start: NOW - (counts.length - 1 - index) * MINUTE,
    runs,
    hints,
  }));
}

async function renderActivity(activity: ActivityMinute[]) {
  await render(LiveActivity, { inputs: { minutes: activity } });
  return screen.getByRole('region', { name: 'Actividad' });
}

describe('LiveActivity', () => {
  it('draws the runs and the hints by minute, with their totals and the busiest minute in words', async () => {
    const region = await renderActivity(minutes([2, 0], [4, 1], [1, 1]));

    expect(text(region)).toContain('Últimos 30 min');
    expect(within(region).getAllByRole('listitem').map(text)).toEqual([
      '7 ejecuciones',
      '2 pistas',
    ]);
    expect(text(region.querySelector('.sr-only'))).toBe(
      'El minuto con más actividad fue hace 1 min.',
    );
    const [runs, hints] = [...region.querySelectorAll('polyline')].map((line) =>
      line.getAttribute('points'),
    );
    expect(runs).toBe('0,53 150,6 300,76.5');
    expect(hints).toBe('0,100 150,76.5 300,76.5');
    expect(region.querySelector('polygon')?.getAttribute('points')).toBe(
      '0,100 0,53 150,6 300,76.5 300,100',
    );
  });

  it('says one of each in singular, and takes the earlier minute on a tie', async () => {
    const region = await renderActivity(minutes([0, 0], [1, 0], [0, 1]));

    expect(within(region).getAllByRole('listitem').map(text)).toEqual(['1 ejecución', '1 pista']);
    expect(text(region.querySelector('.sr-only'))).toBe(
      'El minuto con más actividad fue hace 1 min.',
    );
  });

  it('names the current minute when it is the busiest', async () => {
    const region = await renderActivity(minutes([1, 0], [3, 2]));

    expect(text(region.querySelector('.sr-only'))).toBe(
      'El minuto con más actividad es el actual.',
    );
  });

  it('says so instead of a flat chart when nobody did anything', async () => {
    const region = await renderActivity(minutes([0, 0], [0, 0]));

    expect(region.querySelector('svg')).toBeNull();
    expect(text(region)).toContain('Nadie ha ejecutado las pruebas ni pedido pistas en este rato.');
  });
});
