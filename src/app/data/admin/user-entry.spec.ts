import { USERS } from '../mock/fixtures/users';
import { toUserEntry } from './user-entry';

const [, marta, , lucia] = USERS;

describe('toUserEntry', () => {
  it('counts the groups taught and the enrollments, and names each group once, in order', () => {
    expect(toUserEntry(marta, ['1.º DAW B', '1.º DAW A', '1.º DAW B'], [])).toEqual({
      user: marta,
      groupNames: ['1.º DAW A', '1.º DAW B'],
      links: { groups: 3, enrollments: 0 },
      classes: [],
    });
  });

  it('names the groups of the enrollments too', () => {
    expect(toUserEntry(lucia, [], ['1.º DAW A'])).toEqual({
      user: lucia,
      groupNames: ['1.º DAW A'],
      links: { groups: 0, enrollments: 1 },
      classes: [],
    });
  });

  it('keeps the classes of a student, the latest first (5.2g)', () => {
    const entry = toUserEntry(
      lucia,
      [],
      [],
      [
        { name: '1.º DAW A', schoolYear: '2025/26', outcome: 'promotes' },
        { name: '2.º DAW A', schoolYear: '2026/27', outcome: null },
        { name: '1.º DAM B', schoolYear: '2025/26', outcome: 'leaves' },
      ],
    );
    expect(entry.classes.map(({ name, schoolYear }) => `${name} ${schoolYear}`)).toEqual([
      '2.º DAW A 2026/27',
      '1.º DAM B 2025/26',
      '1.º DAW A 2025/26',
    ]);
  });
});
