import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { DataError } from '../../data/data-error';
import { LoadError } from './load-error';

describe('LoadError', () => {
  it('announces the message of the error and offers to retry', async () => {
    const retry = vi.fn();
    await render(LoadError, { inputs: { error: new DataError('network') }, on: { retry } });

    expect(screen.getByRole('alert').textContent).toContain('No hay conexión');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(retry).toHaveBeenCalledOnce();
  });
});
