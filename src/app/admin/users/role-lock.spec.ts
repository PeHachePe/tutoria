import { toUserEntry } from '../../data/admin/user-entry';
import { ADMIN_ID, USERS } from '../../data/mock/fixtures/users';
import { roleLock } from './role-lock';

const [admin, marta, , lucia] = USERS;

describe('roleLock', () => {
  it('keeps the administration in its own role', () => {
    expect(roleLock(toUserEntry(admin, [], []), ADMIN_ID)).toMatch(/tu propio rol/);
  });

  it('names the groups of a teacher and of a student', () => {
    expect(roleLock(toUserEntry(marta, ['1.º DAW A'], []), ADMIN_ID)).toBe(
      'Tiene a su cargo 1.º DAW A: reasigna sus grupos antes de cambiarle el rol.',
    );
    expect(roleLock(toUserEntry(lucia, [], ['1.º DAW A', '1.º DAM B']), ADMIN_ID)).toBe(
      'Tiene matrícula en 1.º DAM B, 1.º DAW A: dale de baja de sus grupos antes de cambiarle el rol.',
    );
  });

  it('lets the role of anyone else change', () => {
    expect(roleLock(toUserEntry(lucia, [], []), ADMIN_ID)).toBeNull();
  });
});
