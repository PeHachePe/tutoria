import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import type { RunResult } from '../../../data/attempt';
import { RunResults, testStates, type TutorShortcut } from './run-results';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

async function renderResults(result: RunResult, outdated = false): Promise<HTMLElement> {
  const { fixture } = await render(RunResults, {
    inputs: { result, functionName: 'sum', outdated },
  });
  return fixture.nativeElement as HTMLElement;
}

describe('RunResults', () => {
  it('celebrates when every test passes', async () => {
    const element = await renderResults({
      status: 'passed',
      results: [
        { testId: 't1', passed: true, timeout: false, input: [[1]], expected: 1, actual: 1 },
        { testId: 't2', passed: true, timeout: false },
      ],
    });

    expect(text(element)).toContain('Todas superadas (2 de 2)');
    expect(screen.getByText('Comprobación oculta 1: Superada')).toBeTruthy();
    expect(screen.queryByText(/versión anterior/)).toBeNull();
  });

  it('tells an error, a timeout and a multiline text apart, with a hint about endless loops', async () => {
    const element = await renderResults({
      status: 'tests_failed',
      results: [
        {
          testId: 't1',
          passed: false,
          timeout: false,
          input: [[]],
          expected: 0,
          error: 'TypeError: x is undefined',
        },
        { testId: 't2', passed: false, timeout: true, input: [[1]], expected: 1 },
        {
          testId: 't3',
          passed: false,
          timeout: false,
          input: [2],
          expected: '2 x 1 = 2\n2 x 2 = 4',
          actual: '2 x 1 = 2',
        },
        { testId: 't4', passed: false, timeout: true },
      ],
    });

    expect(text(element)).toContain('0 de 4 superadas');
    expect(text(element)).toContain('Error: sum([])');
    expect(text(element)).toContain('TypeError: x is undefined');
    expect(text(element)).toContain('Tiempo agotado: sum([1])');
    expect(element.querySelector('pre')?.textContent).toBe('2 x 1 = 2\n2 x 2 = 4');
    // It never started: the visible test before it ran out of time
    expect(screen.getByText('Comprobación oculta 1: Sin ejecutar')).toBeTruthy();
    expect(screen.getByText(/revisa si hay un bucle que no acaba nunca/)).toBeTruthy();
  });

  it('says when the results are from the code before the latest changes', async () => {
    await renderResults(
      { status: 'tests_failed', results: [{ testId: 't1', passed: false, timeout: false }] },
      true,
    );

    expect(screen.getByText(/estos resultados son de la versión anterior/)).toBeTruthy();
  });

  it('explains a missing function once, without the tests', async () => {
    const element = await renderResults({
      status: 'tests_failed',
      results: [{ testId: 't1', passed: false, timeout: false }],
      loadError: { kind: 'missing_function' },
    });

    expect(text(element)).toContain('El código no se ha podido ejecutar');
    expect(text(element)).toContain(
      'No se encuentra la función sum. Comprueba que se llama exactamente así.',
    );
    expect(element.querySelector('li')).toBeNull();
  });

  it('shows the error of code that does not load', async () => {
    const element = await renderResults({
      status: 'tests_failed',
      results: [],
      loadError: { kind: 'invalid_code', message: "SyntaxError: Unexpected token '}'" },
    });

    expect(text(element)).toContain('El código tiene un error');
    expect(element.querySelector('pre')?.textContent).toBe("SyntaxError: Unexpected token '}'");
  });
});

describe('RunResults folding', () => {
  const FAILED: RunResult = {
    status: 'tests_failed',
    results: [
      { testId: 't1', passed: false, timeout: false, input: [[1]], expected: 1, actual: 2 },
    ],
  };

  it('folds to the summary and unfolds again, as an accordion', async () => {
    const { fixture } = await render(RunResults, {
      inputs: { result: FAILED, functionName: 'sum' },
    });
    const toggle = screen.getByRole('button', { name: /Resultados/ });
    const body = document.getElementById(toggle.getAttribute('aria-controls') ?? '');

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(text(toggle)).toContain('0 de 1 superadas');
    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(body?.hidden).toBe(true);
    toggle.click();
    fixture.detectChanges();
    expect(body?.hidden).toBe(false);
  });

  it('unfolds by itself when a new run arrives', async () => {
    const { fixture } = await render(RunResults, {
      inputs: { result: FAILED, functionName: 'sum' },
    });
    const toggle = screen.getByRole('button', { name: /Resultados/ });
    toggle.click();
    fixture.detectChanges();

    fixture.componentRef.setInput('result', { ...FAILED });
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('testStates', () => {
  it('tells how each test ended, and which ones never started after one ran out of time', () => {
    expect(
      testStates([
        { testId: 't1', passed: true, timeout: false },
        { testId: 't2', passed: false, timeout: false, error: 'x' },
        { testId: 't3', passed: false, timeout: false },
        { testId: 't4', passed: false, timeout: true },
        { testId: 't5', passed: false, timeout: true },
      ]),
    ).toEqual(['passed', 'error', 'failed', 'timeout', 'notRun']);
  });

  it('makes the first failing test or the hidden checks the tutor points at stand out (2.5e)', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const result: RunResult = {
      status: 'tests_failed',
      results: [
        { testId: 't1', passed: true, timeout: false, input: [[1]], expected: 1, actual: 1 },
        { testId: 't2', passed: false, timeout: false, input: [[2]], expected: 2, actual: 0 },
        { testId: 't3', passed: false, timeout: false },
      ],
    };
    const { fixture, rerender } = await render(RunResults, {
      inputs: { result, functionName: 'sum', pointer: { target: 'failingTest', id: 'p1' } },
    });
    const element = fixture.nativeElement as HTMLElement;

    expect(text(element.querySelector('[data-pointed]'))).toContain('sum([2])');
    expect(scrollIntoView).toHaveBeenCalled();

    await rerender({
      inputs: { pointer: { target: 'hiddenTests', id: 'p2' } },
      partialUpdate: true,
    });
    expect(text(element.querySelector('[data-pointed]'))).toContain('Comprobaciones ocultas');

    await rerender({
      inputs: { pointer: { target: 'example', example: 1, id: 'p3' } },
      partialUpdate: true,
    });
    expect(element.querySelector('[data-pointed]')).toBeNull();
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });

  it('opens again when the tutor points at it', async () => {
    const result: RunResult = {
      status: 'passed',
      results: [{ testId: 't1', passed: true, timeout: false }],
    };
    const { rerender } = await render(RunResults, { inputs: { result, functionName: 'sum' } });
    const toggle = screen.getByRole('button', { expanded: true });
    toggle.click();
    await rerender({
      inputs: { pointer: { target: 'hiddenTests', id: 'p1' } },
      partialUpdate: true,
    });
    expect(screen.getByRole('button', { expanded: true })).toBeTruthy();
  });
});

describe('RunResults «Pregúntale al tutor» (6.2d)', () => {
  /** Each way a visible example ends, after a hidden check, and one that never started. */
  const MIXED: RunResult = {
    status: 'tests_failed',
    results: [
      { testId: 't1', passed: true, timeout: false, input: [[1]], expected: 1, actual: 1 },
      { testId: 'h1', passed: false, timeout: false },
      { testId: 't2', passed: false, timeout: false, input: [[1, 2]], expected: 3, actual: 1 },
      { testId: 't3', passed: false, timeout: false, input: [[]], expected: 0, error: 'Boom' },
      { testId: 't4', passed: false, timeout: true, input: [[9]], expected: 9 },
      { testId: 't5', passed: false, timeout: true, input: [[8]], expected: 8 },
    ],
  };

  async function renderShortcut(
    tutorShortcut: TutorShortcut,
    { result = MIXED, outdated = false }: { result?: RunResult; outdated?: boolean } = {},
  ) {
    const askTutor = vi.fn<(question: string) => void>();
    await render(RunResults, {
      inputs: { result, functionName: 'sum', outdated, tutorShortcut },
      on: { askTutor },
    });
    const shortcuts = () => screen.queryAllByRole('button', { name: /^Pregúntale al tutor/ });
    return { askTutor, shortcuts };
  }

  it('is beside each visible example that ran and failed, named by its row', async () => {
    const { shortcuts } = await renderShortcut('enabled');

    // Not the one passed, the hidden check or the one that never started
    expect(shortcuts().map((button) => button.getAttribute('aria-label'))).toEqual([
      'Pregúntale al tutor por qué falla el ejemplo 2',
      'Pregúntale al tutor por qué falla el ejemplo 3',
      'Pregúntale al tutor por qué falla el ejemplo 4',
    ]);
  });

  it('sends the question of its example, with what the row says', async () => {
    const { askTutor, shortcuts } = await renderShortcut('enabled');
    const user = userEvent.setup();

    for (const button of shortcuts()) await user.click(button);

    expect(askTutor.mock.calls.map(([question]) => question)).toEqual([
      '¿Por qué falla `sum([1, 2])`? Devuelve `1` y se espera `3`.',
      '¿Por qué falla `sum([])`? Lanza el error «Boom» y se espera `0`.',
      '¿Por qué `sum([9])` no termina a tiempo? Se espera `9`.',
    ]);
  });

  it('stays in reach while the tutor answers, but sends nothing', async () => {
    const { askTutor, shortcuts } = await renderShortcut('disabled');
    const [first] = shortcuts();

    expect(first.getAttribute('aria-disabled')).toBe('true');
    first.focus();
    expect(document.activeElement).toBe(first);
    await userEvent.setup().click(first);
    expect(askTutor).not.toHaveBeenCalled();
  });

  it('is not there when hidden, as with the attempt submitted', async () => {
    expect((await renderShortcut('hidden')).shortcuts()).toEqual([]);
  });

  it('is not there with results of an earlier version of the code', async () => {
    expect((await renderShortcut('enabled', { outdated: true })).shortcuts()).toEqual([]);
  });
});
