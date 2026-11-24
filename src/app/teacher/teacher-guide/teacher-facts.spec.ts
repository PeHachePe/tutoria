import type { BankExercise } from '../../data/exercise-service';
import type { PlannedBlock, PlannedGroup } from '../../data/block-service';
import type { ManagedClass, ManagedGroup } from '../../data/group-service';
import { type TeacherData, teacherFacts, teacherScreen } from './teacher-facts';

const ME = 'marta';

function managedGroup(changes: Partial<ManagedGroup> = {}): ManagedGroup {
  return { mine: true, studentCount: 0, started: false, ...changes } as ManagedGroup;
}

function managedClass(
  groups: readonly ManagedGroup[],
  changes: { createdBy?: string; open?: boolean } = {},
): ManagedClass {
  return {
    schoolClass: { id: 'c', createdBy: changes.createdBy ?? 'otra' },
    groups,
    canEdit: true,
    open: changes.open ?? true,
  } as ManagedClass;
}

function bankExercise(createdBy: string, archivedAt: string | null = null): BankExercise {
  return { exercise: { id: createdBy, createdBy, archivedAt } } as BankExercise;
}

/** A group of theirs with a block per number, each with that many exercises assigned. */
function plan(id: string, assignments: number[] = []): TeacherData['plans'][number] {
  const block = (count: number) =>
    ({ assignments: Array.from({ length: count }, () => ({})) }) as unknown as PlannedBlock;
  return { group: { id } as PlannedGroup, blocks: assignments.map(block) };
}

function data(changes: Partial<TeacherData> = {}): TeacherData {
  return { userId: ME, classes: [], bank: [], plans: [], url: '/docente/en-vivo', ...changes };
}

describe('teacher facts', () => {
  it('knows nothing of a teacher who starts from scratch, with only the fixed pages', () => {
    const facts = teacherFacts(data());

    expect([...facts.known]).toEqual([]);
    expect(facts.places).toEqual({
      live: ['/docente/en-vivo'],
      history: ['/docente/historico'],
      exercises: ['/docente/ejercicios'],
      newExercise: ['/docente/ejercicios/nuevo'],
      blocks: ['/docente/bloques'],
      groups: ['/docente/grupos'],
      attempt: [],
    });
  });

  it('counts a class of theirs this year: created by them or with a subject of theirs', () => {
    const created = managedClass([], { createdBy: ME });
    const shared = managedClass([managedGroup()]);

    expect(teacherFacts(data({ classes: [created] })).known.has('hasClass')).toBe(true);
    expect(teacherFacts(data({ classes: [shared] })).known.has('hasClass')).toBe(true);
  });

  it('does not count the classes of others, nor those of a closed year', () => {
    const others = managedClass([managedGroup({ mine: false, studentCount: 20 })]);
    const closed = managedClass([managedGroup({ studentCount: 20 })], { open: false });

    const facts = teacherFacts(data({ classes: [others, closed] }));

    expect(facts.known.has('hasClass')).toBe(false);
    expect(facts.known.has('hasStudents')).toBe(false);
  });

  it('counts as enrolled only a subject of theirs with students', () => {
    const empty = managedClass([managedGroup(), managedGroup({ mine: false, studentCount: 3 })]);
    const enrolled = managedClass([managedGroup({ studentCount: 3 })]);

    expect(teacherFacts(data({ classes: [empty] })).known.has('hasStudents')).toBe(false);
    expect(teacherFacts(data({ classes: [enrolled] })).known.has('hasStudents')).toBe(true);
  });

  it('counts only their own exercises that are not archived', () => {
    const others = teacherFacts(data({ bank: [bankExercise('otra'), bankExercise(ME, 'ayer')] }));
    const own = teacherFacts(data({ bank: [bankExercise('otra'), bankExercise(ME)] }));

    expect(others.known.has('hasOwnExercise')).toBe(false);
    expect(own.known.has('hasOwnExercise')).toBe(true);
  });

  it('knows their blocks and assignments, and starts in the blocks of a group that has some', () => {
    const facts = teacherFacts(
      data({ plans: [plan('empty'), plan('web', [0]), plan('daw', [2])] }),
    );

    expect([...facts.known]).toEqual(['hasBlock', 'hasAssignment']);
    expect(facts.places.blocks).toEqual([
      '/docente/bloques?grupo=web',
      '/docente/bloques?grupo=daw',
      '/docente/bloques',
    ]);
  });

  it('has a block without an assignment, and no assignment without blocks', () => {
    expect([...teacherFacts(data({ plans: [plan('web', [0])] })).known]).toEqual(['hasBlock']);
  });

  it('has the detail of an attempt as a place only while it is open', () => {
    const url = '/docente/en-vivo/intento-1?grupo=daw';

    expect(teacherFacts(data({ url })).places.attempt).toEqual([url]);
  });

  describe('teacherScreen', () => {
    it('tells each screen of the teacher', () => {
      expect(teacherScreen('/docente/en-vivo?grupo=daw')).toBe('live');
      expect(teacherScreen('/docente/en-vivo/intento-1')).toBe('attempt');
      expect(teacherScreen('/docente/historico')).toBe('history');
      expect(teacherScreen('/docente/ejercicios')).toBe('exercise-bank');
      expect(teacherScreen('/docente/ejercicios/nuevo')).toBe('exercise-form');
      expect(teacherScreen('/docente/ejercicios/ejercicio-1')).toBe('exercise-form');
      expect(teacherScreen('/docente/bloques#tema')).toBe('blocks');
      expect(teacherScreen('/docente/grupos')).toBe('groups');
    });

    it('has none outside the screens of the teacher', () => {
      expect(teacherScreen('/admin/usuarios')).toBeUndefined();
      expect(teacherScreen('/docente')).toBeUndefined();
    });
  });
});
