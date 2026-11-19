import { speakableSentences } from './speakable-sentences';

const closing = 'Te lo dejo en el chat.';
const es = { locale: 'es', closing } as const;

describe('speakableSentences', () => {
  it('splits a text into its sentences', () => {
    expect(speakableSentences('Mira el bucle. ¿Dónde empieza? Prueba con 0.', es)).toEqual([
      'Mira el bucle.',
      '¿Dónde empieza?',
      'Prueba con 0.',
    ]);
  });

  it('gives nothing for an empty text', () => {
    expect(speakableSentences('', es)).toEqual([]);
    expect(speakableSentences('  \n ', es)).toEqual([]);
  });

  it('leaves out the blocks of code and says the closing once', () => {
    expect(
      speakableSentences(
        'Empieza así:\n```js\nlet a = 1;\n```\nY otro:\n```\nb()\n```\nAcaba.',
        es,
      ),
    ).toEqual(['Empieza así:', 'Y otro:', 'Acaba.', closing]);
  });

  it('leaves out a block that never closes, with what follows it', () => {
    expect(speakableSentences('Mira esto.\n```js\nlet a = 1;\nY más.', es)).toEqual([
      'Mira esto.',
      closing,
    ]);
  });

  it('says only the closing when the answer is only a block', () => {
    expect(speakableSentences('```js\nlet a = 1;\n```', es)).toEqual([closing]);
  });

  it('says the closing when the answer leaves a button', () => {
    expect(speakableSentences('Te lo marco.', { ...es, leavesButton: true })).toEqual([
      'Te lo marco.',
      closing,
    ]);
  });

  it('keeps the inline code as a word', () => {
    expect(speakableSentences('Usa `reduce` aquí.', es)).toEqual(['Usa reduce aquí.']);
  });

  it('drops the Markdown marks', () => {
    expect(
      speakableSentences(
        '## Pista\n> Ojo con **esto** y __eso__.\n- Uno *bien*.\n* Dos _más_.\n• Tres.\n1. Cuatro.\n2) Cinco.',
        es,
      ),
    ).toEqual([
      'Pista',
      'Ojo con esto y eso.',
      'Uno bien.',
      'Dos más.',
      'Tres.',
      '1, Cuatro.',
      '2, Cinco.',
    ]);
  });

  it('keeps a comparison at the start of a line, unlike a quote', () => {
    expect(speakableSentences('>= 0 vale.', es)).toEqual(['>= 0 vale.']);
  });

  it('keeps the text of a link', () => {
    expect(speakableSentences('Lee [la guía](https://example.com/a.b).', es)).toEqual([
      'Lee la guía.',
    ]);
  });

  it('leaves the underscores inside a word', () => {
    expect(speakableSentences('Mira mi_variable y otra_mas_larga.', es)).toEqual([
      'Mira mi_variable y otra_mas_larga.',
    ]);
  });

  it('drops the emojis, with their joiners and tones', () => {
    expect(speakableSentences('¡Bien! 🎉 Sigue 👍🏽 así 👩‍💻. ❤️', es)).toEqual([
      '¡Bien!',
      'Sigue así.',
    ]);
  });

  it('does not split a decimal nor a dot before a lower case', () => {
    expect(speakableSentences('Vale 3.5 euros. Ver arr.length luego.', es)).toEqual([
      'Vale 3.5 euros.',
      'Ver arr.length luego.',
    ]);
  });

  it('does not split after an abbreviation, in each language', () => {
    expect(speakableSentences('Un bucle, p. ej. For sirve. Bien.', es)).toEqual([
      'Un bucle, p. ej. For sirve.',
      'Bien.',
    ]);
    expect(speakableSentences('A loop, e.g. For works. Fine.', { locale: 'en', closing })).toEqual([
      'A loop, e.g. For works.',
      'Fine.',
    ]);
    expect(
      speakableSentences('Un bucle, p. ex. For va bé. Bé.', { locale: 'ca', closing }),
    ).toEqual(['Un bucle, p. ex. For va bé.', 'Bé.']);
  });

  it('while partial, keeps back the last sentence and the closing', () => {
    expect(speakableSentences('Mira el bucle. Prueba co', { ...es, partial: true })).toEqual([
      'Mira el bucle.',
    ]);
    expect(
      speakableSentences('Mira esto.\n```js\nlet a', { ...es, partial: true, leavesButton: true }),
    ).toEqual(['Mira esto.']);
    expect(speakableSentences('Mira esto:\n```js\n', { ...es, partial: true })).toEqual([
      'Mira esto:',
    ]);
  });

  it('while partial, keeps back a sentence until a letter tells whether it ends', () => {
    // «. 2 veces» does not split, but «. 2» does at the end: the sentence before waits
    expect(speakableSentences('Revisa el bucle. 2', { ...es, partial: true })).toEqual([]);
    expect(speakableSentences('Revisa el bucle. (', { ...es, partial: true })).toEqual([]);
    expect(speakableSentences('🎉', { ...es, partial: true })).toEqual([]);
    expect(speakableSentences('Revisa el bucle. 2 Ve', { ...es, partial: true })).toEqual([
      'Revisa el bucle.',
    ]);
  });

  it('while partial, gives a prefix of the final sentences at every length', () => {
    for (const answer of [
      'Mira **el bucle**, p. ej. For. ¿Dónde empieza?\n```js\nfor (;;) {}\n```\nVale 3.5. Usa `i`. 🎉 Bien.',
      'Revisa el bucle. 2 veces más. (pista) mira el índice. Bien.',
    ]) {
      const final = speakableSentences(answer, es);
      for (let length = 0; length <= answer.length; length++) {
        const partial = speakableSentences(answer.slice(0, length), { ...es, partial: true });
        expect(final.slice(0, partial.length)).toEqual(partial);
      }
    }
  });
});
