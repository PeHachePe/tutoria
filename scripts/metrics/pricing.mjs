/**
 * Claude API list prices in USD per million tokens (first-party API, November 2026).
 * Used only to estimate what a subscription session would have cost through the API.
 * Claude Haiku 5.5 doubles its rates above 100K tokens of prompt; this table keeps the
 * lower rate, which is the usual case for a subagent.
 */
const PRICES = {
  'claude-fable-5-1': {
    input: 10,
    output: 50,
    cacheRead: 0.25,
    cacheWrite5m: 12.5,
    cacheWrite1h: 20,
  },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite5m: 5, cacheWrite1h: 8 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite5m: 2.5, cacheWrite1h: 4 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite5m: 2.5, cacheWrite1h: 4 },
  'claude-haiku-5-5': {
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    cacheWrite5m: 0.125,
    cacheWrite1h: 0.2,
  },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite5m: 1.25, cacheWrite1h: 2 },
};

/**
 * Equivalent API cost of a model's usage, rounded to cents of a cent, or `null` if the
 * model has no known price.
 *
 * @param {string} model
 * @param {{ input: number, output: number, cacheRead: number, cacheWrite5m: number, cacheWrite1h: number }} usage
 */
export function costUsd(model, usage) {
  const price = PRICES[model];
  if (!price) {
    return null;
  }
  const total = Object.keys(price).reduce((sum, kind) => sum + usage[kind] * price[kind], 0);
  return Math.round(total / 100) / 10_000;
}
