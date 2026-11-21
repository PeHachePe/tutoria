import type { ClassBlock, ExerciseAssignment } from '../../exercise';
import { schoolYearShiftDays } from '../../school-year-shift';
import type {
  AppUser,
  ClassGroup,
  ClassMember,
  ClassOutcome,
  Enrollment,
  SchoolClass,
} from '../../user';
import type { MockDb } from '../mock-db';
import { ASSIGNMENTS, CLASS_BLOCKS } from './exercises';
import { fixtureId } from './fixture-id';
import { SUBJECTS } from './subjects';
import { OTHER_TEACHER_ID, TEACHER_ID } from './users';

/**
 * The school before this year (5.2d): five past years of DAW and DAM, each with its first and
 * second year, so the demo has classes to look back at and students who finished. Each intake of
 * eight starts first year, goes on to second the next and then finishes: those who finished have
 * their account disabled, as the administration does in June; the last intake is in second year
 * now. No attempts: the history of the teachers stays that of this year. Only last year's basic
 * programming of 1.º DAW A has blocks (5.2f): the four topics of this year, as Marta copied them,
 * to look at in a closed class and to copy again.
 *
 * Each class has its final evaluation (5.2g): first year promotes, second year graduates. Last year
 * is the exception, for the demo: 1.º DAW A, Marta's, is left to evaluate; in 2.º DAM B one student
 * repeats and one left the school, both without a class this year; and three who finished 2.º DAW A
 * still have their account active. The administration finds those four to disable.
 */

/** The first past year (2021/22) and the current one (2026/27), by the year they start. */
const FIRST_YEAR = 2021;
const CURRENT_YEAR = 2026;

/** Students of each intake of a cycle. */
const INTAKE_SIZE = 8;

/** Of the intake that finished 2.º DAW A last June, those whose account is still active (5.2g). */
const STILL_ACTIVE = 3;
/** Of that of 2.º DAM B, the one who repeats it and the one who left the school, by position. */
const REPEATS_AT = 6;
const LEAVES_AT = 7;

/** Where the ids of this history start, apart from those of this year. */
const USER_FROM = 100;
const CLASS_FROM = 100;
const GROUP_FROM = 100;
const ENROLLMENT_FROM = 10_000;

const FIRST_NAMES = [
  'Nerea',
  'Iván',
  'Paula',
  'Óscar',
  'Sara',
  'Gonzalo',
  'Marina',
  'Rubén',
  'Alicia',
  'Sergio',
  'Noelia',
  'Víctor',
  'Lorena',
  'Diego',
  'Carla',
  'Pablo',
  'Ainhoa',
  'Mario',
  'Celia',
  'Raúl',
  'Inés',
  'Héctor',
  'Julia',
  'Adrián',
  'Patricia',
  'Miguel',
  'Rocío',
  'Jaime',
  'Lidia',
  'Samuel',
  'Andrea',
  'Tomás',
] as const;

const SURNAMES = [
  'Prieto',
  'Lozano',
  'Castro',
  'Rubio',
  'Ortega',
  'Pastor',
  'Vidal',
  'Moya',
  'Santos',
  'Crespo',
  'Rey',
  'Garrido',
  'Herrero',
  'Nieto',
  'Benítez',
  'Cabrera',
  'Duran',
  'Iglesias',
  'Peña',
  'Soto',
  'Vega',
  'Román',
  'Calvo',
  'Ferrer',
  'Gil',
  'Lorenzo',
  'Méndez',
  'Pascual',
  'Roca',
  'Serrano',
  'Toledo',
  'Varela',
] as const;

type Cycle = 'DAW' | 'DAM';
const CYCLES: readonly Cycle[] = ['DAW', 'DAM'];

/** The class of each cycle and year: «1.º DAW A», «2.º DAM B». */
const CLASS_NAMES: Record<Cycle, readonly [string, string]> = {
  DAW: ['1.º DAW A', '2.º DAW A'],
  DAM: ['1.º DAM B', '2.º DAM B'],
};

/** Who created the classes of each cycle: Marta those of DAW, Javier those of DAM. */
const CREATORS: Record<Cycle, string> = { DAW: TEACHER_ID, DAM: OTHER_TEACHER_ID };

const M = TEACHER_ID;
const J = OTHER_TEACHER_ID;

/** The subjects of each class, with who teaches them; a split takes the first two of the class. */
const PLANS: Record<Cycle, readonly [FirstYear: Plan, SecondYear: Plan]> = {
  DAW: [
    [
      ['Programación básica', M],
      ['Bases de datos', J],
      ['Lenguajes de marcas', M],
      ['Sistemas informáticos', J],
    ],
    [
      ['Desarrollo web en entorno cliente', M],
      ['Desarrollo web en entorno cliente', J, 'Desdoble inglés'],
      ['Desarrollo web en entorno servidor', J],
      ['Despliegue de aplicaciones web', J],
      ['Diseño de interfaces web', M],
    ],
  ],
  DAM: [
    [
      ['Programación básica', J],
      ['Bases de datos', M],
      ['Entornos de desarrollo', J],
      ['Lenguajes de marcas', M],
    ],
    [
      ['Programación avanzada', J],
      ['Acceso a datos', M],
      ['Programación multimedia y dispositivos móviles', J],
      ['Desarrollo de interfaces', M],
    ],
  ],
};

type Plan = readonly (readonly [subject: string, teacherId: string, label?: string])[];

/** How many students of a class go to its split instead of the group of the whole class. */
const SPLIT_SIZE = 2;

/** The id of a subject of subjects.ts, by its name: those of the plans are all there. */
function subjectId(name: string): string {
  return SUBJECTS.find((row) => row.name === name)!.id;
}

function schoolYear(start: number): string {
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Without accents nor capitals, for an email: «Benítez» → «benitez». */
function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** The intakes, from that which was in second year in 2021/22 to that in second year now. */
const INTAKES = Array.from(
  { length: CURRENT_YEAR - FIRST_YEAR + 1 },
  (_, index) => FIRST_YEAR - 1 + index,
)
  .flatMap((start) => CYCLES.map((cycle) => ({ start, cycle })))
  .map((intake, index) => ({
    ...intake,
    // Finished in June of their second year: all but the intake in second year now
    finished: intake.start + 1 < CURRENT_YEAR,
    // Finished last June: their final evaluation still has loose ends
    last: intake.start + 2 === CURRENT_YEAR,
    studentIds: Array.from({ length: INTAKE_SIZE }, (_, n) =>
      fixtureId('user', USER_FROM + index * INTAKE_SIZE + n),
    ),
  }));

/** The final evaluation of a student of an intake in the second year of its cycle. */
function secondYearOutcome(intake: (typeof INTAKES)[number], n: number): ClassOutcome {
  if (!intake.last || intake.cycle !== 'DAM') return 'graduates';
  if (n === REPEATS_AT) return 'repeats';
  return n === LEAVES_AT ? 'leaves' : 'graduates';
}

/** Whether the account is still active: those of the last intake who did not finish are. */
function isStillActive(intake: (typeof INTAKES)[number], n: number): boolean {
  if (!intake.finished) return true;
  if (!intake.last) return false;
  return intake.cycle === 'DAW' ? n < STILL_ACTIVE : n === REPEATS_AT || n === LEAVES_AT;
}

export const HISTORY_USERS: readonly AppUser[] = INTAKES.flatMap((intakePlan, intake) => {
  const { start, studentIds } = intakePlan;
  return studentIds.map((id, n) => {
    // A name of three parts that no other student has: the third tells apart those of each round
    const i = intake * INTAKE_SIZE + n;
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const surname = SURNAMES[(i * 7) % SURNAMES.length];
    const second =
      SURNAMES[(i * 13 + Math.floor(i / FIRST_NAMES.length) * 3 + 5) % SURNAMES.length];
    const createdAt = `${start}-09-01T08:00:00.000Z`;
    return {
      id,
      name: `${first} ${surname} ${second}`,
      email: `${plain(first)}.${plain(surname)}.${plain(second)}@tutoria.test`,
      role: 'student' as const,
      status: isStillActive(intakePlan, n) ? ('active' as const) : ('disabled' as const),
      privacyNoticeSeenAt: null,
      createdAt,
      updatedAt: createdAt,
    };
  });
});

/** Each class of the history: its year, cycle and course, and the intake that fills it. */
const HISTORY_CLASS_PLAN = INTAKES.flatMap((intake) =>
  ([0, 1] as const)
    .map((course) => ({ ...intake, course, year: intake.start + course }))
    // Before the first past year there is nothing; this year's first year is the seed's own
    .filter(({ year, course }) => year >= FIRST_YEAR && (year < CURRENT_YEAR || course === 1)),
).map((plan, index) => ({ ...plan, classId: fixtureId('class', CLASS_FROM + index) }));

export const HISTORY_CLASSES: readonly SchoolClass[] = HISTORY_CLASS_PLAN.map(
  ({ classId, cycle, course, year }) => ({
    id: classId,
    name: CLASS_NAMES[cycle][course],
    schoolYear: schoolYear(year),
    createdBy: CREATORS[cycle],
    createdAt: `${year}-09-01T08:00:00.000Z`,
    reopened: false,
  }),
);

export const HISTORY_CLASS_MEMBERS: readonly ClassMember[] = HISTORY_CLASS_PLAN.flatMap((plan) =>
  plan.studentIds.map((userId, n) => ({
    classId: plan.classId,
    userId,
    outcome: outcomeIn(plan, n),
  })),
);

/** Of a class of the history: none this year, nor in last year's 1.º DAW A, left to evaluate. */
function outcomeIn(plan: (typeof HISTORY_CLASS_PLAN)[number], n: number): ClassOutcome | null {
  if (plan.year === CURRENT_YEAR) return null;
  if (plan.course === 1) return secondYearOutcome(plan, n);
  return plan.year + 1 === CURRENT_YEAR && plan.cycle === 'DAW' ? null : 'promotes';
}

const HISTORY_GROUP_PLAN = HISTORY_CLASS_PLAN.flatMap((plan) =>
  PLANS[plan.cycle][plan.course].map(([subject, teacherId, label]) => ({
    plan,
    subjectId: subjectId(subject),
    teacherId,
    label: label ?? null,
  })),
).map((group, index) => ({ ...group, id: fixtureId('group', GROUP_FROM + index) }));

export const HISTORY_GROUPS: readonly ClassGroup[] = HISTORY_GROUP_PLAN.map(
  ({ id, plan, subjectId: subject, teacherId, label }) => ({
    id,
    classId: plan.classId,
    label,
    teacherId,
    subjectId: subject,
  }),
);

/**
 * Everyone of the class in each of its groups, but as a school is: the first two in the split
 * instead of the group of the whole class of its subject, and in first year the last student has
 * markup languages validated.
 */
export const HISTORY_ENROLLMENTS: readonly Enrollment[] = HISTORY_GROUP_PLAN.flatMap(
  ({ id, plan, subjectId: subject, label }) => {
    const hasSplit = HISTORY_GROUP_PLAN.some(
      (other) => other.plan === plan && other.subjectId === subject && other.label !== null,
    );
    const validated =
      plan.course === 0 && subject === subjectId('Lenguajes de marcas')
        ? plan.studentIds.slice(-1)
        : [];
    const students =
      label !== null
        ? plan.studentIds.slice(0, SPLIT_SIZE)
        : plan.studentIds.filter(
            (userId, n) => !(hasSplit && n < SPLIT_SIZE) && !validated.includes(userId),
          );
    return students.map((userId) => ({ groupId: id, userId }));
  },
).map((enrollment, index) => ({
  id: fixtureId('enrollment', ENROLLMENT_FROM + index),
  ...enrollment,
}));

/** Where the ids of the blocks and assignments of the history start, apart from those of this year. */
const BLOCK_FROM = 100;
const ASSIGNMENT_FROM = 100_000;

/** The topics of this year that last year had too: the first four blocks of 1.º DAW A. */
const PAST_TOPICS = 4;

/** Last year's basic programming of 1.º DAW A, Marta's, which has the blocks of the history. */
const PAST_BLOCKS_GROUP = HISTORY_GROUP_PLAN.find(
  ({ plan, subjectId: subject }) =>
    plan.cycle === 'DAW' &&
    plan.course === 0 &&
    plan.year === CURRENT_YEAR - 1 &&
    subject === subjectId('Programación básica'),
)!;

/** The days from this year to the last in whole weeks, so a date keeps its weekday. */
const YEAR_BACK_DAYS = schoolYearShiftDays(schoolYear(CURRENT_YEAR), schoolYear(CURRENT_YEAR - 1));
const DAY_MS = 86_400_000;

/** In UTC, so the seed is the same on every machine. */
function yearBack(iso: string | null): string | null {
  return iso === null ? null : new Date(Date.parse(iso) + YEAR_BACK_DAYS * DAY_MS).toISOString();
}

const PAST_SOURCE_BLOCKS = CLASS_BLOCKS.slice(0, PAST_TOPICS);

export const HISTORY_CLASS_BLOCKS: readonly ClassBlock[] = PAST_SOURCE_BLOCKS.map(
  (block, index) => ({
    ...block,
    id: fixtureId('block', BLOCK_FROM + index + 1),
    groupId: PAST_BLOCKS_GROUP.id,
    opensAt: yearBack(block.opensAt),
  }),
);

export const HISTORY_ASSIGNMENTS: readonly ExerciseAssignment[] = PAST_SOURCE_BLOCKS.flatMap(
  (block, index) =>
    ASSIGNMENTS.filter(({ blockId }) => blockId === block.id).map((assignment) => ({
      ...assignment,
      groupId: PAST_BLOCKS_GROUP.id,
      blockId: HISTORY_CLASS_BLOCKS[index].id,
      dueAt: yearBack(assignment.dueAt),
    })),
).map((assignment, index) => ({
  ...assignment,
  id: fixtureId('assignment', ASSIGNMENT_FROM + index + 1),
}));

/**
 * Takes the history out of the mock data: for the tests about this year, which the classes, groups
 * and students of other years would only crowd.
 */
export function withoutHistory(db: Pick<MockDb, 'update'>): void {
  const users = new Set(HISTORY_USERS.map(({ id }) => id));
  const classes = new Set(HISTORY_CLASSES.map(({ id }) => id));
  const groups = new Set(HISTORY_GROUPS.map(({ id }) => id));
  db.update('enrollments', (rows) => rows.filter(({ groupId }) => !groups.has(groupId)));
  db.update('assignments', (rows) => rows.filter(({ groupId }) => !groups.has(groupId)));
  db.update('classBlocks', (rows) => rows.filter(({ groupId }) => !groups.has(groupId)));
  db.update('groups', (rows) => rows.filter(({ id }) => !groups.has(id)));
  db.update('classMembers', (rows) => rows.filter(({ classId }) => !classes.has(classId)));
  db.update('classes', (rows) => rows.filter(({ id }) => !classes.has(id)));
  db.update('users', (rows) => rows.filter(({ id }) => !users.has(id)));
}
