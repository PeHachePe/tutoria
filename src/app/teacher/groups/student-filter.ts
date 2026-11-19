import type { EnrolledStudent } from '../../data/group-service';
import { searchable } from '../../shared/searchable';

/** From how many students a panel offers to filter them: fewer are read at a glance. */
export const STUDENT_FILTER_THRESHOLD = 10;

/** The students whose name or email has the text, without accents nor capitals. */
export function filterStudents(
  students: readonly EnrolledStudent[],
  text: string,
): readonly EnrolledStudent[] {
  const wanted = searchable(text.trim());
  if (wanted === '') return students;
  return students.filter(({ student }) =>
    searchable(`${student.name} ${student.email}`).includes(wanted),
  );
}
