import { normalizeOutput, outputsEqual } from './output-value';

describe('normalizeOutput', () => {
  it('keeps JSON values as they are', () => {
    expect(normalizeOutput(6)).toBe(6);
    expect(normalizeOutput('2.50')).toBe('2.50');
    expect(normalizeOutput(null)).toBeNull();
    expect(normalizeOutput(true)).toBe(true);
    expect(normalizeOutput([1, [2, 'a']])).toEqual([1, [2, 'a']]);
    expect(normalizeOutput({ a: 1, b: [2] })).toEqual({ a: 1, b: [2] });
  });

  it('keeps the values JSON would hide, which are typical beginner mistakes', () => {
    expect(normalizeOutput(undefined)).toBeUndefined();
    expect(normalizeOutput(Number.NaN)).toBeNaN();
    expect(normalizeOutput(Infinity)).toBe(Infinity);
    expect(normalizeOutput([undefined, Number.NaN])).toEqual([undefined, Number.NaN]);
  });

  it('turns what cannot be copied to the page into what JSON would give', () => {
    const date = new Date('2026-11-08T10:00:00.000Z');

    expect(normalizeOutput(date)).toBe('2026-11-08T10:00:00.000Z');
    expect(normalizeOutput(() => 1)).toBeUndefined();
    expect(normalizeOutput(Symbol('x'))).toBeUndefined();
    expect(normalizeOutput(10n)).toBe('10');
    expect(normalizeOutput({ a: undefined, f: () => 1, b: 2 })).toEqual({ b: 2 });
    expect(normalizeOutput(new Map([['a', 1]]))).toEqual({});
  });

  it('rejects a value that contains itself', () => {
    const loop: unknown[] = [];
    loop.push(loop);

    expect(() => normalizeOutput(loop)).toThrow(TypeError);
  });

  it('accepts the same object twice when it does not contain itself', () => {
    const shared = [1];

    expect(normalizeOutput([shared, shared])).toEqual([[1], [1]]);
  });
});

describe('outputsEqual', () => {
  it('compares as JSON', () => {
    expect(outputsEqual(6, 6)).toBe(true);
    expect(outputsEqual([1, 2], [1, 2])).toBe(true);
    expect(outputsEqual('6', 6)).toBe(false);
    expect(outputsEqual([1, 2], [2, 1])).toBe(false);
    expect(outputsEqual(-0, 0)).toBe(true);
  });

  it('ignores the order of the keys of an object', () => {
    expect(outputsEqual({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toBe(true);
    expect(outputsEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('never takes undefined, NaN or Infinity for null', () => {
    expect(outputsEqual(undefined, null)).toBe(false);
    expect(outputsEqual(Number.NaN, null)).toBe(false);
    expect(outputsEqual(Infinity, null)).toBe(false);
    expect(outputsEqual([undefined], [null])).toBe(false);
    expect(outputsEqual(Number.NaN, Number.NaN)).toBe(true);
  });

  it('never mistakes those values for strings with the same text', () => {
    expect(outputsEqual(Number.NaN, 'NaN')).toBe(false);
    expect(outputsEqual(undefined, 'undefined')).toBe(false);
  });
});
