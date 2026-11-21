import { listenErrorMessage } from './listen-error-message';

describe('listenErrorMessage', () => {
  it.each([
    ['not-allowed', 'No tengo permiso para usar el micrófono'],
    ['no-microphone', 'No encuentro ningún micrófono'],
    ['service-unavailable', 'El reconocimiento de voz no está disponible ahora'],
    ['language-not-supported', 'Tu navegador no reconoce la voz en español'],
  ] as const)('says what to do about %s, and that typing still works', (error, text) => {
    const message = listenErrorMessage(error, 'es');

    expect(message).toContain(text);
    expect(message).toMatch(/escribiendo/);
  });

  it('names the language it could not recognise', () => {
    expect(listenErrorMessage('language-not-supported', 'ca')).toContain('en catalán');
  });
});
