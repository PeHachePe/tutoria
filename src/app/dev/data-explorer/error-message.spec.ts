import { DataError } from '../../data/data-error';
import { errorMessage } from './error-message';

describe('errorMessage', () => {
  it('explains each kind of data error and names it', () => {
    expect(errorMessage(new DataError('not_found'))).toBe(
      'No existe o no tienes acceso. (not_found)',
    );
    expect(errorMessage(new DataError('invalid'))).toBe(
      'La operación no está permitida en el estado actual. (invalid)',
    );
  });

  it('falls back to a generic message for any other error', () => {
    expect(errorMessage(new TypeError('boom'))).toBe('Error inesperado.');
  });
});
