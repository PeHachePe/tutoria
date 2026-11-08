import { render, screen } from '@testing-library/angular';

import type { RunResult } from '../../data/attempt';
import { RunResults, testStates } from './run-results';

function text(element: Element | null): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

async function renderResults(result: RunResult, outdated = false): Promise<HTMLElement> {
  const { fixture } = await render(RunResults, {
    inputs: { result, functionName: 'suma', outdated },
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
    expect(text(element)).toContain('Error: suma([])');
    expect(text(element)).toContain('TypeError: x is undefined');
    expect(text(element)).toContain('Tiempo agotado: suma([1])');
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
      'No se encuentra la función suma. Comprueba que se llama exactamente así.',
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
});
