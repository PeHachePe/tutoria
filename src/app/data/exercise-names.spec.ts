import { isIdentifier } from './exercise-names';

describe('isIdentifier', () => {
  it('accepts the names a function or a parameter can have', () => {
    for (const name of ['sum', 'countEvens', 'n', '_first', '$value', 'item2']) {
      expect(isIdentifier(name), name).toBe(true);
    }
  });

  it('rejects anything else, accents and reserved words included', () => {
    for (const name of ['', '2items', 'first number', 'año', 'números', 'a-b', 'return', 'class']) {
      expect(isIdentifier(name), name).toBe(false);
    }
  });
});
