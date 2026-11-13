import { render, screen, within } from '@testing-library/angular';

import { ago, NOW, testInteraction } from '../live/live-testing';
import type { TimelineEntry } from './attempt-timeline';
import { AttemptTimelineList } from './attempt-timeline-list';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

const DAY_MS = 24 * 60 * 60_000;

const base = (id: string, at: number) => ({ id, at, gapMinutes: null });

const ENTRIES: TimelineEntry[] = [
  { ...base('start', ago(60) - DAY_MS), kind: 'start' },
  { ...base('passed', ago(50)), kind: 'run', passed: 3, total: 3, failing: [] },
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
];

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
  it('tells every kind of entry', async () => {
    const items = (await renderList()).map(text);

    expect(items).toEqual([
      expect.stringMatching(/Abrió el ejercicio$/),
      expect.stringMatching(/Ejecutó las pruebas: superó las 3$/),
      expect.stringMatching(
        /5 min sin actividad .*Ejecutó las pruebas: 1 de 3 superadas sum\(\[\]\) sum\(\[9\]\) \(prueba oculta\)$/,
      ),
      expect.stringMatching(
        /Preguntó al tutor ?Escribió: Dame la solución ?Respuesta del tutor: Probemos paso a paso\..*Pidió la solución.*El tutor ofreció ejecutar las pruebas, somethingNew$/,
      ),
      expect.stringMatching(
        /Pidió una pista · nivel 2 ?Respuesta del tutor: .*El tutor resaltó líneas del código$/,
      ),
      expect.stringMatching(
        /El tutor intervino por su cuenta ?Respuesta del tutor: .*Pidió la solución$/,
      ),
      expect.stringMatching(/Pidió una pista · nivel 3$/),
      expect.stringMatching(/El tutor prefirió no intervenir$/),
      expect.stringMatching(/El tutor intervino por su cuenta$/),
      expect.stringMatching(/Pegó 1 carácter$/),
      expect.stringMatching(/Pegó 120 caracteres$/),
      expect.stringMatching(/Salió de la ventana · 2 min$/),
      expect.stringMatching(/Salió de la ventana$/),
      expect.stringMatching(/Entregó el ejercicio$/),
    ]);
  });

  it('says the day when it changes, and the time of each entry', async () => {
    const items = await renderList();
    const times = items.map((item) => item.querySelector('time'));

    expect(text(times[0])).toMatch(/^\d{1,2} \S+, \d\d:\d\d$/);
    expect(text(times[1])).toMatch(/^\d{1,2} \S+, \d\d:\d\d$/);
    expect(text(times[2])).toMatch(/^\d\d:\d\d$/);
    expect(times[2]?.getAttribute('datetime')).toBe(new Date(ago(45)).toISOString());
  });

  it('hides the silences when asked, and slides in only what arrived live', async () => {
    const items = await renderList({ showGaps: false, liveSince: ago(10) });

    expect(screen.queryByText(/sin actividad/)).toBeNull();
    const sliding = items.filter((item) => item.querySelector('.animate-live-in'));
    expect(sliding.map(text)).toEqual([
      expect.stringMatching(/Salió de la ventana$/),
      expect.stringMatching(/Entregó el ejercicio$/),
    ]);
  });
});
