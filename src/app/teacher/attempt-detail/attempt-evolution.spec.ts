import { render, screen, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';

import { testEvents as e } from '../../data/process-event-testing';
import { ago, MINUTE } from '../live/live-testing';
import { LOCALE_ID } from '@angular/core';
import { AttemptEvolution } from './attempt-evolution';
import { attemptRuns } from './attempt-runs';

const runs = [
  e.run('a1', ago(30), ['t1', 't2', 't3'], 6),
  e.run('a1', ago(28), ['t1', 't2', 't3'], 6),
  e.hint('a1', ago(26), 2),
  e.paste('a1', ago(24), 310),
  e.run('a1', ago(22), ['t1'], 6),
  e.hint('a1', ago(20), 3),
  e.run('a1', ago(18), [], 6),
];

async function renderChart(
  events = runs,
  { liveSince, locale }: { liveSince?: number; locale?: string } = {},
) {
  const chosen = vi.fn();
  const view = await render(AttemptEvolution, {
    inputs: { runs: attemptRuns(events), ...(liveSince === undefined ? {} : { liveSince }) },
    on: { chosen },
    providers: locale ? [{ provide: LOCALE_ID, useValue: locale }] : [],
  });
  const list = screen.getByRole('list', { name: 'Ejecuciones, pistas y pegados, en orden' });
  return { ...view, chosen, buttons: within(list).getAllByRole('button') };
}

const bars = () => screen.getAllByTestId('run-bar');

describe('AttemptEvolution', () => {
  it('is a region named by its heading', async () => {
    await renderChart();

    expect(screen.getByRole('region', { name: 'Evolución' })).toBeTruthy();
  });

  it('draws a column per run, as tall as the tests it passed', async () => {
    const { buttons } = await renderChart();

    expect(bars().map((bar) => bar.style.height)).toEqual([
      '50%',
      '50%',
      '83.33333333333334%',
      '100%',
    ]);
    expect(buttons.map((button) => button.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      '3/6',
      '3/6',
      'lightbulb2',
      'content_paste',
      '5/6',
      'lightbulb3',
      'check6/6',
    ]);
  });

  it('gives the run that passes everything its tone, and the rest another', async () => {
    await renderChart();

    expect(bars().map((bar) => bar.classList.contains('bg-chart-pass'))).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(bars()[0].classList).toContain('bg-primary');
  });

  it('names each column and mark, and says which event was chosen', async () => {
    const { buttons, chosen } = await renderChart();

    expect(buttons[0].getAttribute('aria-label')).toMatch(
      /^Ejecución de las \d\d:\d\d: 3\/6 superadas\. Ir a la línea temporal$/,
    );
    expect(buttons[2].getAttribute('aria-label')).toMatch(
      /^Pista de nivel 2 a las \d\d:\d\d\. Ir a la línea temporal$/,
    );
    expect(buttons[3].getAttribute('aria-label')).toMatch(
      /^Pegó 310 caracteres a las \d\d:\d\d\. Ir a la línea temporal$/,
    );

    await userEvent.setup().click(buttons[4]);
    expect(chosen).toHaveBeenCalledWith(runs[4].id);
  });

  it('says the chart in text, with the hints and pastes', async () => {
    await renderChart();

    expect(
      screen.getByText('Ejecuciones: 3 de 6, 3 de 6, 5 de 6 y 6 de 6; 2 pistas y 1 pegado'),
    ).toBeTruthy();
  });

  it('says the chart in text without hints or pastes, in the language of the interface', async () => {
    await renderChart([e.run('a1', ago(10), ['t1'], 2), e.run('a1', ago(5), [], 2)], {
      locale: 'en',
    });

    expect(screen.getByText('Ejecuciones: 1 de 2 and 2 de 2')).toBeTruthy();
  });

  it('says one hint and one paste in the singular, and several pastes in the plural', async () => {
    await renderChart([
      e.run('a1', ago(10)),
      e.hint('a1', ago(9)),
      e.paste('a1', ago(8)),
      e.paste('a1', ago(7)),
    ]);

    expect(screen.getByText(/; 1 pista y 2 pegados$/)).toBeTruthy();
  });

  it('shows in the legend only what there is', async () => {
    await renderChart([e.run('a1', ago(10), ['t1'], 6)]);

    expect(screen.getByText('Pruebas superadas, de 6')).toBeTruthy();
    expect(screen.queryByText('Todas superadas')).toBeNull();
    expect(screen.queryByText('Pista, con su nivel')).toBeNull();
    expect(screen.queryByText('Pegado')).toBeNull();
  });

  it('shows hints and pastes in the legend when there are', async () => {
    await renderChart();

    expect(screen.getByText('Todas superadas')).toBeTruthy();
    expect(screen.getByText('Pista, con su nivel')).toBeTruthy();
    expect(screen.getByText('Pegado')).toBeTruthy();
  });

  it('grows only the columns that arrived live', async () => {
    await renderChart(runs, { liveSince: ago(20) });

    const growing = bars().map((bar) => bar.classList.contains('animate-column-in'));
    expect(growing).toEqual([false, false, false, true]);
    expect(bars()[3].classList).toContain('motion-reduce:animate-none');
  });

  it('draws nothing without runs', async () => {
    await render(AttemptEvolution, { inputs: { runs: attemptRuns([]) } });

    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.getByText('Pruebas superadas, de 0')).toBeTruthy();
  });

  it('draws an empty column for an exercise without tests', async () => {
    await renderChart([e.run('a1', ago(10), [], 0)]);

    expect(bars()[0].style.height).toBe('0%');
  });

  it('keeps the zone at the latest when a column arrives', async () => {
    const { fixture, rerender } = await renderChart([e.run('a1', ago(10))]);
    const zone = fixture.nativeElement.querySelector('.overflow-x-auto') as HTMLElement;
    // jsdom lays nothing out: the zone measures what a wide chart would, and keeps what it is given
    let scrollLeft = 0;
    Object.defineProperty(zone, 'scrollWidth', { configurable: true, value: 640 });
    Object.defineProperty(zone, 'scrollLeft', {
      configurable: true,
      get: () => scrollLeft,
      set: (value: number) => (scrollLeft = value),
    });

    await rerender({
      partialUpdate: true,
      inputs: { runs: attemptRuns([e.run('a1', ago(10)), e.run('a1', ago(10) + MINUTE)]) },
    });
    await fixture.whenStable();

    expect(zone.scrollLeft).toBe(640);
  });
});
