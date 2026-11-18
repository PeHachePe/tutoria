import { render, screen, within } from '@testing-library/angular';

import { ago, NOW, testInteraction } from '../live/live-testing';
import type { TimelineEntry } from './attempt-timeline';
import { AttemptTimelineList } from './attempt-timeline-list';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

const DAY_MS = 24 * 60 * 60_000;

const base = (id: string, at: number) => ({ id, at, gapMinutes: null, eventIds: [id] });

/** The latest first, as the timeline gives them. */
const ENTRIES: TimelineEntry[] = (
  [
    { ...base('start', ago(60) - DAY_MS), kind: 'start' },
    {
      ...base('passed', ago(50)),
      kind: 'run',
      passed: 3,
      total: 3,
      failing: [],
      count: 1,
      from: ago(50),
    },
    {
      ...base('failed', ago(45)),
      gapMinutes: 5,
      kind: 'run',
      passed: 1,
      total: 3,
      failing: [
        { id: 't1', call: 'sum([])', hidden: false },
        { id: 't3', call: 'sum([9])', hidden: true },
      ],
      count: 1,
      from: ago(45),
    },
    {
      ...base('grouped', ago(43)),
      kind: 'run',
      passed: 1,
      total: 3,
      failing: [{ id: 't1', call: 'sum([])', hidden: false }],
      count: 4,
      from: ago(44),
    },
    {
      ...base('groupedPassed', ago(41)),
      kind: 'run',
      passed: 3,
      total: 3,
      failing: [],
      count: 2,
      from: ago(42),
    },
    {
      ...base('question', ago(40)),
      kind: 'tutor',
      interaction: testInteraction('a1', ago(40), {
        trigger: 'question',
        studentMessage: 'Dame la solución',
        transcript: 'Probemos paso a paso.',
        elusion: true,
        actions: [
          { name: 'runTests', arguments: {} },
          { name: 'somethingNew', arguments: {} },
        ],
      }),
    },
    {
      ...base('hint', ago(35)),
      kind: 'tutor',
      interaction: testInteraction('a1', ago(35), {
        hintLevel: 2,
        actions: [{ name: 'highlightLines', arguments: {} }],
      }),
    },
    {
      ...base('proactive', ago(30)),
      kind: 'tutor',
      interaction: testInteraction('a1', ago(30), { trigger: 'proactive', elusion: true }),
    },
    { ...base('hintOnly', ago(25)), kind: 'hint', level: 3 },
    { ...base('silent', ago(20)), kind: 'proactive', silent: true },
    { ...base('proactiveOnly', ago(18)), kind: 'proactive', silent: false },
    { ...base('paste1', ago(15)), kind: 'paste', length: 1 },
    { ...base('paste', ago(14)), kind: 'paste', length: 120 },
    { ...base('away', ago(12)), kind: 'away', ms: 90_000 },
    { ...base('awayOpen', ago(5)), kind: 'away', ms: null },
    { ...base('submit', NOW), kind: 'submit' },
  ] satisfies TimelineEntry[]
).reverse();

async function renderList(inputs: Partial<{ showGaps: boolean; liveSince: number }> = {}) {
  await render(AttemptTimelineList, {
    inputs: { entries: ENTRIES, label: 'Línea temporal', ...inputs },
  });
  const list = screen.getByRole('list', { name: 'Línea temporal' });
  return within(list)
    .getAllByRole('listitem')
    .filter((item) => item.parentElement === list);
}

describe('AttemptTimelineList', () => {
  it('tells every kind of entry, the latest first', async () => {
    const items = (await renderList()).map(text);

    expect(items).toEqual([
      expect.stringMatching(/Entregó el ejercicio$/),
      expect.stringMatching(/Salió de la ventana$/),
      expect.stringMatching(/Salió de la ventana · 2 min$/),
      expect.stringMatching(/Pegó 120 caracteres$/),
      expect.stringMatching(/Pegó 1 carácter$/),
      expect.stringMatching(/El tutor intervino por su cuenta$/),
      expect.stringMatching(/El tutor prefirió no intervenir$/),
      expect.stringMatching(/Pidió una pista · nivel 3$/),
      expect.stringMatching(
        /El tutor intervino por su cuenta ?Respuesta del tutor: .*Pidió la solución$/,
      ),
      expect.stringMatching(
        /Pidió una pista · nivel 2 ?Respuesta del tutor: .*El tutor resaltó líneas del código$/,
      ),
      expect.stringMatching(
        /Preguntó al tutor ?Escribió: Dame la solución ?Respuesta del tutor: Probemos paso a paso\..*Pidió la solución.*El tutor ofreció ejecutar las pruebas, somethingNew$/,
      ),
      expect.stringMatching(/Ejecutó 2 veces · superó las 3$/),
      expect.stringMatching(/Ejecutó 4 veces · 1 de 3, fallan las mismas sum\(\[\]\)$/),
      expect.stringMatching(
        /Ejecutó las pruebas: 1 de 3 superadas sum\(\[\]\) sum\(\[9\]\) \(prueba oculta\) ?5 min sin actividad$/,
      ),
      expect.stringMatching(/Superó todas las pruebas$/),
      expect.stringMatching(/Abrió el ejercicio$/),
    ]);
  });

  it('is a list in reverse order', async () => {
    await renderList();

    expect(screen.getByRole('list', { name: 'Línea temporal' }).hasAttribute('reversed')).toBe(
      true,
    );
  });

  it('says the day when it changes from the entry under it, and the time of each entry', async () => {
    const items = await renderList();
    const times = items.map((item) => item.querySelector('time'));

    expect(text(times.at(-1) ?? null)).toMatch(/^\d{1,2} \S+, \d\d:\d\d$/);
    expect(text(times.at(-2) ?? null)).toMatch(/^\d{1,2} \S+, \d\d:\d\d$/);
    expect(text(times.at(-3) ?? null)).toMatch(/^\d\d:\d\d$/);
    expect(times.at(-3)?.getAttribute('datetime')).toBe(new Date(ago(45)).toISOString());
    expect(text(times[0])).toMatch(/^\d\d:\d\d$/);
  });

  it('says the time of a group once when its runs were in the same minute', async () => {
    const sameMinute: TimelineEntry = {
      ...base('quick', ago(10) + 40_000),
      kind: 'run',
      passed: 1,
      total: 3,
      failing: [],
      count: 3,
      from: ago(10),
    };
    await render(AttemptTimelineList, { inputs: { entries: [sameMinute], label: 'Línea' } });

    expect(screen.getByRole('listitem').querySelectorAll('time')).toHaveLength(1);
  });

  it('says when the first and the latest run of a group ran', async () => {
    const items = await renderList();
    const group = items.find((item) => text(item).includes('Ejecutó 4 veces')) as HTMLElement;

    const times = [...group.querySelectorAll('time')];
    expect(times.map((time) => time.getAttribute('datetime'))).toEqual([
      new Date(ago(44)).toISOString(),
      new Date(ago(43)).toISOString(),
    ]);
  });

  it('hides the silences when asked, and slides in only what arrived live', async () => {
    const items = await renderList({ showGaps: false, liveSince: ago(10) });

    expect(screen.queryByText(/sin actividad/)).toBeNull();
    const sliding = items.filter((item) => item.querySelector('.animate-live-in'));
    expect(sliding.map(text)).toEqual([
      expect.stringMatching(/Entregó el ejercicio$/),
      expect.stringMatching(/Salió de la ventana$/),
    ]);
  });

  describe('reveal', () => {
    afterEach(() => {
      delete (window as Partial<Window>).matchMedia;
    });

    const rowOf = (items: HTMLElement[], id: string) =>
      items.find((item) => item.dataset['entry'] === id) as HTMLElement;

    async function renderRevealing(reduce = false) {
      const view = await render(AttemptTimelineList, {
        inputs: { entries: ENTRIES, label: 'Línea temporal' },
      });
      const list = screen.getByRole('list', { name: 'Línea temporal' });
      const items = within(list)
        .getAllByRole('listitem')
        .filter((item) => item.parentElement === list);
      // jsdom has neither matchMedia nor the Web Animations API
      window.matchMedia = vi.fn(() => ({ matches: reduce }) as MediaQueryList);
      const scrolled = vi.fn();
      const animated = vi.fn();
      for (const item of items) {
        item.scrollIntoView = scrolled;
        item.animate = animated;
      }
      return { component: view.fixture.componentInstance, items, scrolled, animated };
    }

    it('takes the entry into view with the focus and highlights it', async () => {
      const { component, items, scrolled, animated } = await renderRevealing();

      component.reveal('paste');

      expect(document.activeElement).toBe(rowOf(items, 'paste'));
      expect(scrolled).toHaveBeenCalledWith({ block: 'nearest' });
      expect(animated).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ duration: 1200 }),
      );
    });

    it('does not highlight for whoever asks for less motion', async () => {
      const { component, items, animated } = await renderRevealing(true);

      component.reveal('paste');

      expect(document.activeElement).toBe(rowOf(items, 'paste'));
      expect(animated).not.toHaveBeenCalled();
    });

    it('does not highlight where the browser cannot animate', async () => {
      const { component, items } = await renderRevealing();
      const row = rowOf(items, 'paste');
      Object.defineProperty(row, 'animate', { configurable: true, value: undefined });

      component.reveal('paste');

      expect(document.activeElement).toBe(row);
    });

    it('does nothing with an unknown entry', async () => {
      const { component, scrolled } = await renderRevealing();

      component.reveal('unknown');

      expect(scrolled).not.toHaveBeenCalled();
    });
  });
});
