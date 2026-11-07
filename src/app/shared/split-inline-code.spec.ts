import { splitInlineCode } from './split-inline-code';

describe('splitInlineCode', () => {
  it('splits a text into plain parts and the code between backticks', () => {
    expect(splitInlineCode('Escribe una función `suma` que devuelva 0.')).toEqual([
      { text: 'Escribe una función ', code: false },
      { text: 'suma', code: true },
      { text: ' que devuelva 0.', code: false },
    ]);
  });

  it('keeps code at the edges and several pieces of code', () => {
    expect(splitInlineCode('`n x i = resultado` y `\\n`')).toEqual([
      { text: 'n x i = resultado', code: true },
      { text: ' y ', code: false },
      { text: '\\n', code: true },
    ]);
  });

  it('returns the whole text when there is no code, and nothing for an empty text', () => {
    expect(splitInlineCode('Sin código.')).toEqual([{ text: 'Sin código.', code: false }]);
    expect(splitInlineCode('')).toEqual([]);
  });

  it('leaves an unpaired backtick as text', () => {
    expect(splitInlineCode('Un ` suelto')).toEqual([{ text: 'Un ` suelto', code: false }]);
    expect(splitInlineCode('``')).toEqual([{ text: '``', code: false }]);
  });
});
