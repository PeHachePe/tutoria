import { EditorView, runScopeHandlers } from '@codemirror/view';
import { type ComponentFixture, DeferBlockBehavior, DeferBlockState } from '@angular/core/testing';
import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import type { RunResult } from '../../data/attempt';
import { CodeRunnerService } from '../../data/code-runner-service';
import { DataError } from '../../data/data-error';
import { type CheckRun, type CheckTarget, sameCheck, SolutionCheck } from './solution-check';

const TARGET: CheckTarget = {
  functionName: 'sum',
  tests: [
    { input: [[1, 2]], expectedOutput: 3, isHidden: false },
    { input: [[]], expectedOutput: 0, isHidden: true },
  ],
};

const PASSED: RunResult = {
  status: 'passed',
  results: [
    { testId: 'test-1', passed: true, timeout: false, input: [[1, 2]], expected: 3, actual: 3 },
    { testId: 'test-2', passed: true, timeout: false, input: [[]], expected: 0, actual: 0 },
  ],
};

async function renderCheck(target: CheckTarget | null = TARGET) {
  const check = vi.fn<CodeRunnerService['check']>().mockResolvedValue(PASSED);
  const targetSignal = signal(target);
  const lastRun = signal<CheckRun | null>(null);
  const result = await render(
    `<app-solution-check [target]="target()" skeleton="function sum(values) {\n}" [(lastRun)]="lastRun" />`,
    {
      imports: [SolutionCheck],
      componentProperties: { target: targetSignal, lastRun },
      providers: [{ provide: CodeRunnerService, useValue: { check } }],
      // The editor is deferred: each test renders it when the panel opens
      deferBlockBehavior: DeferBlockBehavior.Manual,
    },
  );
  fixture = result.fixture;
  return { ...result, check, target: targetSignal, lastRun };
}

let fixture: ComponentFixture<unknown>;

async function open(): Promise<EditorView> {
  await userEvent.click(screen.getByRole('button', { name: 'Probar mi solución' }));
  fixture.detectChanges();
  const [block] = await fixture.getDeferBlocks();
  await block.render(DeferBlockState.Complete);
  const textbox = screen.getByRole('textbox', { name: 'Tu solución' });
  const view = EditorView.findFromDOM(textbox);
  if (!view) throw new Error('CodeMirror view not found');
  return view;
}

describe('SolutionCheck', () => {
  it('opens on the skeleton and runs the solution against the tests, saying how it went', async () => {
    const { check, lastRun } = await renderCheck();

    const button = screen.getByRole('button', { name: 'Probar mi solución' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    const view = await open();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(view.state.doc.toString()).toBe('function sum(values) {\n}');

    await userEvent.click(screen.getByRole('button', { name: 'Ejecutar las pruebas' }));
    fixture.detectChanges();

    expect(check).toHaveBeenCalledExactlyOnceWith({ ...TARGET, code: 'function sum(values) {\n}' });
    expect(lastRun()?.result).toBe(PASSED);
    expect(screen.getByRole('status').textContent).toBe('2 de 2 pruebas superadas');
    expect(screen.getByText(/Todas superadas/)).toBeTruthy();
  });

  it('runs with Ctrl + Enter from the editor, with the code as it is', async () => {
    const { check } = await renderCheck();
    const view = await open();

    view.dispatch({ changes: { from: 23, insert: ' return 3;' }, userEvent: 'input.type' });
    runScopeHandlers(view, new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }), 'editor');

    expect(check.mock.calls.at(-1)?.[0].code).toBe('function sum(values) {\n return 3;}');
  });

  it('says that the results are of before when the solution or the tests change', async () => {
    const { target } = await renderCheck();
    const view = await open();
    await userEvent.click(screen.getByRole('button', { name: 'Ejecutar las pruebas' }));

    view.dispatch({ changes: { from: 0, insert: '// ' }, userEvent: 'input.type' });
    fixture.detectChanges();
    expect(screen.getByText(/estos resultados son de antes/)).toBeTruthy();

    view.dispatch({ changes: { from: 0, to: 3 }, userEvent: 'delete' });
    fixture.detectChanges();
    expect(screen.queryByText(/estos resultados son de antes/)).toBeNull();

    target.set(null);
    fixture.detectChanges();
    expect(screen.getByText(/estos resultados son de antes/)).toBeTruthy();
  });

  it('runs one check at a time, also from the editor', async () => {
    const { check } = await renderCheck();
    check.mockReturnValueOnce(new Promise(() => undefined));
    const view = await open();
    const shortcut = () =>
      runScopeHandlers(
        view,
        new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }),
        'editor',
      );

    shortcut();
    shortcut();

    expect(check).toHaveBeenCalledOnce();
  });

  it('cannot run while the function or the tests have errors', async () => {
    const { check } = await renderCheck(null);
    const view = await open();
    runScopeHandlers(view, new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }), 'editor');

    const run = screen.getByRole('button', { name: 'Ejecutar las pruebas' });
    expect(run.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/Corrige el nombre de la función y las pruebas/)).toBeTruthy();
    expect(check).not.toHaveBeenCalled();
  });

  it('says why it could not run, and keeps the solution after closing', async () => {
    const { check } = await renderCheck();
    check.mockRejectedValueOnce(new DataError('rate_limited'));
    const view = await open();
    view.dispatch({ changes: { from: 0, insert: '// mine\n' }, userEvent: 'input.type' });

    await userEvent.click(screen.getByRole('button', { name: 'Ejecutar las pruebas' }));

    expect((await screen.findByRole('alert')).textContent).toContain('espera un momento');
    expect(
      screen.getByRole('button', { name: 'Ejecutar las pruebas' }).hasAttribute('disabled'),
    ).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Probar mi solución' }));
    const again = await open();
    expect(again.state.doc.toString()).toBe('// mine\nfunction sum(values) {\n}');
  });

  it('says when the code could not run at all', async () => {
    const { check } = await renderCheck();
    check.mockResolvedValueOnce({
      status: 'tests_failed',
      results: [],
      loadError: { kind: 'invalid_code', message: 'Unexpected token' },
    });
    await open();

    await userEvent.click(screen.getByRole('button', { name: 'Ejecutar las pruebas' }));
    fixture.detectChanges();

    expect(screen.getByRole('status').textContent).toBe('El código no se ha podido ejecutar');
  });

  it('compares two checks by their code and tests', () => {
    const check = { ...TARGET, code: 'x' };

    expect(sameCheck(check, { ...TARGET, code: 'x' })).toBe(true);
    expect(sameCheck(check, { ...TARGET, code: 'y' })).toBe(false);
  });
});
