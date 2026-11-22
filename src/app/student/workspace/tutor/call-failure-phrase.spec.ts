import { DataError } from '../../../data/data-error';
import { callFailurePhrase } from './call-failure-phrase';

describe('callFailurePhrase', () => {
  const now = Date.parse('2026-11-22T10:00:00Z');
  const limited = (seconds?: number) => {
    const error = new DataError('rate_limited', 'Too many');
    return seconds === undefined ? error : Object.assign(error, { retryAt: now + seconds * 1000 });
  };

  it('says the answer failed, and the call goes on', () => {
    expect(callFailurePhrase(new DataError('network'), now)).toEqual({
      text: 'No he podido responder.',
      hold: false,
    });
    expect(callFailurePhrase(new Error('boom'), now).hold).toBe(false);
  });

  it('says how many seconds to wait, rounded up, and holds the call', () => {
    expect(callFailurePhrase(limited(12.2), now)).toEqual({
      text: 'Has preguntado muchas veces seguidas. Espera 13 segundos y seguimos.',
      hold: true,
    });
  });

  it('says to wait a moment without a time, or with one already past', () => {
    const soon = {
      text: 'Has preguntado muchas veces seguidas. Espera un momento y seguimos.',
      hold: true,
    };
    expect(callFailurePhrase(limited(), now)).toEqual(soon);
    expect(callFailurePhrase(limited(0), now)).toEqual(soon);
  });

  it('says the limit of the day is reached for a long wait', () => {
    expect(callFailurePhrase(limited(3600), now)).toEqual({
      text: 'Has llegado al límite de preguntas de hoy. Podremos seguir más tarde.',
      hold: true,
    });
  });
});
