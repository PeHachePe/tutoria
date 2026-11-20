import type { ManagedClass, ManagedGroup, RosterStudent } from '../../data/group-service';
import { SUBJECTS } from '../../data/mock/fixtures/subjects';
import { CLASSES, DAW_CLASS_ID, TEACHER_ID } from '../../data/mock/fixtures/users';
import {
  labelClasses,
  nextSplitLabel,
  rosterNote,
  sortClassGroups,
  subjectLine,
} from './class-list';

const [basic, advanced, web] = SUBJECTS;

function managed(id: string, subject = basic, label: string | null = null): ManagedGroup {
  return {
    group: { id, classId: DAW_CLASS_ID, subjectId: subject.id, label, teacherId: TEACHER_ID },
    subject,
    teacherName: 'Marta',
    studentCount: 0,
    started: false,
    mine: true,
  };
}

const BASIC = managed('basic');
const ENGLISH = managed('english', basic, 'Desdoble inglés');
const AFTERNOON = managed('afternoon', basic, 'Desdoble tarde');
const WEB = managed('web', web);

function student(member: boolean, groupIds: string[]): RosterStudent {
  return {
    student: { id: 'ana', name: 'Ana', email: 'ana@tutoria.test' },
    active: true,
    member,
    groupIds,
  };
}

describe('labelClasses', () => {
  it('names each class by its name and year, keeping their order', () => {
    const classes: ManagedClass[] = CLASSES.map((schoolClass) => ({
      schoolClass,
      groups: [],
      canEdit: false,
    }));
    expect(labelClasses(classes).map(({ id, label }) => ({ id, label }))).toEqual([
      { id: CLASSES[0].id, label: '1.º DAW A · 2026/27' },
      { id: CLASSES[1].id, label: '1.º DAM B · 2026/27' },
    ]);
    expect(labelClasses(classes)[0].managed).toBe(classes[0]);
  });
});

describe('subjectLine', () => {
  it('names a group by its subject, and a split by its label too', () => {
    expect(subjectLine(BASIC, 'es')).toBe('Programación básica');
    expect(subjectLine(ENGLISH, 'es')).toBe('Programación básica · Desdoble inglés');
    expect(subjectLine(ENGLISH, 'en')).toBe('Basic programming · Desdoble inglés');
  });
});

describe('sortClassGroups', () => {
  it('orders by subject, the group of the whole class before its splits', () => {
    const sorted = sortClassGroups([AFTERNOON, WEB, ENGLISH, BASIC], 'es');
    expect(sorted.map(({ group }) => group.id)).toEqual(['web', 'basic', 'english', 'afternoon']);
    for (const groups of [
      [BASIC, ENGLISH],
      [ENGLISH, BASIC],
    ]) {
      expect(sortClassGroups(groups, 'es')).toEqual([BASIC, ENGLISH]);
    }
  });

  it('orders the subjects as the interface names them, without changing the list given', () => {
    const groups = [WEB, BASIC];
    // In Spanish «Desarrollo web…» goes before «Programación básica»; in English, after
    expect(sortClassGroups(groups, 'en').map(({ group }) => group.id)).toEqual(['basic', 'web']);
    expect(groups).toEqual([WEB, BASIC]);
  });
});

describe('nextSplitLabel', () => {
  it('is null for a subject the class does not have', () => {
    expect(nextSplitLabel([BASIC, WEB], advanced.id)).toBeNull();
  });

  it('numbers the next split after the groups of the subject', () => {
    expect(nextSplitLabel([BASIC, WEB], basic.id)).toBe('Desdoble 2');
    expect(nextSplitLabel([BASIC, ENGLISH], basic.id)).toBe('Desdoble 3');
  });

  it('skips the numbers already taken', () => {
    const third = managed('third', basic, 'Desdoble 3');
    const fourth = managed('fourth', basic, 'Desdoble 4');
    expect(nextSplitLabel([BASIC, third], basic.id)).toBe('Desdoble 4');
    expect(nextSplitLabel([BASIC, third, fourth], basic.id)).toBe('Desdoble 5');
  });
});

describe('rosterNote', () => {
  const groups = [BASIC, ENGLISH, WEB];

  it('says nothing of a member in every group of the class and no split', () => {
    expect(rosterNote(student(true, ['basic', 'web']), groups, 'es')).toBeNull();
  });

  it('says which subjects of the class a member does not take', () => {
    expect(rosterNote(student(true, ['web']), groups, 'es')).toBe('No cursa: Programación básica');
    expect(rosterNote(student(true, []), groups, 'es')).toBe(
      'No cursa: Programación básica, Desarrollo web en entorno cliente',
    );
  });

  it('names the splits of a member, after what they do not take', () => {
    expect(rosterNote(student(true, ['basic', 'english', 'web']), groups, 'es')).toBe(
      'Programación básica · Desdoble inglés',
    );
    expect(rosterNote(student(true, ['english']), groups, 'es')).toBe(
      'No cursa: Programación básica, Desarrollo web en entorno cliente · ' +
        'Programación básica · Desdoble inglés',
    );
  });

  it('says what a student of another class takes in this one', () => {
    expect(rosterNote(student(false, ['web', 'english']), groups, 'es')).toBe(
      'De otra clase: Programación básica · Desdoble inglés, Desarrollo web en entorno cliente',
    );
  });
});
