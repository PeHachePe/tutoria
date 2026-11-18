import type { Attempt, StoredAttemptStatus } from '../attempt';
import type { ClassBlock, Exercise, ExerciseAssignment } from '../exercise';
import type { ProcessEvent } from '../process-event';
import type { DeadlineStats } from '../stats-service';
import type { AppUser } from '../user';
import { DAW_RESIT_BLOCK } from './fixtures/exercises';
import { fixtureId } from './fixtures/fixture-id';
import { SEED } from './fixtures/seed';
import { DAW_GROUP_ID } from './fixtures/users';
import { groupHistoryOf } from './group-history';
import type { MockTables } from './mock-tables';

const GROUP = 'g1';
const HOUR = 3_600_000;
const SECOND = 1000;
const DUE = '2026-11-10T22:59:00.000Z';
const DUE_MS = Date.parse(DUE);
const STARTED = '2026-11-01T10:00:00.000Z';

const STUDENT = SEED.users.find((user) => user.role === 'student') as AppUser;
const EXERCISE = SEED.exercises[0];
const BLOCK = SEED.classBlocks[0];

function student(id: string, name: string): AppUser {
  return { ...STUDENT, id, name };
}

function exercise(id: string, maxRepeatedFailures = 3): Exercise {
  return { ...EXERCISE, id, maxRepeatedFailures };
}

function block(id: string, position: number, changes: Partial<ClassBlock> = {}): ClassBlock {
  return {
    ...BLOCK,
    id,
    groupId: GROUP,
    position,
    title: id,
    isHidden: false,
    opensAt: null,
    ...changes,
  };
}

function assignment(
  id: string,
  blockId: string,
  changes: Partial<ExerciseAssignment> = {},
): ExerciseAssignment {
  return {
    id,
    groupId: GROUP,
    blockId,
    exerciseId: 'e1',
    position: 1,
    isHidden: false,
    dueAt: null,
    ...changes,
  };
}

let nextId = 0;

function attempt(
  userId: string,
  assignmentId: string,
  status: StoredAttemptStatus,
  changes: Partial<Attempt> = {},
): Attempt {
  return {
    id: `a${++nextId}`,
    exerciseId: 'e1',
    userId,
    assignmentId,
    number: 1,
    currentCode: '',
    finalCode: null,
    status,
    startedAt: STARTED,
    finishedAt: null,
    updatedAt: STARTED,
    ...changes,
  };
}

/** Submitted `seconds` after it was opened. */
function submittedAfter(userId: string, assignmentId: string, seconds: number): Attempt {
  return attempt(userId, assignmentId, 'submitted', {
    finishedAt: new Date(Date.parse(STARTED) + seconds * SECOND).toISOString(),
  });
}

/** Submitted at `ms` from the due date (negative, before it). */
function submittedAt(userId: string, assignmentId: string, ms: number): Attempt {
  return attempt(userId, assignmentId, 'submitted', {
    finishedAt: new Date(DUE_MS + ms).toISOString(),
  });
}

function hint(attemptId: string): ProcessEvent {
  return {
    id: `e${++nextId}`,
    attemptId,
    type: 'hint_requested',
    timestamp: STARTED,
    detail: { level: 1 },
  };
}

function run(attemptId: string, minute: number, failedTestIds: string[]): ProcessEvent {
  return {
    id: `e${++nextId}`,
    attemptId,
    type: 'run',
    timestamp: new Date(Date.parse(STARTED) + minute * 60_000).toISOString(),
    detail: { passed: 0, failed: failedTestIds.length, failedTestIds },
  };
}

/** Runs of `attemptId` in which test `t1` fails `times` in a row. */
function failures(attemptId: string, times: number): ProcessEvent[] {
  return Array.from({ length: times }, (_, minute) => run(attemptId, minute, ['t1']));
}

/** Two students enrolled (Bea and Ana) and one who left the group (Carla), one block, one exercise. */
function tables(changes: Partial<MockTables> = {}): MockTables {
  return {
    ...SEED,
    users: [student('s1', 'Bea'), student('s2', 'Ana'), student('s3', 'Carla')],
    groups: [{ ...SEED.groups[0], id: GROUP }],
    enrollments: [
      { id: 'n1', groupId: GROUP, userId: 's1' },
      { id: 'n2', groupId: GROUP, userId: 's2' },
      { id: 'n3', groupId: 'other', userId: 's3' },
    ],
    classBlocks: [block('b1', 1)],
    exercises: [exercise('e1'), exercise('e2', 2)],
    assignments: [assignment('x1', 'b1')],
    attempts: [],
    events: [],
    interactions: [],
    ...changes,
  };
}

describe('groupHistoryOf', () => {
  describe('blocks', () => {
    it('counts the students enrolled now and every block of the group in order', () => {
      const history = groupHistoryOf(
        tables({
          classBlocks: [block('b2', 2), block('b1', 1), block('other', 0, { groupId: 'other' })],
        }),
        GROUP,
      );

      expect(history.students).toBe(2);
      expect(history.blocks.map((stats) => stats.block.id)).toEqual(['b1', 'b2']);
    });

    it('gives a block without attempts everything at zero', () => {
      expect(groupHistoryOf(tables(), GROUP).blocks[0]).toEqual({
        block: block('b1', 1),
        assignments: 1,
        attempts: 0,
        activeStudents: 0,
        hints: 0,
        solved: 0,
        medianSeconds: null,
        stuckStudents: 0,
        exercises: [
          {
            assignmentId: 'x1',
            exercise: exercise('e1'),
            attempts: 0,
            activeStudents: 0,
            hints: 0,
            solved: 0,
            medianSeconds: null,
            stuckStudents: 0,
          },
        ],
      });
    });

    it('gives each exercise its own figures, in the order of the block', () => {
      const stuck = attempt('s1', 'x2', 'tests_failed', { exerciseId: 'e2' });
      const solved = submittedAfter('s2', 'x2', 120);

      const [stats] = groupHistoryOf(
        tables({
          assignments: [
            assignment('x1', 'b1', { position: 2 }),
            assignment('x2', 'b1', { exerciseId: 'e2', position: 1 }),
          ],
          attempts: [stuck, solved, submittedAfter('s1', 'x1', 60)],
          events: [...failures(stuck.id, 2), hint(stuck.id), hint(solved.id)],
        }),
        GROUP,
      ).blocks;

      expect(
        stats.exercises.map(
          ({ assignmentId, attempts, hints, solved, medianSeconds, stuckStudents }) => [
            assignmentId,
            attempts,
            hints,
            solved,
            medianSeconds,
            stuckStudents,
          ],
        ),
      ).toEqual([
        ['x2', 2, 2, 1, 120, 1],
        ['x1', 1, 0, 1, 60, 0],
      ]);
      expect(stats.exercises[0].exercise).toEqual(exercise('e2', 2));
    });

    it('counts the attempt that counts and its hints, not the practice after it', () => {
      const counted = submittedAfter('s1', 'x1', 60);
      const practice = attempt('s1', 'x1', 'passed', { number: 2 });

      const [stats] = groupHistoryOf(
        tables({
          attempts: [practice, counted],
          events: [hint(counted.id), hint(practice.id), hint(practice.id)],
        }),
        GROUP,
      ).blocks;

      expect(stats).toMatchObject({ attempts: 1, activeStudents: 1, hints: 1, solved: 1 });
    });

    it('leaves out the students no longer enrolled', () => {
      const [stats] = groupHistoryOf(
        tables({ attempts: [attempt('s3', 'x1', 'passed'), attempt('s2', 'x1', 'in_progress')] }),
        GROUP,
      ).blocks;

      expect(stats).toMatchObject({ attempts: 1, activeStudents: 1, solved: 0 });
    });

    it('counts a hidden assignment only if somebody worked on it', () => {
      const history = groupHistoryOf(
        tables({
          assignments: [
            assignment('x1', 'b1'),
            assignment('x2', 'b1', { isHidden: true }),
            assignment('x3', 'b1', { isHidden: true }),
          ],
          attempts: [attempt('s1', 'x3', 'tests_failed')],
        }),
        GROUP,
      );

      expect(history.blocks[0]).toMatchObject({ assignments: 2, attempts: 1 });
    });

    it('counts the students of several attempts once', () => {
      const [stats] = groupHistoryOf(
        tables({
          assignments: [assignment('x1', 'b1'), assignment('x2', 'b1', { exerciseId: 'e2' })],
          attempts: [attempt('s1', 'x1', 'passed'), attempt('s1', 'x2', 'submitted')],
        }),
        GROUP,
      ).blocks;

      expect(stats).toMatchObject({ attempts: 2, activeStudents: 1, solved: 2 });
    });

    describe('median time', () => {
      it('is the central time of the submitted attempts, rounded', () => {
        const [stats] = groupHistoryOf(
          tables({
            assignments: [assignment('x1', 'b1'), assignment('x2', 'b1')],
            attempts: [
              submittedAfter('s1', 'x1', 300.4),
              submittedAfter('s2', 'x1', 100),
              submittedAfter('s1', 'x2', 9000),
              attempt('s2', 'x2', 'passed'),
            ],
          }),
          GROUP,
        ).blocks;

        expect(stats.medianSeconds).toBe(300);
      });

      it('is the mean of the two central times with an even number', () => {
        const [stats] = groupHistoryOf(
          tables({ attempts: [submittedAfter('s1', 'x1', 100), submittedAfter('s2', 'x1', 201)] }),
          GROUP,
        ).blocks;

        expect(stats.medianSeconds).toBe(151);
      });

      it('is null with nothing submitted', () => {
        const [stats] = groupHistoryOf(
          tables({ attempts: [attempt('s1', 'x1', 'passed')] }),
          GROUP,
        ).blocks;

        expect(stats.medianSeconds).toBeNull();
      });
    });

    describe('stuck students', () => {
      it('counts who failed one same test as many runs in a row as the exercise allows', () => {
        const stuck = attempt('s1', 'x1', 'submitted');
        const almost = attempt('s2', 'x1', 'tests_failed');

        const [stats] = groupHistoryOf(
          tables({
            attempts: [stuck, almost],
            events: [...failures(stuck.id, 3), run(stuck.id, 9, []), ...failures(almost.id, 2)],
          }),
          GROUP,
        ).blocks;

        expect(stats.stuckStudents).toBe(1);
      });

      it('uses the threshold of each exercise and counts a student once', () => {
        const first = attempt('s1', 'x1', 'tests_failed');
        const second = attempt('s1', 'x2', 'tests_failed', { exerciseId: 'e2' });
        const below = attempt('s2', 'x1', 'tests_failed');

        const [stats] = groupHistoryOf(
          tables({
            assignments: [assignment('x1', 'b1'), assignment('x2', 'b1', { exerciseId: 'e2' })],
            attempts: [first, second, below],
            events: [...failures(first.id, 3), ...failures(second.id, 2), ...failures(below.id, 2)],
          }),
          GROUP,
        ).blocks;

        expect(stats.stuckStudents).toBe(1);
      });
    });
  });

  describe('deadlines', () => {
    function deadlines(changes: Partial<MockTables>): readonly DeadlineStats[] {
      return groupHistoryOf(tables(changes), GROUP).deadlines;
    }

    it('splits what arrived on time, in the last hours and after the date', () => {
      const [deadline] = deadlines({
        users: [
          student('s1', 'Bea'),
          student('s2', 'Ana'),
          student('s4', 'Dani'),
          student('s5', 'Eva'),
          student('s6', 'Fran'),
        ],
        enrollments: ['s1', 's2', 's4', 's5', 's6'].map((userId) => ({
          id: `n-${userId}`,
          groupId: GROUP,
          userId,
        })),
        assignments: [assignment('x1', 'b1', { dueAt: DUE })],
        attempts: [
          submittedAt('s1', 'x1', -24 * HOUR - SECOND),
          submittedAt('s2', 'x1', -24 * HOUR + SECOND),
          submittedAt('s4', 'x1', 0),
          submittedAt('s5', 'x1', SECOND),
          attempt('s6', 'x1', 'passed'),
        ],
      });

      expect(deadline).toEqual({
        blockId: 'b1',
        dueAt: DUE,
        assignments: 1,
        onTime: 3,
        lastHours: 2,
        late: 1,
        missing: [{ student: { id: 's6', name: 'Fran' }, pending: 1 }],
      });
    });

    it('lists by name who has something not submitted, with how many', () => {
      const [deadline] = deadlines({
        assignments: [
          assignment('x1', 'b1', { dueAt: DUE }),
          assignment('x2', 'b1', { dueAt: DUE }),
        ],
        attempts: [submittedAt('s1', 'x1', -HOUR * 48)],
      });

      expect(deadline.assignments).toBe(2);
      expect(deadline.missing).toEqual([
        { student: { id: 's2', name: 'Ana' }, pending: 2 },
        { student: { id: 's1', name: 'Bea' }, pending: 1 },
      ]);
    });

    it('gives each date of a block its own entry, by date and then by block', () => {
      const later = '2026-11-20T22:59:00.000Z';

      const found = deadlines({
        classBlocks: [block('b1', 1), block('b2', 2)],
        assignments: [
          assignment('x1', 'b2', { dueAt: DUE }),
          assignment('x2', 'b1', { dueAt: later }),
          assignment('x3', 'b1', { dueAt: DUE }),
          assignment('x4', 'b1'),
        ],
      });

      expect(found.map(({ blockId, dueAt }) => [blockId, dueAt])).toEqual([
        ['b1', DUE],
        ['b2', DUE],
        ['b1', later],
      ]);
    });

    it('leaves out what the students do not see', () => {
      expect(
        deadlines({
          classBlocks: [
            block('b1', 1),
            block('b2', 2, { opensAt: '2999-01-01T00:00:00.000Z' }),
            block('b3', 3, { isHidden: true }),
          ],
          assignments: [
            assignment('x1', 'b1', { dueAt: DUE, isHidden: true }),
            assignment('x2', 'b2', { dueAt: DUE }),
            assignment('x3', 'b3', { dueAt: DUE }),
          ],
        }),
      ).toEqual([]);
    });

    it('has none without students', () => {
      expect(
        deadlines({ enrollments: [], assignments: [assignment('x1', 'b1', { dueAt: DUE })] }),
      ).toEqual([]);
    });
  });

  describe('with the seed, in 1.º DAW A of Programación básica', () => {
    const history = groupHistoryOf(SEED, DAW_GROUP_ID);
    const started = history.blocks.filter((stats) => stats.attempts > 0);

    it('counts its 24 students and what they did in each block', () => {
      expect(history.students).toBe(24);
      expect(
        started.map(({ attempts, hints, solved, medianSeconds, stuckStudents }) => [
          attempts,
          hints,
          solved,
          medianSeconds,
          stuckStudents,
        ]),
      ).toEqual([
        [48, 54, 48, 720, 6],
        [48, 27, 46, 540, 1],
        [23, 8, 20, 540, 0],
        [59, 0, 41, 360, 0],
        [1, 1, 0, null, 0],
      ]);
      expect(started[2].activeStudents).toBe(23);
      expect(started[4]).toMatchObject({
        block: { id: fixtureId('block', DAW_RESIT_BLOCK) },
        assignments: 2,
        activeStudents: 1,
      });
    });

    it('gives each exercise of topic 4 its figures', () => {
      expect(
        started[3].exercises.map(({ attempts, solved, medianSeconds }) => [
          attempts,
          solved,
          medianSeconds,
        ]),
      ).toEqual([
        [21, 14, 360],
        [19, 13, 360],
        [19, 14, 360],
      ]);
    });

    it('gives the due date of topic 4 its submissions and who is missing', () => {
      const topic4 = started[3].block.id;
      const deadline = history.deadlines.find((candidate) => candidate.blockId === topic4);

      expect(deadline).toMatchObject({ assignments: 3, onTime: 40, lastHours: 0, late: 0 });
      expect(deadline?.missing).toHaveLength(19);
    });
  });
});
