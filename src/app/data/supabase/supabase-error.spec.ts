import { DataError, type DataErrorKind } from '../data-error';
import { check, toDataError, unwrap } from './supabase-error';

describe('toDataError', () => {
  it.each<[string, DataErrorKind]>([
    ['P0002', 'not_found'],
    ['PGRST116', 'not_found'],
    ['22P02', 'not_found'],
    ['P0001', 'invalid'],
    ['23505', 'invalid'],
    ['42501', 'forbidden'],
    ['invalid_credentials', 'unauthorized'],
    ['user_banned', 'forbidden'],
    ['refresh_token_not_found', 'unauthorized'],
    ['over_request_rate_limit', 'rate_limited'],
  ])('reads the code %s as %s, whatever the status', (code, kind) => {
    expect(toDataError({ message: 'boom', code, status: 400 }).kind).toBe(kind);
  });

  it.each<[number, DataErrorKind]>([
    [0, 'network'],
    [400, 'invalid'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'invalid'],
    [422, 'invalid'],
    [429, 'rate_limited'],
    [502, 'unavailable'],
    [503, 'unavailable'],
    [504, 'unavailable'],
    [500, 'unknown'],
  ])('reads the status %i as %s without a known code', (status, kind) => {
    expect(toDataError({ message: 'boom', code: 'other', status }).kind).toBe(kind);
  });

  it('is unknown without a code or a status', () => {
    expect(toDataError({ message: 'boom' }).kind).toBe('unknown');
  });

  it('keeps the message and the original failure as its cause', () => {
    const failure = { message: 'Only a passed attempt can be submitted', code: 'P0001' };

    const error = toDataError(failure);

    expect(error).toBeInstanceOf(DataError);
    expect(error.message).toBe('Only a passed attempt can be submitted');
    expect(error.cause).toBe(failure);
  });
});

describe('unwrap', () => {
  it('returns the data of an answer without an error', () => {
    expect(unwrap({ data: [1, 2], error: null, status: 200 })).toEqual([1, 2]);
  });

  it('throws the DataError of an answer with an error, using its status', () => {
    expect(() =>
      unwrap({ data: null, error: { message: 'Failed to fetch', code: '' }, status: 0 }),
    ).toThrowError(expect.objectContaining({ kind: 'network' }));
  });

  it('lets an answer without data and without an error through', () => {
    expect(() => check({ data: null, error: null, status: 204 })).not.toThrow();
  });
});
