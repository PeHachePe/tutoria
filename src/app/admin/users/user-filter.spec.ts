import { toUserEntry } from '../../data/admin/user-entry';
import { USERS } from '../../data/mock/fixtures/users';
import type { PreviousClass } from '../../data/group-service';
import { filterUsers, NO_USER_FILTERS, studentSituation, type UserFilters } from './user-filter';

/** The year the tests are in. */
const THIS_YEAR = '2026/27';

/** Lucía is in a class this year; Hugo left last year's; Samuel repeats and has no class yet. */
const CLASSES: Readonly<Record<string, readonly PreviousClass[]>> = {
  'lucia.martin@tutoria.test': [{ name: '1.º DAW A', schoolYear: THIS_YEAR, outcome: null }],
  'hugo.sanchez@tutoria.test': [{ name: '1.º DAW A', schoolYear: '2025/26', outcome: 'leaves' }],
  'samuel.okafor@tutoria.test': [{ name: '1.º DAW A', schoolYear: '2025/26', outcome: 'repeats' }],
};

const ENTRIES = USERS.map((user) => toUserEntry(user, [], [], CLASSES[user.email]));

function emails(filters: Partial<UserFilters>): string[] {
  return filterUsers(ENTRIES, { ...NO_USER_FILTERS, ...filters }, THIS_YEAR).map(({ user }) =>
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

describe('the situation of a student (5.2g)', () => {
  const entryOf = (email: string) => ENTRIES.find(({ user }) => user.email === email)!;

  it('is in a class this year, without one, or finished in their last class', () => {
    expect(studentSituation(entryOf('lucia.martin@tutoria.test'), THIS_YEAR)).toBe('in_class');
    expect(studentSituation(entryOf('hugo.sanchez@tutoria.test'), THIS_YEAR)).toBe('finished');
    expect(studentSituation(entryOf('samuel.okafor@tutoria.test'), THIS_YEAR)).toBe('no_class');
    // Never had a class
    expect(studentSituation(entryOf('marina.vidal@tutoria.test'), THIS_YEAR)).toBe('no_class');
  });

  it('counts the evaluation of this year too: who finished it is finished', () => {
    const entry = toUserEntry(
      entryOf('lucia.martin@tutoria.test').user,
      [],
      [],
      [{ name: '2.º DAW A', schoolYear: THIS_YEAR, outcome: 'graduates' }],
    );
    expect(studentSituation(entry, THIS_YEAR)).toBe('finished');
  });

  it('is none for a teacher or the administration', () => {
    expect(studentSituation(entryOf('marta.ibanez@tutoria.test'), THIS_YEAR)).toBeNull();
  });

  it('filters the students by it', () => {
    expect(emails({ situation: 'finished' })).toEqual(['hugo.sanchez']);
    expect(emails({ situation: 'in_class' })).toEqual(['lucia.martin']);
    expect(emails({ situation: 'no_class' })).toContain('samuel.okafor');
    expect(emails({ situation: 'no_class' })).not.toContain('marta.ibanez');
  });
});
