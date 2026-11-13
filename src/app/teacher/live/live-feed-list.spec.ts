import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';

import { APP_PATHS } from '../../core/app-paths';
import type { FeedEntry } from './live-feed';
import { LiveFeedList } from './live-feed-list';
import { ago, NOW, STUDENTS } from './live-testing';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

const base = { student: STUDENTS[0], attemptId: 'a1', position: 1, practice: false };

const ENTRIES: FeedEntry[] = [
  { ...base, id: 'e1', kind: 'submitted', at: NOW - 20_000 },
  { ...base, id: 'e2', kind: 'recovered', failures: 4, at: ago(2) },
  { ...base, id: 'e3', kind: 'all_passed', at: ago(3), student: STUDENTS[1], attemptId: 'a2' },
  { ...base, id: 'e4', kind: 'started', at: ago(4), position: 2 },
  { ...base, id: 'e5', kind: 'started', at: ago(5), practice: true },
];

async function renderFeed(feed: FeedEntry[]) {
  await render(LiveFeedList, { inputs: { feed, now: NOW }, providers: [provideRouter([])] });
  return screen.getByRole('region', { name: 'Lo último' });
}

describe('LiveFeedList', () => {
  it('tells what just happened, how long ago, with a link to each attempt', async () => {
    const region = await renderFeed(ENTRIES);

    const items = within(region).getAllByRole('listitem');
    expect(items.map((item) => text(item.querySelector('p')))).toEqual([
      'Ana entregó el ejercicio 1',
      'Ana superó una prueba del ejercicio 1 que había fallado 4 veces seguidas',
      'Bea superó todas las pruebas del ejercicio 1',
      'Ana empezó el ejercicio 2',
      'Ana empezó a repetir el ejercicio 1',
    ]);
    expect(items.map((item) => text(item.lastElementChild))).toEqual([
      'Ahora',
      'Hace 2 min',
      'Hace 3 min',
      'Hace 4 min',
      'Hace 5 min',
    ]);
    expect(within(region).getAllByRole('link', { name: 'Bea' })[0].getAttribute('href')).toBe(
      APP_PATHS.teacher.attempt('a2'),
    );
  });

  it('says what will show up while nothing has happened', async () => {
    const region = await renderFeed([]);

    expect(within(region).queryByRole('list')).toBeNull();
    expect(text(region)).toContain(
      'Cuando alguien supere pruebas, entregue o pase a otro ejercicio, saldrá aquí.',
    );
  });
});
