import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { costUsd } from './pricing.mjs';

const million = {
  input: 1_000_000,
  output: 1_000_000,
  cacheRead: 1_000_000,
  cacheWrite5m: 1_000_000,
  cacheWrite1h: 1_000_000,
};

describe('costUsd', () => {
  it('prices every kind of token with the rates of the model', () => {
    // Opus 5.5: 4 input + 20 output + 0.20 cache read + 5 (5 min) + 8 (1 h)
    assert.equal(costUsd('claude-opus-5-5', million), 37.2);
  });

  it('prices a partial usage', () => {
    const usage = { input: 0, output: 500_000, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 };
    assert.equal(costUsd('claude-sonnet-5-5', usage), 5);
  });

  it('returns null for an unknown model', () => {
    assert.equal(costUsd('claude-unknown-1', million), null);
  });
});
