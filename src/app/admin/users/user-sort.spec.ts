import { toUserEntry } from '../../data/admin/user-entry';
import { USERS } from '../../data/mock/fixtures/users';
import { sortUsers } from './user-sort';

const [admin, marta, javier, lucia] = USERS;
const ENTRIES = [
  toUserEntry(lucia, [], ['1.º DAW A']),
  toUserEntry(admin, [], []),
  toUserEntry(marta, ['1.º DAW A'], []),
  toUserEntry(javier, ['1.º DAM B'], []),
];

function names(column: string, direction: 'asc' | 'desc' | ''): string[] {
  return sortUsers(ENTRIES, { active: column, direction }).map(
    ({ user }) => user.name.split(' ')[0],
  );
}

describe('sortUsers', () => {
  it('goes by name without a sort, as the list comes', () => {
    expect(names('', '')).toEqual(['Administración', 'Javier', 'Lucía', 'Marta']);
    expect(names('name', '')).toEqual(['Administración', 'Javier', 'Lucía', 'Marta']);
    expect(names('email', 'asc')).toEqual(['Administración', 'Javier', 'Lucía', 'Marta']);
  });

  it('sorts by name both ways', () => {
    expect(names('name', 'desc')).toEqual(['Marta', 'Lucía', 'Javier', 'Administración']);
  });

  it('sorts by role, from students to administration, and by name inside each one', () => {
    expect(names('role', 'asc')).toEqual(['Lucía', 'Javier', 'Marta', 'Administración']);
    expect(names('role', 'desc')).toEqual(['Administración', 'Javier', 'Marta', 'Lucía']);
  });

  it('sorts by groups, those without any last', () => {
    expect(names('groups', 'asc')).toEqual(['Javier', 'Lucía', 'Marta', 'Administración']);
    expect(names('groups', 'desc')).toEqual(['Administración', 'Lucía', 'Marta', 'Javier']);
  });
});
