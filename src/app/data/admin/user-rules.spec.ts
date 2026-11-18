import { normalizeEmail, type UserLinks, userChangeProblem } from './user-rules';

const ADMIN = { id: 'admin', role: 'admin', status: 'active' };
const TEACHER = { id: 'marta', role: 'teacher', status: 'active' };
const STUDENT = { id: 'lucia', role: 'student', status: 'active' };
const FREE: UserLinks = { groups: 0, enrollments: 0 };

describe('user rules', () => {
  describe('userChangeProblem', () => {
    it('keeps the administrator from taking away their own role', () => {
      expect(userChangeProblem('admin', ADMIN, { role: 'teacher' }, FREE)).toBe('own_role');
      expect(userChangeProblem('admin', ADMIN, { role: 'student' }, FREE)).toBe('own_role');
    });

    it('keeps the administrator from disabling themselves', () => {
      expect(userChangeProblem('admin', ADMIN, { status: 'disabled' }, FREE)).toBe('own_status');
    });

    it('lets the administrator stay an active administrator', () => {
      expect(userChangeProblem('admin', ADMIN, { role: 'admin', status: 'active' }, FREE)).toBe(
        null,
      );
      expect(userChangeProblem('admin', ADMIN, {}, FREE)).toBe(null);
    });

    it('keeps the role of someone who teaches groups', () => {
      expect(userChangeProblem('admin', TEACHER, { role: 'student' }, { ...FREE, groups: 2 })).toBe(
        'has_groups',
      );
    });

    it('keeps the role of someone enrolled in groups', () => {
      expect(
        userChangeProblem('admin', STUDENT, { role: 'teacher' }, { ...FREE, enrollments: 1 }),
      ).toBe('has_enrollments');
    });

    it('tells the own role before the groups', () => {
      expect(userChangeProblem('admin', ADMIN, { role: 'teacher' }, { ...FREE, groups: 1 })).toBe(
        'own_role',
      );
    });

    it('does not count the same role or status as a change', () => {
      const links = { groups: 1, enrollments: 1 };
      expect(userChangeProblem('admin', TEACHER, { role: 'teacher' }, links)).toBe(null);
      expect(userChangeProblem('admin', ADMIN, { status: 'active' }, FREE)).toBe(null);
    });

    it('lets the role change without groups nor enrollments', () => {
      expect(userChangeProblem('admin', STUDENT, { role: 'teacher' }, FREE)).toBe(null);
    });

    it('lets others be disabled, also with groups', () => {
      expect(
        userChangeProblem('admin', TEACHER, { status: 'disabled' }, { ...FREE, groups: 2 }),
      ).toBe(null);
    });
  });

  describe('normalizeEmail', () => {
    it('trims and lowers the address', () => {
      expect(normalizeEmail('  Lucia.Perez@Tutoria.TEST ')).toBe('lucia.perez@tutoria.test');
    });
  });
});
