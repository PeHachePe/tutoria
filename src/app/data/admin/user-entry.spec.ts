import { USERS } from '../mock/fixtures/users';
import { toUserEntry } from './user-entry';

const [, marta, , lucia] = USERS;

describe('toUserEntry', () => {
  it('counts the groups taught and the enrollments, and names each group once, in order', () => {
    expect(toUserEntry(marta, ['1.º DAW B', '1.º DAW A', '1.º DAW B'], [])).toEqual({
      user: marta,
      groupNames: ['1.º DAW A', '1.º DAW B'],
      links: { groups: 3, enrollments: 0 },
    });
  });

  it('names the groups of the enrollments too', () => {
    expect(toUserEntry(lucia, [], ['1.º DAW A'])).toEqual({
      user: lucia,
      groupNames: ['1.º DAW A'],
      links: { groups: 0, enrollments: 1 },
    });
  });
});
