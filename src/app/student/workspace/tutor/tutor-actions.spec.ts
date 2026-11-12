import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import type { TurnAction } from '../tutor-store';
import { TutorActions } from './tutor-actions';

const MARKED: TurnAction = {
  call: { name: 'highlightLines', arguments: { lines: [{ line: 3 }] } },
  status: 'done',
};
const DARK: TurnAction = {
  call: { name: 'updateSettings', arguments: { theme: 'dark' } },
  status: 'done',
  result: { changed: { theme: 'dark' }, previous: { theme: 'light' } },
};
const NEXT: TurnAction = {
  call: { name: 'openExercise', arguments: { exercise: 'next' } },
  status: 'pending',
};

describe('TutorActions', () => {
  async function setup(
    actions: readonly TurnAction[],
    { queriedNames = [] as string[], disabled = false } = {},
  ) {
    const run = vi.fn();
    const undo = vi.fn();
    await render(TutorActions, {
      inputs: { actions, queriedNames, disabled },
      on: { run, undo },
    });
    return { run, undo };
  }

  it('says what the tutor looked up and did', async () => {
    await setup([MARKED], { queriedNames: ['getMyProgress'] });
    expect(screen.getByText('Ha consultado tu progreso')).toBeTruthy();
    const list = screen.getByRole('list', { name: 'Lo que ha hecho el tutor' });
    expect(list.textContent).toContain('He marcado la línea 3 del código');
  });

  it('shows nothing without actions or queries', async () => {
    await setup([]);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByText(/Ha consultado/)).toBeNull();
  });

  it('runs what waits for the student with its button', async () => {
    const { run } = await setup([MARKED, NEXT]);
    await userEvent.click(screen.getByRole('button', { name: /Abrir el siguiente ejercicio/ }));
    expect(run).toHaveBeenCalledWith(1);
  });

  it('keeps the button focusable but idle while it runs or once submitted', async () => {
    const { run } = await setup([{ ...NEXT, status: 'running' }]);
    const button = screen.getByRole('button', { name: /Abrir el siguiente ejercicio/ });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(button);
    expect(run).not.toHaveBeenCalled();
  });

  it('shows the hint of the language, which reloads the page', async () => {
    await setup([
      { call: { name: 'updateSettings', arguments: { language: 'en' } }, status: 'pending' },
    ]);
    expect(screen.getByText('La página se vuelve a cargar')).toBeTruthy();
  });

  it('undoes a setting the tutor changed', async () => {
    const { undo } = await setup([DARK]);
    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(undo).toHaveBeenCalledWith(0);
  });

  it('tries again what failed', async () => {
    const { run } = await setup([{ ...NEXT, status: 'failed' }]);
    expect(screen.getByText('No se ha podido hacer: Ejercicio abierto')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(run).toHaveBeenCalledWith(0);
  });

  it('offers nothing to press once the attempt is submitted', async () => {
    await setup([DARK, { ...NEXT, status: 'failed' }], { disabled: true });
    expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });
});
