import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { TutorBubble, type TutorBubbleState } from './tutor-bubble';

async function renderBubble(state: TutorBubbleState, text = '') {
  const opened = vi.fn();
  const dismissed = vi.fn();
  const { fixture } = await render(TutorBubble, {
    inputs: { state, text },
    on: { opened, dismissed },
  });
  return { opened, dismissed, host: fixture.nativeElement as HTMLElement };
}

describe('TutorBubble', () => {
  it('thinks with three decorative dots and nothing to press', async () => {
    const { host } = await renderBubble('thinking');

    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(host.textContent?.trim()).toBe('');
    expect(host.querySelector('[aria-hidden="true"]')?.children).toHaveLength(3);
  });

  it('shows the first words of an answer, without its blocks of code, and opens the tutor', async () => {
    const { opened, host } = await renderBubble(
      'answer',
      'Mira `sum([])`: ¿qué devuelve?\n\n```js\nfunction sum(v) {}\n```\n\nY sigue.',
    );

    const open = screen.getByRole('button', {
      name: 'Abrir el tutor: Mira sum([]): ¿qué devuelve? Y sigue.',
    });
    expect(open.querySelector('code')?.textContent).toBe('sum([])');
    expect(open.querySelector('.line-clamp-2')).toBeTruthy();
    expect(host.textContent).not.toContain('function sum');

    await userEvent.setup().click(open);
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it('says the answer did not arrive, and its notice opens the tutor to retry', async () => {
    const { opened, host } = await renderBubble('error');

    await userEvent.setup().click(
      screen.getByRole('button', {
        name: 'Abrir el tutor: No he podido responder. Ábreme para reintentar',
      }),
    );

    expect(opened).toHaveBeenCalledTimes(1);
    expect(host.classList).toContain('bg-error-container');
  });

  it.each(['answer', 'error'] as const)('closes the notice with %s', async (state) => {
    const { opened, dismissed } = await renderBubble(state, 'Mira el bucle.');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar el aviso' }));

    expect(dismissed).toHaveBeenCalledTimes(1);
    expect(opened).not.toHaveBeenCalled();
  });
});
