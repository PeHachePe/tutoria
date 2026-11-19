import type { EnrolledStudent } from '../../data/group-service';
import { filterStudents } from './student-filter';

const STUDENTS: EnrolledStudent[] = [
  { enrollmentId: '1', student: { id: 'a', name: 'Álvaro Gil', email: 'alvaro@tutoria.test' } },
  { enrollmentId: '2', student: { id: 'b', name: 'Lucía Martín', email: 'lucia@tutoria.test' } },
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
