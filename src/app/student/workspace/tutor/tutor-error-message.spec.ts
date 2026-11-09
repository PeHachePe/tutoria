import { DataError } from '../../../data/data-error';
import { tutorErrorMessage } from './tutor-error-message';

describe('tutorErrorMessage', () => {
  it('says the tutor could not answer and what to do, from the kind of error', () => {
    expect(tutorErrorMessage(new DataError('network'))).toBe(
      'El tutor no ha podido responder. Comprueba la conexión e inténtalo de nuevo.',
    );
    expect(tutorErrorMessage(new DataError('rate_limited'))).toBe(
      'El tutor no ha podido responder. Has preguntado muchas veces seguidas: espera un momento.',
    );
    expect(tutorErrorMessage(new DataError('unauthorized'))).toBe(
      'El tutor no ha podido responder. Tu sesión ha caducado: vuelve a entrar para continuar.',
    );
    expect(tutorErrorMessage(new Error('boom'))).toBe(
      'El tutor no ha podido responder. Inténtalo de nuevo.',
    );
  });
});
