import { ACTIVE_MINUTES, workState } from './live-work';
import { ago, NOW } from './live-testing';

describe('workState', () => {
  it('is working with something done a moment ago', () => {
    expect(workState(ago(2), false, NOW)).toBe('working');
  });

  it('is still working exactly at the limit, and stopped a millisecond later', () => {
    expect(workState(ago(ACTIVE_MINUTES), false, NOW)).toBe('working');
    expect(workState(ago(ACTIVE_MINUTES) - 1, false, NOW)).toBe('stopped');
  });

  it('is stopped out of the browser window, even with something done a moment ago', () => {
    expect(workState(ago(1), true, NOW)).toBe('stopped');
  });

  it('is absent without activity or with the last one before the session', () => {
    expect(workState(null, false, NOW)).toBe('absent');
    expect(workState(ago(61), false, NOW)).toBe('absent');
  });

  it('is in the session exactly at the start of the window', () => {
    expect(workState(ago(60), false, NOW)).toBe('stopped');
  });
});
