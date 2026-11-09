import type { AttemptStatus } from '../../data/attempt';
import type { AssignedExercise } from '../../data/exercise';
import { countByStatus, groupBySession, isOpen, isPassed, nextExercise } from './catalog-sessions';

function entry(
  id: string,
  session: number,
  status: AttemptStatus = 'not_started',
  updatedAt: string | null = null,
): AssignedExercise {
  return {
    exercise: { id } as AssignedExercise['exercise'],
    assignmentId: `a-${id}`,
    session,
    sessionTitle: session === 1 ? 'Bucles' : null,
    updatedAt,
    status,
    hintCount: 0,
    hintLevel: null,
  };
}

describe('isPassed', () => {
  it.each<[AttemptStatus, boolean]>([
    ['not_started', false],
    ['in_progress', false],
    ['tests_failed', false],
    ['passed', true],
    ['submitted', true],
  ])('counts %s as passed: %s', (status, passed) => {
    expect(isPassed(status)).toBe(passed);
  });
});

describe('isOpen', () => {
  it.each<[AttemptStatus, boolean]>([
    ['not_started', false],
    ['in_progress', true],
    ['tests_failed', true],
    ['passed', true],
    ['submitted', false],
  ])('counts %s as an open attempt: %s', (status, open) => {
    expect(isOpen(status)).toBe(open);
  });
});

describe('countByStatus', () => {
  it('counts the exercises in each status, with zero for the missing ones', () => {
    expect(
      countByStatus([
        entry('e1', 1, 'submitted'),
        entry('e2', 1, 'submitted'),
        entry('e3', 2, 'tests_failed'),
      ]),
    ).toEqual({ not_started: 0, in_progress: 0, tests_failed: 1, passed: 0, submitted: 2 });
  });
});

describe('nextExercise', () => {
  it('resumes the open attempt changed last, a passed one not submitted among them', () => {
    const next = nextExercise([
      entry('e1', 1, 'in_progress', '2026-10-06T08:10:00.000Z'),
      entry('e2', 1, 'passed', '2026-10-13T08:10:00.000Z'),
      entry('e3', 2, 'tests_failed', '2026-10-08T08:10:00.000Z'),
      entry('e4', 2, 'not_started'),
    ]);

    expect(next).toEqual({
      entry: expect.objectContaining({ assignmentId: 'a-e2' }),
      kind: 'resume',
    });
  });

  it('puts an open attempt without a date last', () => {
    const next = nextExercise([
      entry('e1', 1, 'in_progress'),
      entry('e2', 1, 'tests_failed', '2026-10-06T08:10:00.000Z'),
    ]);

    expect(next?.entry.assignmentId).toBe('a-e2');
  });

  it('puts an open attempt without a date last whatever its place', () => {
    const next = nextExercise([
      entry('e1', 1, 'tests_failed', '2026-10-06T08:10:00.000Z'),
      entry('e2', 1, 'in_progress'),
      entry('e3', 1, 'passed'),
    ]);

    expect(next?.entry.assignmentId).toBe('a-e1');
  });

  it('suggests the first exercise not started when none is open', () => {
    const next = nextExercise([
      entry('e1', 1, 'submitted', '2026-10-06T08:10:00.000Z'),
      entry('e2', 2, 'not_started'),
      entry('e3', 2, 'not_started'),
    ]);

    expect(next).toEqual({
      entry: expect.objectContaining({ assignmentId: 'a-e2' }),
      kind: 'start',
    });
  });

  it('suggests nothing when every exercise is submitted', () => {
    expect(nextExercise([entry('e1', 1, 'submitted')])).toBeNull();
    expect(nextExercise([])).toBeNull();
  });
});

describe('groupBySession', () => {
  it('groups the exercises by session in ascending order, keeping their order inside each one', () => {
    const groups = groupBySession([entry('e3', 2), entry('e1', 1), entry('e4', 2), entry('e2', 1)]);

    expect(groups.map((group) => group.session)).toEqual([1, 2]);
    expect(groups.map((group) => group.entries.map((e) => e.exercise.id))).toEqual([
      ['e1', 'e2'],
      ['e3', 'e4'],
    ]);
  });

  it('counts the passed exercises of each session', () => {
    const groups = groupBySession([
      entry('e1', 1, 'submitted'),
      entry('e2', 1, 'passed'),
      entry('e3', 1, 'tests_failed'),
      entry('e4', 2, 'in_progress'),
    ]);

    expect(groups.map((group) => group.passed)).toEqual([2, 0]);
  });

  it('marks the sessions with every exercise submitted as complete, not just passed', () => {
    const groups = groupBySession([
      entry('e1', 1, 'submitted'),
      entry('e2', 1, 'passed'),
      entry('e3', 2, 'submitted'),
      entry('e4', 2, 'submitted'),
    ]);

    expect(groups.map((group) => group.complete)).toEqual([false, true]);
  });

  it('takes the title of each session from its exercises', () => {
    const groups = groupBySession([entry('e1', 1), entry('e2', 2)]);

    expect(groups.map((group) => group.title)).toEqual(['Bucles', null]);
  });

  it('returns no sessions without exercises', () => {
    expect(groupBySession([])).toEqual([]);
  });
});
