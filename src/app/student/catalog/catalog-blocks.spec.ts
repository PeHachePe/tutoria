import type { AttemptStatus } from '../../data/attempt';
import type { AttemptSummary } from '../../data/attempt-progress';
import type { AssignedExercise, AssignedGroup, ClassBlock } from '../../data/exercise';
import {
  countByStatus,
  currentAttempt,
  groupByBlock,
  groupByGroup,
  isOpen,
  isPassed,
  nextExercise,
  nextInBlock,
} from './catalog-blocks';

const DAW: AssignedGroup = {
  id: 'daw',
  name: '1.º DAW A',
  subject: { id: 'basic', name: 'Programación básica', sourceLocale: 'es', translations: {} },
};
const WEB: AssignedGroup = {
  id: 'web',
  name: '1.º DAW A',
  subject: { id: 'web', name: 'Desarrollo web', sourceLocale: 'es', translations: {} },
};

function block(position: number, group = DAW): ClassBlock {
  return {
    id: `${group.id}-b${position}`,
    groupId: group.id,
    position,
    title: `Tema ${position}`,
    sourceLocale: 'es',
    translations: {},
    isHidden: false,
  };
}

function entry(
  id: string,
  blockPosition: number,
  status: AttemptStatus = 'not_started',
  updatedAt: string | null = null,
  group = DAW,
): AssignedExercise {
  return {
    exercise: { id } as AssignedExercise['exercise'],
    assignmentId: `a-${id}`,
    group,
    block: block(blockPosition, group),
    updatedAt,
    status,
    hintCount: 0,
    hintLevel: null,
    practice: null,
    repetitions: 0,
  };
}

function practising(
  base: AssignedExercise,
  status: AttemptSummary['status'],
  updatedAt: string,
): AssignedExercise {
  return {
    ...base,
    practice: { number: 2, status, updatedAt, hintCount: 0, hintLevel: null },
    repetitions: 1,
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

describe('currentAttempt', () => {
  it('is the attempt that counts without practice', () => {
    expect(currentAttempt(entry('e1', 1, 'tests_failed', '2026-10-06T08:10:00.000Z'))).toEqual({
      status: 'tests_failed',
      updatedAt: '2026-10-06T08:10:00.000Z',
    });
  });

  it('is the practice while it is open, and the attempt that counts once it is submitted', () => {
    const submitted = entry('e1', 1, 'submitted', '2026-10-06T08:10:00.000Z');

    expect(
      currentAttempt(practising(submitted, 'in_progress', '2026-11-02T17:00:00.000Z')),
    ).toEqual({ status: 'in_progress', updatedAt: '2026-11-02T17:00:00.000Z' });
    expect(currentAttempt(practising(submitted, 'submitted', '2026-11-02T17:00:00.000Z'))).toEqual({
      status: 'submitted',
      updatedAt: '2026-10-06T08:10:00.000Z',
    });
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

  it('resumes an open practice like any open attempt', () => {
    const next = nextExercise([
      entry('e1', 1, 'tests_failed', '2026-10-06T08:10:00.000Z'),
      practising(
        entry('e2', 1, 'submitted', '2026-10-05T08:10:00.000Z'),
        'in_progress',
        '2026-11-02T17:00:00.000Z',
      ),
    ]);

    expect(next).toEqual({
      entry: expect.objectContaining({ assignmentId: 'a-e2' }),
      kind: 'resume',
    });
  });

  it('suggests nothing when every exercise is submitted', () => {
    expect(nextExercise([entry('e1', 1, 'submitted')])).toBeNull();
    expect(nextExercise([])).toBeNull();
  });
});

describe('groupByGroup', () => {
  it('splits the exercises by group, in the order they first appear, keeping their order', () => {
    const groups = groupByGroup([
      entry('e1', 1),
      entry('w1', 1, 'not_started', null, WEB),
      entry('e2', 2),
    ]);

    expect(groups.map(({ group }) => group.id)).toEqual(['daw', 'web']);
    expect(groups.map((group) => group.entries.map((e) => e.exercise.id))).toEqual([
      ['e1', 'e2'],
      ['w1'],
    ]);
  });

  it('returns no groups without exercises', () => {
    expect(groupByGroup([])).toEqual([]);
  });
});

describe('groupByBlock', () => {
  it('groups the exercises by block in order, keeping their order inside each one', () => {
    const blocks = groupByBlock([entry('e3', 2), entry('e1', 1), entry('e4', 2), entry('e2', 1)]);

    expect(blocks.map(({ block }) => block.title)).toEqual(['Tema 1', 'Tema 2']);
    expect(blocks.map((group) => group.entries.map((e) => e.exercise.id))).toEqual([
      ['e1', 'e2'],
      ['e3', 'e4'],
    ]);
  });

  it('counts the passed exercises of each block', () => {
    const blocks = groupByBlock([
      entry('e1', 1, 'submitted'),
      entry('e2', 1, 'passed'),
      entry('e3', 1, 'tests_failed'),
      entry('e4', 2, 'in_progress'),
    ]);

    expect(blocks.map((group) => group.passed)).toEqual([2, 0]);
  });

  it('marks the blocks with every exercise submitted as complete, not just passed', () => {
    const blocks = groupByBlock([
      entry('e1', 1, 'submitted'),
      entry('e2', 1, 'passed'),
      entry('e3', 2, 'submitted'),
      entry('e4', 2, 'submitted'),
    ]);

    expect(blocks.map((group) => group.complete)).toEqual([false, true]);
  });

  it('returns no blocks without exercises', () => {
    expect(groupByBlock([])).toEqual([]);
  });
});

describe('nextInBlock', () => {
  const entries = [
    entry('e1', 1, 'submitted'),
    entry('e2', 1, 'submitted'),
    entry('e3', 1, 'tests_failed'),
    entry('e4', 2, 'not_started'),
  ];

  it('is the next exercise of the block not submitted yet', () => {
    expect(nextInBlock(entries, 'a-e1')?.assignmentId).toBe('a-e3');
  });

  it('goes back to the start of the block when nothing is left after it', () => {
    const block = [entry('e1', 1, 'in_progress'), entry('e2', 1, 'submitted')];

    expect(nextInBlock(block, 'a-e2')?.assignmentId).toBe('a-e1');
  });

  it('is none when the rest of the block is submitted, or for an unknown assignment', () => {
    expect(nextInBlock(entries, 'a-e4')).toBeNull();
    expect(nextInBlock(entries, 'missing')).toBeNull();
  });
});
