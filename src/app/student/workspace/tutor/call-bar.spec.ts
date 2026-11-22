import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import type { CallState } from '../voice-call';
import { CallBar } from './call-bar';

async function renderBar(state: CallState, inputs: Partial<Record<string, unknown>> = {}) {
  const outputs = {
    hold: vi.fn(),
    correct: vi.fn(),
    interrupt: vi.fn(),
    keepTalking: vi.fn(),
    hangUp: vi.fn(),
  };
  const view = await render(CallBar, { inputs: { state, ...inputs }, on: outputs });
  return { ...view, outputs };
}

function card(): HTMLElement {
  return screen.getByRole('group', { name: 'Llamada con el tutor' });
}

/** What the tooltip of a button says: Material describes the button with it. */
function tooltipOf(button: HTMLElement): string {
  const ids = button.getAttribute('aria-describedby')?.split(' ') ?? [];
  return ids.map((id) => document.getElementById(id)?.textContent?.trim()).join(' ');
}

/** The buttons, by their accessible names (their icons are hidden). */
function buttonNames(): string[] {
  return screen
    .getAllByRole('button')
    .map((button) => button.querySelector('.mdc-button__label')?.textContent?.trim() ?? '');
}

describe('CallBar', () => {
  it('listens, with «Pausar» and the open microphone in sight', async () => {
    const { container } = await renderBar('listening', { microphoneOpen: true });
    expect(card().textContent).toContain('Te escucho');
    expect(card().textContent).toContain('Habla cuando quieras.');
    expect(buttonNames()).toEqual(['Pausar', 'Colgar']);
    const pause = screen.getByRole('button', { name: 'Pausar' });
    expect(pause.getAttribute('aria-keyshortcuts')).toBe('Control+.');
    expect(tooltipOf(pause)).toBe('Pausar (Ctrl + .)');
    expect(container.querySelector('.border-primary')).toBeTruthy();
  });

  it('shows what it is understanding, with «Corregir»', async () => {
    await renderBar('hearing', { heard: '¿Por qué falla?', microphoneOpen: true });
    expect(card().textContent).toContain('¿Por qué falla?');
    expect(buttonNames()).toEqual(['Corregir', 'Colgar']);
  });

  it('thinks with the microphone closed, and only «Colgar»', async () => {
    const { container } = await renderBar('thinking');
    expect(card().textContent).toContain('Pensando…');
    expect(card().textContent).toContain('Micrófono cerrado.');
    expect(buttonNames()).toEqual(['Colgar']);
    expect(container.querySelector('.border-primary')).toBeNull();
  });

  it('speaks with the sentence it says as a subtitle, and «Interrumpir» with Control', async () => {
    const { rerender } = await renderBar('speaking', { saying: 'Mira el bucle.' });
    expect(card().textContent).toContain('Hablando…');
    expect(card().textContent).toContain('Mira el bucle.');
    const interrupt = screen.getByRole('button', { name: 'Interrumpir' });
    expect(interrupt.getAttribute('aria-keyshortcuts')).toBe('Control');
    expect(tooltipOf(interrupt)).toBe('Interrumpir (Ctrl)');

    await rerender({ partialUpdate: true, inputs: { saying: null } });
    expect(card().textContent).not.toContain('Mira el bucle.');
  });

  it('waits on hold, with «Seguir hablando»', async () => {
    await renderBar('standby');
    expect(card().textContent).toContain('En espera');
    expect(card().textContent).toContain('Micrófono cerrado.');
    const keepTalking = screen.getByRole('button', { name: 'Seguir hablando' });
    expect(keepTalking.getAttribute('aria-keyshortcuts')).toBe('Control+.');
    expect(tooltipOf(keepTalking)).toBe('Seguir hablando (Ctrl + .)');
  });

  it('tells each button', async () => {
    const user = userEvent.setup();
    const { outputs, rerender } = await renderBar('listening');
    // A rerender drops the listeners it was not given again
    const show = (state: CallState) =>
      rerender({ partialUpdate: true, inputs: { state }, on: outputs });
    await user.click(screen.getByRole('button', { name: 'Pausar' }));
    await user.click(screen.getByRole('button', { name: 'Colgar' }));
    await show('hearing');
    await user.click(screen.getByRole('button', { name: 'Corregir' }));
    await show('speaking');
    await user.click(screen.getByRole('button', { name: 'Interrumpir' }));
    await show('standby');
    await user.click(screen.getByRole('button', { name: 'Seguir hablando' }));
    expect(
      Object.fromEntries(Object.entries(outputs).map(([name, fn]) => [name, fn.mock.calls.length])),
    ).toEqual({ hold: 1, correct: 1, interrupt: 1, keepTalking: 1, hangUp: 1 });
  });

  it('says each state once, and not again while the student speaks', async () => {
    const { container, rerender } = await renderBar('listening');
    const announcer = container.querySelector('[aria-live="polite"]')!;
    expect(announcer.textContent?.trim()).toBe('Te escucho');
    await rerender({ partialUpdate: true, inputs: { state: 'hearing', heard: 'Hola' } });
    expect(announcer.textContent?.trim()).toBe('Te escucho');
    await rerender({ partialUpdate: true, inputs: { state: 'thinking' } });
    expect(announcer.textContent?.trim()).toBe('Pensando…');
    // What is understood is seen, but not read word by word
    expect(announcer.textContent).not.toContain('Hola');
  });
});
