import { isEcho, MIN_OWN_WORDS } from './is-echo';

describe('isEcho', () => {
  const spoken = 'Fíjate en qué devuelve la función. ¿Qué pasa cuando el bucle acaba?';

  it('is the same sentence, with another punctuation, case and accents', () => {
    expect(isEcho('fijate en que devuelve la funcion', spoken)).toBe(true);
    expect(isEcho('QUÉ PASA, cuando el bucle acaba', spoken)).toBe(true);
  });

  it('is a piece of it, as the recognition gives it late', () => {
    expect(isEcho('el bucle', spoken)).toBe(true);
  });

  it(`interrupts with ${MIN_OWN_WORDS} words of the student's own, not with one`, () => {
    expect(isEcho('espera el bucle', spoken)).toBe(true);
    expect(isEcho('espera, no entiendo el bucle', spoken)).toBe(false);
  });

  it('is never what is heard with nothing said', () => {
    expect(isEcho('espera tutor', '')).toBe(false);
  });

  it('is an empty text, which interrupts nothing', () => {
    expect(isEcho('', spoken)).toBe(true);
    expect(isEcho(' ¿? ', spoken)).toBe(true);
  });
});
