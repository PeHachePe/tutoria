import {
  assignedExercise,
  assignmentProgress,
  countedAttempt,
  summarizeAttempt,
  type AttemptSummary,
} from './attempt-progress';
import { SEED } from './mock/fixtures/seed';

function summary(number: number, status: AttemptSummary['status']): AttemptSummary {
  return {
    number,
    status,
    updatedAt: `2026-11-0${number}T10:00:00.000Z`,
    hintCount: 0,
    hintLevel: null,
  };
}

describe('assignedExercise', () => {
  const base = {
    exercise: SEED.exercises[0],
    assignmentId: SEED.assignments[0].id,
    group: { id: SEED.groups[0].id, name: '1.º DAW A', subject: SEED.subjects[0] },
    block: SEED.classBlocks[0],
  };

  it('is not started without attempts', () => {
    expect(assignedExercise(base, [])).toEqual({
      ...base,
      updatedAt: null,
      status: 'not_started',
      hintCount: 0,
      hintLevel: null,
      practice: null,
      repetitions: 0,
    });
  });

  it('shows the attempt that counts and the practice after it apart', () => {
    const first = { ...summary(1, 'submitted'), hintCount: 2, hintLevel: 3 as const };
    const again = summary(2, 'in_progress');

    expect(assignedExercise(base, [again, first])).toEqual({
      ...base,
      updatedAt: first.updatedAt,
      status: 'submitted',
      hintCount: 2,
      hintLevel: 3,
      practice: again,
      repetitions: 1,
    });
  });
});

describe('countedAttempt', () => {
  it('is none without attempts', () => {
    expect(countedAttempt([])).toBeUndefined();
  });

  it('is the only attempt, whatever its status', () => {
    const first = summary(1, 'tests_failed');

    expect(countedAttempt([first])).toBe(first);
  });

  it('is the first submitted one, not the practice after it', () => {
    const first = summary(1, 'submitted');
    const again = summary(2, 'submitted');

    expect(countedAttempt([again, first, summary(3, 'in_progress')])).toBe(first);
  });

  it('is the first one while none is submitted', () => {
    const first = summary(1, 'passed');

    expect(countedAttempt([summary(2, 'in_progress'), first])).toBe(first);
  });
});

describe('assignmentProgress', () => {
  it('is empty without attempts', () => {
    expect(assignmentProgress([])).toEqual({ counted: null, practice: null, repetitions: 0 });
  });

  it('has no practice with a single attempt', () => {
    const first = summary(1, 'submitted');

    expect(assignmentProgress([first])).toEqual({ counted: first, practice: null, repetitions: 0 });
  });

  it('takes the latest attempt after the one that counts as the practice', () => {
    const first = summary(1, 'submitted');
    const second = summary(2, 'submitted');
    const third = summary(3, 'in_progress');

    expect(assignmentProgress([third, first, second])).toEqual({
      counted: first,
      practice: third,
      repetitions: 2,
    });
  });
});

describe('summarizeAttempt', () => {
  it('counts the hints asked for and the highest level the tutor reached', () => {
    const attempt = {
      number: 2,
      status: 'tests_failed' as const,
      updatedAt: '2026-11-02T10:00:00.000Z',
    };

    expect(
      summarizeAttempt(attempt, [
        { trigger: 'hint', hintLevel: 1 },
        { trigger: 'question', hintLevel: 3 },
        { trigger: 'hint', hintLevel: 2 },
        { trigger: 'proactive', hintLevel: 2 },
      ]),
    ).toEqual({ ...attempt, hintCount: 2, hintLevel: 3 });
  });

  it('has no level without interactions', () => {
    const attempt = {
      number: 1,
      status: 'in_progress' as const,
      updatedAt: '2026-11-01T10:00:00.000Z',
    };

    expect(summarizeAttempt(attempt, [])).toEqual({ ...attempt, hintCount: 0, hintLevel: null });
  });
});
