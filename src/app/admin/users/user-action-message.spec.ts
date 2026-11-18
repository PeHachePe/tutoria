import { DataError } from '../../data/data-error';
import { userActionMessage } from './user-action-message';

describe('userActionMessage', () => {
  it('explains a role the server would not change', () => {
    expect(userActionMessage('edit', new DataError('invalid'))).toMatch(/grupos a su cargo/);
  });

  it('explains what the server did not accept in a new account or a new password', () => {
    expect(userActionMessage('create', new DataError('invalid'))).toMatch(/correo/);
    expect(userActionMessage('password', new DataError('invalid'))).toMatch(/contraseña/);
  });

  it('tells a lost connection', () => {
    expect(userActionMessage('status', new DataError('network'))).toMatch(/conexión/);
  });

  it('falls back to the generic message', () => {
    expect(userActionMessage('status', new DataError('invalid'))).toBe(
      'No se ha podido guardar. Inténtalo de nuevo.',
    );
    expect(userActionMessage('create', new Error('boom'))).toBe(
      'No se ha podido guardar. Inténtalo de nuevo.',
    );
  });
});
