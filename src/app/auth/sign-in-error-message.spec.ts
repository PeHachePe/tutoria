import type { DataErrorKind } from '../data/data-error';
import { signInErrorMessage } from './sign-in-error-message';

describe('signInErrorMessage', () => {
  it('does not tell a wrong password from an unknown account', () => {
    expect(signInErrorMessage('unauthorized')).toBe('Correo o contraseña incorrectos');
  });

  it('says the account is disabled and who to talk to', () => {
    expect(signInErrorMessage('forbidden')).toBe(
      'Tu cuenta está desactivada. Si crees que es un error, habla con tu docente',
    );
  });

  it('asks to check the connection when the server cannot be reached', () => {
    expect(signInErrorMessage('network')).toBe(
      'No hay conexión. Comprueba la red e inténtalo de nuevo',
    );
  });

  it('asks to wait after too many attempts', () => {
    expect(signInErrorMessage('rate_limited')).toBe(
      'Demasiados intentos. Espera un momento e inténtalo de nuevo',
    );
  });

  it.each<DataErrorKind>(['not_found', 'invalid', 'unknown'])(
    'gives a generic message for %s',
    (kind) => {
      expect(signInErrorMessage(kind)).toBe('No se ha podido entrar. Inténtalo de nuevo');
    },
  );
});
