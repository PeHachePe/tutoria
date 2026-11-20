import type { ManagedClass, ManagedGroup, RosterStudent } from '../../data/group-service';
import { SUBJECTS } from '../../data/mock/fixtures/subjects';
import { CLASSES, DAW_CLASS_ID, TEACHER_ID } from '../../data/mock/fixtures/users';
import {
  classSubjectsOf,
  labelClasses,
  nextSplitLabel,
  rosterColumns,
  rosterCsv,
  rosterFileName,
  sortClassGroups,
  subjectInitials,
  subjectLine,
} from './class-list';

const [basic, advanced, web] = SUBJECTS;

function managed(
  id: string,
  subject = basic,
  label: string | null = null,
  teacherName = 'Marta Ibáñez Soler',
): ManagedGroup {
  return {
    group: { id, classId: DAW_CLASS_ID, subjectId: subject.id, label, teacherId: TEACHER_ID },
    subject,
    teacherName,
    studentCount: 0,
    started: false,
    mine: true,
  };
}

const BASIC = managed('basic');
const ENGLISH = managed('english', basic, 'Desdoble inglés');
const AFTERNOON = managed('afternoon', basic, 'Desdoble tarde');
const WEB = managed('web', web);

function student(
  member: boolean,
  groupIds: string[],
  name = 'Ana',
  email = 'ana@tutoria.test',
): RosterStudent {
  return { student: { id: name, name, email }, active: true, member, groupIds };
}

describe('labelClasses', () => {
  it('names each class by its name and year, keeping their order', () => {
    const classes: ManagedClass[] = CLASSES.map((schoolClass) => ({
      schoolClass,
      groups: [],
      canEdit: false,
      open: true,
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

describe('classSubjectsOf', () => {
  it('reads each group as its subject, its label and its teacher', () => {
    expect(classSubjectsOf([BASIC, ENGLISH])).toEqual([
      { subjectId: basic.id, label: null, teacherName: 'Marta Ibáñez Soler' },
      { subjectId: basic.id, label: 'Desdoble inglés', teacherName: 'Marta Ibáñez Soler' },
    ]);
  });
});

describe('nextSplitLabel', () => {
  const of = (...groups: ManagedGroup[]) => classSubjectsOf(groups);

  it('starts at «Desdoble 1», with the group of the whole class or without it', () => {
    expect(nextSplitLabel(of(BASIC, WEB), basic.id)).toBe('Desdoble 1');
    expect(nextSplitLabel(of(WEB), advanced.id)).toBe('Desdoble 1');
  });

  it('numbers the next split after the splits of the subject', () => {
    expect(nextSplitLabel(of(BASIC, ENGLISH), basic.id)).toBe('Desdoble 2');
    expect(nextSplitLabel(of(ENGLISH), basic.id)).toBe('Desdoble 2');
  });

  it('skips the numbers already taken', () => {
    const second = managed('second', basic, 'Desdoble 2');
    const third = managed('third', basic, 'Desdoble 3');
    expect(nextSplitLabel(of(BASIC, second), basic.id)).toBe('Desdoble 3');
    expect(nextSplitLabel(of(BASIC, second, third), basic.id)).toBe('Desdoble 4');
  });
});

describe('subjectInitials', () => {
  it('takes the first letter of each word, leaving out the minor ones', () => {
    expect(subjectInitials('Programación básica')).toBe('PB');
    expect(subjectInitials('Desarrollo web en entorno cliente')).toBe('DWEC');
    expect(subjectInitials('Bases de Datos')).toBe('BD');
    expect(subjectInitials('  Sistemas   informáticos ')).toBe('SI');
  });

  it('keeps the first three letters of a name of one word', () => {
    expect(subjectInitials('Programación')).toBe('PRO');
    // Its minor words do not count
    expect(subjectInitials('Física y')).toBe('FÍS');
  });
});

describe('rosterColumns', () => {
  it('heads each group with its initials, its split and the first name of its teacher', () => {
    const javier = managed('english', basic, 'Desdoble inglés', 'Javier Ortega Ruiz');
    const columns = rosterColumns([WEB, BASIC, javier], 'es');

    expect(columns.map((column) => column.managed)).toEqual([WEB, BASIC, javier]);
    expect(columns.map(({ initials, detail, title }) => ({ initials, detail, title }))).toEqual([
      { initials: 'DWEC', detail: 'Marta', title: 'Desarrollo web en entorno cliente' },
      { initials: 'PB', detail: 'Marta', title: 'Programación básica' },
      {
        initials: 'PB',
        detail: 'Desdoble inglés · Javier',
        title: 'Programación básica · Desdoble inglés',
      },
    ]);
  });

  it('names the subjects in the language of the interface', () => {
    expect(rosterColumns([BASIC], 'en')[0].initials).toBe('BP');
  });
});

describe('rosterCsv', () => {
  const columns = rosterColumns([BASIC, ENGLISH, WEB], 'es');

  it('has a head with the groups and a line per student, with Sí or No', () => {
    const csv = rosterCsv(
      [student(true, ['basic', 'web']), student(false, ['english'], 'Bruno', 'bruno@tutoria.test')],
      columns,
    );

    expect(csv).toBe(
      'Nombre;Correo;En la clase;Programación básica;Programación básica · Desdoble inglés;' +
        'Desarrollo web en entorno cliente\r\n' +
        'Ana;ana@tutoria.test;Sí;Sí;No;Sí\r\n' +
        'Bruno;bruno@tutoria.test;No;No;Sí;No\r\n',
    );
  });

  it('quotes a field with a separator, a quote or a line break, doubling its quotes', () => {
    const csv = rosterCsv(
      [
        student(true, [], 'Ana; la "Rubia"'),
        student(true, [], 'Bruno\nSanz', 'bruno@tutoria.test'),
        student(true, [], 'Carla\rRey', 'carla@tutoria.test'),
      ],
      [],
    );

    expect(csv.split('\r\n')).toEqual([
      'Nombre;Correo;En la clase',
      '"Ana; la ""Rubia""";ana@tutoria.test;Sí',
      '"Bruno\nSanz";bruno@tutoria.test;Sí',
      '"Carla\rRey";carla@tutoria.test;Sí',
      '',
    ]);
  });

  it('is only its head without students', () => {
    expect(rosterCsv([], [])).toBe('Nombre;Correo;En la clase\r\n');
  });
});

describe('rosterFileName', () => {
  it('names the file after the class and its year, without a slash', () => {
    expect(rosterFileName('1.º DAW A', '2026/27')).toBe('1.º DAW A 2026-27.csv');
  });
});
