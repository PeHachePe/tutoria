import type { Role } from '../data/user';
import { homeOrLogin, homePath } from './home-path';

describe('homePath', () => {
  it.each<[Role, string]>([
    ['student', '/alumno'],
    ['teacher', '/docente/en-vivo'],
    ['admin', '/admin/usuarios'],
  ])('sends a %s to %s', (role, path) => {
    expect(homePath(role)).toBe(path);
  });
});

describe('homeOrLogin', () => {
  it('is the home of the role when there is a session', () => {
    expect(homeOrLogin('teacher')).toBe('/docente/en-vivo');
  });

  it('is the login without a session', () => {
    expect(homeOrLogin(undefined)).toBe('/login');
  });
});
