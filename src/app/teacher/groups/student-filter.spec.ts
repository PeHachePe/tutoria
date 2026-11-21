import type { RosterStudent } from '../../data/group-service';
import { filterStudents } from './student-filter';

const STUDENTS: RosterStudent[] = [
  {
    student: { id: 'a', name: 'Álvaro Gil', email: 'alvaro@tutoria.test' },
    active: true,
    member: true,
    outcome: null,
    otherClass: null,
    groupIds: [],
  },
  {
    student: { id: 'b', name: 'Lucía Martín', email: 'lucia@tutoria.test' },
    active: true,
    member: true,
    outcome: null,
    otherClass: null,
    groupIds: [],
  },
];

describe('filterStudents', () => {
  it('keeps everybody without a text', () => {
    expect(filterStudents(STUDENTS, '  ')).toBe(STUDENTS);
  });

  it('finds by name without accents nor capitals, and by email', () => {
    expect(filterStudents(STUDENTS, 'ALVARO')).toEqual([STUDENTS[0]]);
    expect(filterStudents(STUDENTS, 'lucia@')).toEqual([STUDENTS[1]]);
    expect(filterStudents(STUDENTS, 'zz')).toEqual([]);
  });
});
