import { DataError, type DataErrorKind } from '../../data/data-error';
import { loadErrorMessage } from './load-error-message';

describe('loadErrorMessage', () => {
  it('asks to check the connection when the server cannot be reached', () => {
    expect(loadErrorMessage(new DataError('network'))).toBe(
      'No hay conexión. Comprueba la red e inténtalo de nuevo.',
    );
  });

  it('asks to sign in again when the session has expired', () => {
    expect(loadErrorMessage(new DataError('unauthorized'))).toBe(
      'Tu sesión ha caducado. Vuelve a entrar para continuar.',
    );
  });

  it.each<DataErrorKind>(['forbidden', 'not_found'])('says there is no access for %s', (kind) => {
    expect(loadErrorMessage(new DataError(kind))).toBe('No tienes acceso a este contenido.');
  });

  it('asks to wait after too many requests', () => {
    expect(loadErrorMessage(new DataError('rate_limited'))).toBe(
      'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.',
    );
  });

  it.each<unknown>([new DataError('invalid'), new DataError('unknown'), new Error('boom'), 'boom'])(
    'gives a generic message for anything else (%s)',
    (error) => {
      expect(loadErrorMessage(error)).toBe('No se ha podido cargar. Inténtalo de nuevo.');
    },
  );
});
