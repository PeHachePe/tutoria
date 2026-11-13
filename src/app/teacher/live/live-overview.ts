import type { Attempt, AttemptStatus } from '../../data/attempt';
import type { Test } from '../../data/exercise';
import type { LiveExercise } from '../../data/live-service';
import type { LiveState } from './live-state';

/** Students failing the same test from whom it is worth explaining it to the whole class. */
export const COMMON_FAILURE_STUDENTS = 3;

/** How the class goes in an exercise of the block. */
export interface ExerciseOverview {
  readonly exercise: LiveExercise;
  /** Students by the status of their latest attempt at it; nobody is left out. */
  readonly counts: Readonly<Record<AttemptStatus, number>>;
  readonly students: number;
  /** The test most students fail now, if any fails. */
  readonly topFailure: { readonly test: Test; readonly students: number } | null;
}

/**
 * The class exercise by exercise (D-054): where everybody is and what blocks them, so the teacher
 * can decide to explain something to all. Each student counts once per exercise, with their latest
 * attempt at it (practice included: it is what they do now), and a test fails «now» when it failed
 * in the latest run of an attempt with failed tests.
 */
export function exerciseOverview(state: LiveState): ExerciseOverview[] {
  const activities = [...state.students.values()];
  return state.exercises.map((exercise) => {
    const counts: Record<AttemptStatus, number> = {
      not_started: 0,
      in_progress: 0,
      tests_failed: 0,
      passed: 0,
      submitted: 0,
    };
    const failing = new Map<string, number>();
    for (const { attempts, events } of activities) {
      const attempt = latestAttempt(
        attempts.filter((candidate) => candidate.assignmentId === exercise.assignmentId),
      );
      counts[attempt?.status ?? 'not_started']++;
      if (attempt?.status !== 'tests_failed') continue;
      const lastRun = events
        .flatMap((event) => (event.type === 'run' && event.attemptId === attempt.id ? [event] : []))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .at(-1);
      for (const testId of lastRun?.detail.failedTestIds ?? []) {
        failing.set(testId, (failing.get(testId) ?? 0) + 1);
      }
    }
    return {
      exercise,
      counts,
      students: activities.length,
      topFailure: topFailure(exercise.tests, failing),
    };
  });
}

function latestAttempt(attempts: readonly Attempt[]): Attempt | undefined {
  return [...attempts].sort((a, b) => b.number - a.number)[0];
}

/** The test with most students failing it; the first in order on a tie. */
function topFailure(
  tests: readonly Test[],
  failing: ReadonlyMap<string, number>,
): ExerciseOverview['topFailure'] {
  let best: ExerciseOverview['topFailure'] = null;
  for (const test of tests) {
    const students = failing.get(test.id) ?? 0;
    if (students > 0 && students > (best?.students ?? 0)) {
      best = { test, students };
    }
  }
  return best;
}
