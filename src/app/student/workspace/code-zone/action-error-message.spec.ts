import { DataError } from '../../../data/data-error';
import { actionErrorMessage } from './action-error-message';

describe('actionErrorMessage', () => {
  it.each([
    [
      'network',
      'No se han podido ejecutar las pruebas. Comprueba la conexión e inténtalo de nuevo.',
    ],
    [
      'rate_limited',
      'No se han podido ejecutar las pruebas. Has ejecutado muchas veces seguidas: espera un momento.',
    ],
    [
      'unauthorized',
      'No se han podido ejecutar las pruebas. Tu sesión ha caducado: vuelve a entrar para continuar.',
    ],
    ['unknown', 'No se han podido ejecutar las pruebas. Inténtalo de nuevo.'],
  ] as const)('explains a failed run with %s', (kind, message) => {
    expect(actionErrorMessage({ action: 'run', error: new DataError(kind) })).toBe(message);
  });

  it('explains a failed submission', () => {
    expect(actionErrorMessage({ action: 'submit', error: new DataError('network') })).toBe(
      'No se ha podido entregar. Comprueba la conexión e inténtalo de nuevo.',
    );
  });

  it('treats any other error as unknown', () => {
    expect(actionErrorMessage({ action: 'submit', error: new Error('x') })).toBe(
      'No se ha podido entregar. Inténtalo de nuevo.',
    );
  });
});
