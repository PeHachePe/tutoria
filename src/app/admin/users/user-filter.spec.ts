import { toUserEntry } from '../../data/admin/user-entry';
import { USERS } from '../../data/mock/fixtures/users';
import { filterUsers, NO_USER_FILTERS, type UserFilters } from './user-filter';

const ENTRIES = USERS.map((user) => toUserEntry(user, [], []));

function emails(filters: Partial<UserFilters>): string[] {
  return filterUsers(ENTRIES, { ...NO_USER_FILTERS, ...filters }).map(({ user }) =>
    user.email.replace('@tutoria.test', ''),
  );
}

describe('filterUsers', () => {
  it('keeps the active accounts without filters', () => {
    expect(emails({})).toHaveLength(USERS.length - 1);
    expect(emails({})).not.toContain('raul.medina');
  });

  it('shows the disabled accounts alone, or every account', () => {
    expect(emails({ status: 'disabled' })).toEqual(['raul.medina']);
    expect(emails({ status: 'all' })).toHaveLength(USERS.length);
  });

  it('searches the name and the email, without accents nor capitals', () => {
    expect(emails({ search: 'IBÁÑEZ' })).toEqual(['marta.ibanez']);
    expect(emails({ search: 'lucia martin' })).toEqual(['lucia.martin']);
    expect(emails({ search: 'okafor@' })).toEqual(['samuel.okafor']);
    expect(emails({ search: '   ' })).toHaveLength(USERS.length - 1);
  });

  it('filters by role', () => {
    expect(emails({ role: 'teacher' })).toEqual(['marta.ibanez', 'javier.ortega']);
    expect(emails({ role: 'admin' })).toEqual(['admin']);
  });

  it('applies the three at once', () => {
    expect(emails({ role: 'student', status: 'all', search: 'medina' })).toEqual(['raul.medina']);
    expect(emails({ role: 'teacher', search: 'medina' })).toEqual([]);
  });
});
