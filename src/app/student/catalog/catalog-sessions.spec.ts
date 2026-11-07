import type { AttemptStatus } from '../../data/attempt';
import type { AssignedExercise } from '../../data/exercise';
import { groupBySession, isPassed } from './catalog-sessions';

function entry(
  id: string,
  session: number,
  status: AttemptStatus = 'not_started',
): AssignedExercise {
  return {
    exercise: { id } as AssignedExercise['exercise'],
    assignmentId: `a-${id}`,
    session,
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

  it('marks the sessions with every exercise passed as complete', () => {
    const groups = groupBySession([
      entry('e1', 1, 'submitted'),
      entry('e2', 1, 'passed'),
      entry('e3', 2, 'submitted'),
      entry('e4', 2, 'not_started'),
    ]);

    expect(groups.map((group) => group.complete)).toEqual([true, false]);
  });

  it('returns no sessions without exercises', () => {
    expect(groupBySession([])).toEqual([]);
  });
});
