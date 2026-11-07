import { afterSignInPath } from './after-sign-in-path';

describe('afterSignInPath', () => {
  it('goes to the root, which leads to the home of the role, without a redirect', () => {
    expect(afterSignInPath(undefined)).toBe('/');
    expect(afterSignInPath('')).toBe('/');
  });

  it('goes back to the page asked for without a session', () => {
    expect(afterSignInPath('/docente/historico')).toBe('/docente/historico');
    expect(afterSignInPath('/alumno/ejercicio/42?tab=tutor')).toBe(
      '/alumno/ejercicio/42?tab=tutor',
    );
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    'docente',
  ])('ignores %s, which is not a path of the app', (redirect) => {
    expect(afterSignInPath(redirect)).toBe('/');
  });

  it('does not go back to the login', () => {
    expect(afterSignInPath('/login')).toBe('/');
    expect(afterSignInPath('/login?redirect=%2Falumno')).toBe('/');
  });
});
