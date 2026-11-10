import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { AuthStore } from '../../auth/auth-store';
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

  it('offers the way out the screen gives instead of retrying when there is no access', async () => {
    await render(
      `<app-load-error [error]="error"><a href="/alumno">Volver a los ejercicios</a></app-load-error>`,
      { imports: [LoadError], componentProperties: { error: new DataError('not_found') } },
    );

    expect(screen.getByRole('alert').textContent).toContain('No tienes acceso a este contenido');
    expect(screen.getByRole('link', { name: 'Volver a los ejercicios' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('offers to sign in again instead of retrying when the session expired', async () => {
    await render(LoadError, {
      inputs: { error: new DataError('unauthorized') },
      providers: [{ provide: AuthStore, useValue: { signInAgain: vi.fn() } }],
    });

    expect(screen.getByRole('alert').textContent).toContain('Tu sesión ha caducado');
    expect(screen.getByRole('button', { name: 'Volver a entrar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });
});
