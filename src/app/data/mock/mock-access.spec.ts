import type { ClassMember, SchoolClass } from '../user';
import { lastClassOf } from './mock-access';

const schoolClass = (id: string, name: string, schoolYear: string): SchoolClass => ({
  id,
  name,
  schoolYear,
  createdBy: null,
  createdAt: '',
  reopened: false,
});

describe('lastClassOf (5.2g)', () => {
  const classes = [
    schoolClass('a', '1.º DAW B', '2026/27'),
    schoolClass('b', '1.º DAW A', '2026/27'),
    schoolClass('c', '1.º DAW A', '2025/26'),
  ];
  const member = (classId: string): ClassMember => ({ classId, userId: 'ana', outcome: null });

  it('is the class of the latest year up to the one given, and of two of a year that of the first name', () => {
    const tables = { classes, classMembers: [member('a'), member('b'), member('c')] };

    expect(lastClassOf(tables, 'ana')?.schoolClass.id).toBe('b');
    expect(lastClassOf(tables, 'ana', '2025/26')?.schoolClass.id).toBe('c');
    expect(lastClassOf(tables, 'ana', '2024/25')).toBeNull();
  });
});
