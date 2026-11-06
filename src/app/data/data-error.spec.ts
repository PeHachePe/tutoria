import { DataError } from './data-error';

describe('DataError', () => {
  it('is an Error with its kind and a default message', () => {
    const error = new DataError('not_found');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('DataError');
    expect(error.kind).toBe('not_found');
    expect(error.message).toBe('Data error: not_found');
  });

  it('keeps a custom message and the original cause', () => {
    const cause = new TypeError('Failed to fetch');

    const error = new DataError('network', 'Exercises could not be loaded', { cause });

    expect(error.message).toBe('Exercises could not be loaded');
    expect(error.cause).toBe(cause);
  });

  it('can be told apart from other errors with instanceof', () => {
    const errors: unknown[] = [new DataError('forbidden'), new Error('other')];

    expect(errors.map((error) => error instanceof DataError)).toEqual([true, false]);
  });
});
