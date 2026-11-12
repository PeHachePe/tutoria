import { DataError } from '../../../data/data-error';
import { tutorErrorMessage } from './tutor-error-message';

describe('tutorErrorMessage', () => {
  afterEach(() => vi.useRealTimers());

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
    expect(tutorErrorMessage(new DataError('unavailable'))).toBe(
      'El tutor no ha podido responder. Ahora mismo no está disponible: inténtalo más tarde.',
    );
    expect(tutorErrorMessage(new Error('boom'))).toBe(
      'El tutor no ha podido responder. Inténtalo de nuevo.',
    );
  });

  it('tells the limit of the day apart from the one of the minute', () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-10T10:00:00Z') });

    expect(
      tutorErrorMessage(new DataError('rate_limited', 'Too many', { retryAfterSeconds: 3600 })),
    ).toBe(
      'El tutor no ha podido responder. Has llegado al límite de preguntas de hoy: podrás volver a preguntar más tarde.',
    );
    expect(
      tutorErrorMessage(new DataError('rate_limited', 'Too many', { retryAfterSeconds: 40 })),
    ).toBe(
      'El tutor no ha podido responder. Has preguntado muchas veces seguidas: espera un momento.',
    );
  });
});
