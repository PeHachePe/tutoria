import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import type { SaveStatus } from '../attempt-store';
import { SaveIndicator } from './save-indicator';

async function renderIndicator(status: SaveStatus) {
  const retry = vi.fn();
  const result = await render(SaveIndicator, { inputs: { status }, on: { retry } });
  return { ...result, retry };
}

describe('SaveIndicator', () => {
  it('shows nothing before the first change', async () => {
    const { fixture } = await renderIndicator('idle');

    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it.each<SaveStatus>(['pending', 'saving'])('says it is saving while %s', async (status) => {
    await renderIndicator(status);

    expect(screen.getByText('Guardando…')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says the code is saved, without announcing it', async () => {
    await renderIndicator('saved');

    expect(screen.getByText('Guardado')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('announces a failed save and offers to retry', async () => {
    const { retry } = await renderIndicator('error');

    expect(screen.getByRole('alert').textContent).toContain('No se ha guardado');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(retry).toHaveBeenCalledOnce();
  });
});
