import type { PlannedBlock, PlannedGroup } from '../../data/block-service';
import type { ManagedClass, ManagedGroup } from '../../data/group-service';
import type { TeacherData } from '../../teacher/teacher-guide/teacher-facts';
import { adminFacts, adminScreen } from './admin-facts';

/** A group the administration does not teach, with this many students. */
function group(studentCount = 0): ManagedGroup {
  return { mine: false, studentCount, started: false } as ManagedGroup;
}

function managedClass(groups: readonly ManagedGroup[], open = true): ManagedClass {
  return {
    schoolClass: { id: 'c', createdBy: 'marta' },
    groups,
    canEdit: true,
    open,
  } as ManagedClass;
}

/** A group with a block per number, each with that many exercises assigned. */
function plan(assignments: number[]): TeacherData['plans'][number] {
  const block = (count: number) =>
    ({ assignments: Array.from({ length: count }, () => ({})) }) as unknown as PlannedBlock;
  return { group: { id: 'g' } as PlannedGroup, blocks: assignments.map(block) };
}

function data(changes: Partial<TeacherData> = {}): TeacherData {
  return { userId: 'admin', classes: [], bank: [], plans: [], url: '/admin/usuarios', ...changes };
}

describe('admin facts', () => {
  it('knows nothing of an empty centre, with the pages of the teacher and its own', () => {
    const facts = adminFacts(data());

    expect([...facts.known]).toEqual([]);
    expect(facts.places).toMatchObject({
      live: ['/docente/en-vivo'],
      groups: ['/docente/grupos'],
      attempt: [],
      users: ['/admin/usuarios'],
      system: ['/admin/sistema'],
    });
  });

  it('counts what exists in the centre, whoever made it (D-096)', () => {
    const facts = adminFacts(
      data({ classes: [managedClass([group(3)])], plans: [plan([]), plan([0, 2])] }),
    );

    expect([...facts.known]).toEqual(['hasClass', 'hasStudents', 'hasBlock', 'hasAssignment']);
  });

  it('needs an open class with a subject, students in one, and an exercise in a block', () => {
    const facts = adminFacts(
      data({
        classes: [managedClass([]), managedClass([group(5)], false), managedClass([group()])],
        plans: [plan([0])],
      }),
    );

    expect([...facts.known]).toEqual(['hasClass', 'hasBlock']);
  });

  it('tells its own screens from those of the teacher', () => {
    expect(adminScreen('/admin/usuarios?rol=student')).toBe('users');
    expect(adminScreen('/admin/sistema')).toBe('system');
    expect(adminScreen('/docente/grupos')).toBe('groups');
    expect(adminScreen('/dev/ui')).toBeUndefined();
  });
});
