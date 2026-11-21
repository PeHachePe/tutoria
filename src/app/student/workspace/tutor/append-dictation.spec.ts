import { appendDictation } from './append-dictation';

describe('appendDictation', () => {
  it('fills an empty field with what was said, trimmed, as a sentence', () => {
    expect(appendDictation('', '  hola tutor ', 500)).toBe('Hola tutor');
  });

  it('adds it after what was written, with a space', () => {
    expect(appendDictation('Tengo una duda sobre', 'el bucle', 500)).toBe(
      'Tengo una duda sobre el bucle',
    );
  });

  it('starts a sentence after a full stop, a question, an exclamation or a new line', () => {
    expect(appendDictation('Tengo una duda.', 'no entiendo', 500)).toBe(
      'Tengo una duda. No entiendo',
    );
    expect(appendDictation('¿Está bien?', '¿por qué falla?', 500)).toBe(
      '¿Está bien? ¿Por qué falla?',
    );
    expect(appendDictation('¡Funciona!', 'gracias', 500)).toBe('¡Funciona! Gracias');
    expect(appendDictation('Espera…', 'ya está', 500)).toBe('Espera… Ya está');
    expect(appendDictation('Primera línea\n', 'segunda', 500)).toBe('Primera línea\nSegunda');
  });

  it('leaves the first letter alone in the middle of a sentence', () => {
    expect(appendDictation('Mira, ', 'el índice', 500)).toBe('Mira, el índice');
    expect(appendDictation('', '42 veces', 500)).toBe('42 veces');
  });

  it('adds no second space when what was written ends in one', () => {
    expect(appendDictation('Tengo una duda. ', 'no entiendo', 500)).toBe(
      'Tengo una duda. No entiendo',
    );
  });

  it('keeps what was written when nothing was said', () => {
    expect(appendDictation('Tengo una duda', '   ', 500)).toBe('Tengo una duda');
  });

  it('cuts it at the longest question', () => {
    expect(appendDictation('abc', 'defgh', 6)).toBe('abc de');
  });
});
