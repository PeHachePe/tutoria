import type { Role } from '../data/user';
import { homePath } from './home-path';

describe('homePath', () => {
  it.each<[Role, string]>([
    ['student', '/alumno'],
    ['teacher', '/docente/en-vivo'],
    ['admin', '/admin/usuarios'],
  ])('sends a %s to %s', (role, path) => {
    expect(homePath(role)).toBe(path);
  });
});
