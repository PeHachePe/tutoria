import { Clipboard } from '@angular/cdk/clipboard';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { CodeBlock, COPIED_FEEDBACK_MS } from './code-block';

describe('CodeBlock', () => {
  const copy = vi.fn(() => true);

  async function setup(language = 'js') {
    copy.mockClear();
    return render(CodeBlock, {
      inputs: { code: 'function suma(vector) {\n}', language },
      providers: [{ provide: Clipboard, useValue: { copy } }],
    });
  }

  afterEach(() => vi.useRealTimers());

  it('shows the code as it is, with the name of its language', async () => {
    await setup();

    expect(screen.getByText('JavaScript')).toBeTruthy();
    const code = screen.getByRole('code');
    expect(code.textContent).toBe('function suma(vector) {\n}');
    expect(code.parentElement?.tagName).toBe('PRE');
  });

  it('shows a language it does not know as it comes, and says «Código» without one', async () => {
    const { rerender } = await setup('python');
    expect(screen.getByText('python')).toBeTruthy();

    await rerender({ inputs: { code: 'x', language: '' }, partialUpdate: true });
    expect(screen.getByText('Código')).toBeTruthy();
  });

  it('copies the code, says so and offers to copy again after a moment', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { fixture } = await setup();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

    await user.click(screen.getByRole('button', { name: 'Copiar' }));

    expect(copy).toHaveBeenCalledWith('function suma(vector) {\n}');
    expect(screen.getByRole('button', { name: 'Copiado' })).toBeTruthy();
    expect(screen.getByText('Código copiado')).toBeTruthy();

    vi.advanceTimersByTime(COPIED_FEEDBACK_MS);
    fixture.detectChanges();
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeTruthy();
  });

  it('says nothing when the browser does not let it copy', async () => {
    await setup();
    copy.mockReturnValueOnce(false);

    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }));

    expect(screen.getByRole('button', { name: 'Copiar' })).toBeTruthy();
    expect(screen.queryByText('Código copiado')).toBeNull();
  });

  it('forgets the pending feedback when it goes away', async () => {
    const { fixture } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }));

    expect(() => fixture.destroy()).not.toThrow();
  });
});
