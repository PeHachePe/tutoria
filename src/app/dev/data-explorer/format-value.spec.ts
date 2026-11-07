import { formatCall, formatValue, isMultilineText } from './format-value';

describe('formatValue', () => {
  it.each<[unknown, string]>([
    [6, '6'],
    [-2, '-2'],
    [null, 'null'],
    [true, 'true'],
    ['2.50', '"2.50"'],
    ['', '""'],
    [[1, 2, 3], '[1, 2, 3]'],
    [[], '[]'],
    [[[1, -2], ['a']], '[[1, -2], ["a"]]'],
    [{ min: 0, max: 5 }, '{ min: 0, max: 5 }'],
    [{}, '{}'],
  ])('writes %o as code: %s', (value, text) => {
    expect(formatValue(value)).toBe(text);
  });
});

describe('formatCall', () => {
  it('writes a test input as the call the student would make', () => {
    expect(formatCall('suma', [[1, 2, 3]])).toBe('suma([1, 2, 3])');
    expect(formatCall('buscar', [[4, 8, 15], 8])).toBe('buscar([4, 8, 15], 8)');
    expect(formatCall('contarVocales', [''])).toBe('contarVocales("")');
  });
});

describe('isMultilineText', () => {
  it('is true only for texts with line breaks', () => {
    expect(isMultilineText('2 x 1 = 2\n2 x 2 = 4')).toBe(true);
    expect(isMultilineText('hola')).toBe(false);
    expect(isMultilineText(['a\nb'])).toBe(false);
  });
});
