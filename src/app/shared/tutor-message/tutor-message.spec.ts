import { render, screen } from '@testing-library/angular';

import { TutorMessage } from './tutor-message';

describe('TutorMessage', () => {
  function setup(text: string, typing = false) {
    return render(TutorMessage, { inputs: { text, typing } });
  }

  it('shows each paragraph with its inline code', async () => {
    const { container } = await setup('Mira la línea 3:\n¿qué vale `i` al empezar?');

    const paragraph = container.querySelector('p');
    expect(paragraph?.textContent?.trim()).toBe('Mira la línea 3:\n¿qué vale i al empezar?');
    expect(screen.getByText('i').tagName).toBe('CODE');
  });

  it('shows a block of code between the text, with «Copiar»', async () => {
    const { container } = await setup(
      'Así:\n```js\nfunction suma(v) {\n}\n```\nY dentro, el bucle.',
    );

    expect([...container.querySelectorAll('p')].map((p) => p.textContent?.trim())).toEqual([
      'Así:',
      'Y dentro, el bucle.',
    ]);
    expect(screen.getByRole('code').textContent).toBe('function suma(v) {\n}');
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeTruthy();
  });

  it('blinks a caret after the last words while it arrives, also after a block', async () => {
    const { container, rerender } = await setup('Así:\n```js\nfunction suma(', true);
    expect(container.lastElementChild?.getAttribute('data-testid')).toBe('tutor-caret');
    expect(screen.getAllByTestId('tutor-caret')).toHaveLength(1);

    await rerender({ inputs: { text: 'Hola, ¿qué tal?', typing: true }, partialUpdate: true });
    expect(container.querySelector('p [data-testid="tutor-caret"]')).toBeTruthy();
    expect(screen.getAllByTestId('tutor-caret')).toHaveLength(1);

    await rerender({ inputs: { typing: false }, partialUpdate: true });
    expect(screen.queryByTestId('tutor-caret')).toBeNull();
  });
});
