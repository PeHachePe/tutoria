import { splitCodeBlocks } from './split-code-blocks';

describe('splitCodeBlocks', () => {
  it('splits a text around its fenced blocks, with their language', () => {
    expect(
      splitCodeBlocks('Empieza así:\n```js\nfunction suma(vector) {\n}\n```\nY dentro, el bucle.'),
    ).toEqual([
      { kind: 'text', text: 'Empieza así:' },
      { kind: 'block', code: 'function suma(vector) {\n}', language: 'js' },
      { kind: 'text', text: 'Y dentro, el bucle.' },
    ]);
  });

  it('takes a block without a language, and several blocks', () => {
    expect(splitCodeBlocks('```\nuno\n```\n```python\ndos\n```')).toEqual([
      { kind: 'block', code: 'uno', language: '' },
      { kind: 'block', code: 'dos', language: 'python' },
    ]);
  });

  it('shows a block that is still arriving as a block, without its backticks', () => {
    expect(splitCodeBlocks('Así:\n```js\nfunction suma(v')).toEqual([
      { kind: 'text', text: 'Así:' },
      { kind: 'block', code: 'function suma(v', language: 'js' },
    ]);
    expect(splitCodeBlocks('Así:\n```')).toEqual([{ kind: 'text', text: 'Así:' }]);
  });

  it('returns the whole text without blocks, and nothing for an empty text', () => {
    expect(splitCodeBlocks('Mira la línea 3: ¿qué valor tiene `i`?')).toEqual([
      { kind: 'text', text: 'Mira la línea 3: ¿qué valor tiene `i`?' },
    ]);
    expect(splitCodeBlocks('')).toEqual([]);
  });
});
