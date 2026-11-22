import { closingSentence } from './closing-sentence';

describe('closingSentence', () => {
  it('says nothing when everything was said', () => {
    expect(closingSentence({ code: false, buttons: [], said: 0 }, 'es')).toBeNull();
  });

  it('says the code is in the chat in turns, never twice the same in a row', () => {
    const said = [0, 1, 2, 3].map((count) =>
      closingSentence({ code: true, buttons: [], said: count }, 'es'),
    );
    expect(said).toEqual([
      'Te dejo el código en el chat.',
      'El código lo tienes en el chat.',
      'Échale un ojo al código en el chat.',
      'Te dejo el código en el chat.',
    ]);
  });

  it('names the button it leaves, or the buttons', () => {
    expect(closingSentence({ code: false, buttons: ['Ejecutar las pruebas'], said: 0 }, 'es')).toBe(
      'Te dejo en el chat el botón Ejecutar las pruebas.',
    );
    expect(
      closingSentence(
        { code: false, buttons: ['Aplicar la corrección', 'Ejecutar las pruebas'], said: 0 },
        'es',
      ),
    ).toBe('Te dejo en el chat los botones Aplicar la corrección y Ejecutar las pruebas.');
  });

  it('says the code and the button in one sentence', () => {
    expect(
      closingSentence({ code: true, buttons: ['Poner la función en el editor'], said: 1 }, 'es'),
    ).toBe('Te dejo en el chat el código y el botón Poner la función en el editor.');
    expect(closingSentence({ code: true, buttons: ['Uno', 'Dos', 'Tres'], said: 0 }, 'es')).toBe(
      'Te dejo en el chat el código y los botones Uno, Dos y Tres.',
    );
  });

  it('joins the buttons as the language does', () => {
    expect(closingSentence({ code: false, buttons: ['Run', 'Submit'], said: 0 }, 'en')).toContain(
      'Run and Submit',
    );
  });
});
