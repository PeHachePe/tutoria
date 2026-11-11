import {
  MAX_SYNTAX_EXAMPLES,
  SYNTAX_EXAMPLES,
  SYNTAX_TOPICS,
  syntaxBlocks,
  syntaxTopicsIn,
} from './syntax-examples';

describe('syntax examples', () => {
  it('has a short example of every topic, in a block of its own', () => {
    for (const topic of SYNTAX_TOPICS) {
      expect(SYNTAX_EXAMPLES[topic].trim().length, topic).toBeGreaterThan(10);
      expect(SYNTAX_EXAMPLES[topic], topic).not.toContain('```');
    }
  });

  it('never shows an accumulator, the usual core of an exercise', () => {
    for (const topic of SYNTAX_TOPICS) {
      expect(SYNTAX_EXAMPLES[topic], topic).not.toMatch(/\+=|\.reduce\(|Math\.max|Math\.min/);
    }
  });

  describe('syntaxTopicsIn', () => {
    it.each<[string, string[]]>([
      ['como es la sintaxis del for', ['for']],
      ['¿Cómo se escribe un bucle while?', ['while']],
      ['ponme un ejemplo de math floor no se su sintaxis', ['math']],
      ['No me acuerdo de cómo es una función', ['function']],
      ['¿Cómo se recorre un vector con for of?', ['for-of', 'array']],
      ['ejemplo de if else', ['if']],
      ['How do I write a for loop?', ['for']],
      ['Can you show me an example of a string method?', ['string']],
      ['Com s’escriu un bucle while?', ['while']],
      ['¿Cómo se usa el resto, el %?', ['operators']],
      ['¿Cómo se declara una variable con let?', ['variable']],
    ])('finds what «%s» asks about', (message, topics) => {
      expect(syntaxTopicsIn(message)).toEqual(topics);
    });

    it.each([
      '¿Por qué falla la segunda prueba?',
      'Mi bucle for no termina',
      'Dame la solución',
      'Is this right?',
      '',
    ])('finds nothing in «%s», which is not a question about syntax', (message) => {
      expect(syntaxTopicsIn(message)).toEqual([]);
    });

    it('takes no more than the examples an answer shows', () => {
      expect(syntaxTopicsIn('ejemplo de for, while, if y vector')).toHaveLength(
        MAX_SYNTAX_EXAMPLES,
      );
    });
  });

  describe('syntaxBlocks', () => {
    it('writes the example of each topic of the catalog in a block, once', () => {
      expect(syntaxBlocks(['for'])).toBe(`\`\`\`js\n${SYNTAX_EXAMPLES.for}\n\`\`\``);
      expect(syntaxBlocks(['math', 'stone', 'math', 'if'])).toBe(
        `\`\`\`js\n${SYNTAX_EXAMPLES.math}\n\`\`\`\n\`\`\`js\n${SYNTAX_EXAMPLES.if}\n\`\`\``,
      );
    });

    it('writes nothing without a topic of the catalog, and no more than the maximum', () => {
      expect(syntaxBlocks([])).toBe('');
      expect(syntaxBlocks(['stone'])).toBe('');
      expect(syntaxBlocks(['for', 'while', 'if']).match(/```js/g)).toHaveLength(
        MAX_SYNTAX_EXAMPLES,
      );
    });
  });
});
