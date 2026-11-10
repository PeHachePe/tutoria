import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { AuthStore } from '../../auth/auth-store';
import { DataError } from '../../data/data-error';
import { isSessionExpired, SignInAgain } from './sign-in-again';

describe('isSessionExpired', () => {
  it.each<[unknown, boolean]>([
    [new DataError('unauthorized'), true],
    [new DataError('network'), false],
    [new Error('unauthorized'), false],
    [undefined, false],
  ])('%s → %s', (error, expired) => {
    expect(isSessionExpired(error)).toBe(expired);
  });
});

describe('SignInAgain', () => {
  it('signs in again, back to the same page', async () => {
    const signInAgain = vi.fn(() => Promise.resolve());
    await render(SignInAgain, { providers: [{ provide: AuthStore, useValue: { signInAgain } }] });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Volver a entrar' }));

    expect(signInAgain).toHaveBeenCalledOnce();
  });
});
