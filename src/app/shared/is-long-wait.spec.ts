import { DataError } from '../data/data-error';
import { isLongWait, LONG_WAIT_MS } from './is-long-wait';

describe('isLongWait', () => {
  afterEach(() => vi.useRealTimers());

  it('is a wait of more than a minute that the server asked for', () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-10T10:00:00Z') });
    const now = Date.now();
    const wait = (seconds: number) =>
      new DataError('rate_limited', 'Too many', { retryAfterSeconds: seconds });

    expect(isLongWait(wait(3600), now)).toBe(true);
    expect(isLongWait(wait(LONG_WAIT_MS / 1000), now)).toBe(false);
    expect(isLongWait(wait(40), now)).toBe(false);
    expect(isLongWait(new DataError('network'), now)).toBe(false);
    expect(isLongWait(new Error('boom'), now)).toBe(false);
  });
});
