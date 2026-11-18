import { render, screen } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';

import { ago, MINUTE, NOW } from '../live/live-testing';
import type { AttemptNow, LastHelp, NowTest } from './attempt-now';
import { AttemptNowCard } from './attempt-now-card';
import type { AttemptSummary } from './attempt-summary';

const ZERO: AttemptSummary = {
  workMs: 0,
  runs: 0,
  hints: 0,
  hintLevel: null,
  questions: 0,
  pastedChars: 0,
  awayMs: 0,
};

const test = (index: number, runs: number, hidden = false): NowTest => ({
  id: `t${index}`,
  call: `sum([${index}])`,
  expected: String(index),
  hidden,
  runs,
});

const help = (overrides: Partial<LastHelp> = {}): LastHelp => ({
  entryId: 'entry-1',
  trigger: 'hint',
  level: 2,
  at: ago(5),
  question: null,
  text: 'Mira qué devuelve con una lista vacía.',
  ...overrides,
});

const state = (overrides: Partial<AttemptNow> = {}): AttemptNow => ({
  mode: 'now',
  lastRun: { passed: 3, total: 6 },
  tests: [test(1, 5), test(2, 1, true)],
  failingRunId: 'run-9',
  help: help(),
  ...overrides,
});

/** The words of an element as they read on screen: the pieces of a flex row apart. */
function text(element: Element | null): string {
  if (!element) return '';
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const words: string[] = [];
  while (walker.nextNode()) {
    const value = walker.currentNode.textContent?.replace(/\s+/g, ' ').trim();
    if (value) words.push(value);
  }
  return words.join(' ');
}

async function renderCard(now: AttemptNow, summary: Partial<AttemptSummary> = {}) {
  const chosen = vi.fn();
  await render(AttemptNowCard, {
    inputs: { now, summary: { ...ZERO, ...summary }, clock: NOW },
    on: { chosen },
  });
  return { chosen };
}

describe('AttemptNowCard', () => {
  it.each<[AttemptNow['mode'], string]>([
    ['now', 'Ahora'],
    ['left', 'Dónde lo dejó'],
    ['solved', 'Cómo lo resolvió'],
  ])('titles a region in %s «%s»', async (mode, title) => {
    await renderCard(state({ mode }));

    expect(screen.getByRole('region', { name: title })).toBeTruthy();
  });

  it('lists the failing tests with what they expect and since when', async () => {
    await renderCard(state());

    expect(screen.getByText('3 de 6 superadas en la última ejecución')).toBeTruthy();
    const items = screen.getAllByRole('listitem').map(text);
    expect(items).toEqual([
      'sum([1]) espera 1 · falla desde hace 5 ejecuciones',
      'sum([2]) espera 2 (prueba oculta) · falla desde la última ejecución',
    ]);
    expect(screen.getByText('sum([1])').classList).toContain('bg-error-container');
  });

  it('lists 4 tests and sends to the timeline for the rest', async () => {
    const tests = [1, 2, 3, 4, 5, 6].map((index) => test(index, 7 - index));
    const { chosen } = await renderCard(state({ tests }));

    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'y 2 más en la línea temporal' }));
    expect(chosen).toHaveBeenCalledWith('run-9');
  });

  it('does not send to the timeline when every failing test fits', async () => {
    await renderCard(state({ tests: [1, 2, 3, 4].map((index) => test(index, 1)) }));

    expect(screen.queryByRole('button', { name: /más en la línea temporal/ })).toBeNull();
  });

  it.each<[AttemptNow['mode'], string]>([
    ['now', 'Todavía no ha ejecutado las pruebas'],
    ['left', 'No llegó a ejecutar las pruebas'],
  ])('says in %s that there is no run yet', async (mode, message) => {
    await renderCard(state({ mode, lastRun: null, tests: [], failingRunId: null }));

    expect(screen.getByText(message)).toBeTruthy();
  });

  it.each<[AttemptNow['mode'], string]>([
    ['now', 'Supera todas las pruebas'],
    ['left', 'Supera todas las pruebas'],
    ['solved', 'Superó las 6 pruebas'],
  ])('says in %s that every test passes', async (mode, message) => {
    await renderCard(state({ mode, lastRun: { passed: 6, total: 6 }, tests: [] }));

    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('draws the share of the tests that passed, and an empty bar without tests', async () => {
    const { rerender } = await render(AttemptNowCard, {
      inputs: { now: state(), summary: ZERO, clock: NOW },
    });
    const bar = () => document.querySelector('.bg-success') as HTMLElement;
    expect(bar().style.width).toBe('50%');

    await rerender({
      partialUpdate: true,
      inputs: { now: state({ lastRun: { passed: 0, total: 0 } }) },
    });

    expect(bar().style.width).toBe('0%');
  });

  it('tells of a submitted attempt the tests that failed before passing', async () => {
    await renderCard(
      state({ mode: 'solved', lastRun: { passed: 6, total: 6 }, tests: [test(1, 3), test(2, 1)] }),
    );

    const list = screen.getByRole('list', { name: 'Fallaron antes de superarlas:' });
    expect(text(list)).toBe(
      'sum([1]) espera 1 · falló en 3 ejecuciones sum([2]) espera 2 · falló en 1 ejecución',
    );
    expect(screen.getByText('sum([1])').classList).toContain('bg-surface-container-high');
  });

  describe('the latest help', () => {
    it('says the level of a hint, how long ago, its text and goes to its entry', async () => {
      const { chosen } = await renderCard(state());

      const region = screen.getByRole('region', { name: 'Ahora' });
      expect(text(region)).toContain('lightbulb Pista de nivel 2 · Hace 5 min');
      expect(screen.getByText('Mira qué devuelve con una lista vacía.').classList).toContain(
        'line-clamp-2',
      );
      await userEvent.setup().click(screen.getByRole('button', { name: 'Ver entera' }));
      expect(chosen).toHaveBeenCalledWith('entry-1');
    });

    it('says what the student asked, for a question, right now', async () => {
      await renderCard(
        state({ help: help({ trigger: 'question', question: '¿Por qué?', at: NOW - 10_000 }) }),
      );

      expect(text(screen.getByRole('region', { name: 'Ahora' }))).toContain(
        'chat Respuesta a una pregunta · Ahora mismo',
      );
      expect(text(screen.getByText('Preguntó:').parentElement)).toBe('Preguntó: ¿Por qué?');
    });

    it('says an intervention on its own, with its date when it is old', async () => {
      await renderCard(state({ help: help({ trigger: 'proactive', at: ago(24 * 60) }) }));

      expect(text(screen.getByRole('region', { name: 'Ahora' }))).toMatch(
        /campaign Intervino por su cuenta · \d{1,2} \S+, \d\d:\d\d/,
      );
    });

    it('says when the answer was not recorded, without «Ver entera»', async () => {
      await renderCard(state({ help: help({ text: null }) }));

      expect(screen.getByText('No se guardó la respuesta.')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Ver entera' })).toBeNull();
    });

    it.each<[AttemptNow['mode'], string]>([
      ['now', 'No ha pedido ayuda al tutor'],
      ['left', 'No pidió ayuda al tutor'],
      ['solved', 'No pidió ayuda al tutor'],
    ])('says in %s that there was none', async (mode, message) => {
      await renderCard(state({ mode, help: null }));

      expect(screen.getByText(message)).toBeTruthy();
    });
  });

  describe('the summary', () => {
    it('says the work, runs and hints that are not zero', async () => {
      await renderCard(state(), { workMs: 27 * MINUTE, runs: 4, hints: 3, hintLevel: 3 });

      expect(text(screen.getByText(/de trabajo/).parentElement)).toBe(
        '27 min de trabajo · 4 ejecuciones · 3 pistas (nivel 3)',
      );
    });

    it('says one run and one hint in the singular, and leaves out less than a minute', async () => {
      await renderCard(state(), { workMs: 40_000, runs: 1, hints: 1, hintLevel: 1 });

      expect(text(screen.getByText('1 ejecución').parentElement)).toBe(
        '1 ejecución · 1 pista (nivel 1)',
      );
      expect(screen.queryByText(/de trabajo/)).toBeNull();
    });

    it('has no line with everything zero', async () => {
      await renderCard(state({ mode: 'left', lastRun: null, tests: [], help: null }));

      expect(screen.queryByText(/ejecuci|de trabajo|pista/)).toBeNull();
    });

    it('shows each chip only when it exists', async () => {
      await renderCard(state({ tests: [] }), {
        questions: 2,
        pastedChars: 320,
        awayMs: 8 * MINUTE,
      });

      expect(screen.getAllByRole('listitem').map(text)).toEqual([
        'chat 2 preguntas al tutor',
        'content_paste Pegó 320 caracteres',
        'visibility_off 8 min fuera de la ventana',
      ]);
    });

    it('says one question in the singular, and has no chips with nothing', async () => {
      await renderCard(state({ tests: [] }), { questions: 1 });

      expect(screen.getAllByRole('listitem').map(text)).toEqual(['chat 1 pregunta al tutor']);
    });

    it('has no chips with nothing to say', async () => {
      await renderCard(state({ tests: [] }));

      expect(screen.queryByRole('list')).toBeNull();
    });
  });
});
