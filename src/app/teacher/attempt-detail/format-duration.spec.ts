import { formatDuration } from './format-duration';

describe('formatDuration', () => {
  it.each([
    [0, '0 s'],
    [45_000, '45 s'],
    [59_400, '59 s'],
    [90_000, '2 min'],
    [3 * 60_000, '3 min'],
    [60 * 60_000, '1 h'],
    [80 * 60_000, '1 h 20 min'],
    [24 * 60 * 60_000, '1 d'],
    [45_175 * 60_000, '31 d'],
  ])('says %i ms as %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});
