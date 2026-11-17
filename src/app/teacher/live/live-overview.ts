import type { Attempt, AttemptStatus } from '../../data/attempt';
import type { Test } from '../../data/exercise';
import { LIVE_WINDOW_MINUTES, type LiveExercise, type LiveStudent } from '../../data/live-service';
import type { LiveRow } from './live-row';
import { exercisePosition, type LiveState, type StudentActivity } from './live-state';

const MINUTE_MS = 60_000;

/** Students failing the same test from whom it is worth explaining it to the whole class. */
export const COMMON_FAILURE_STUDENTS = 3;

/** Every status of an attempt, in the order of the work. */
const STATUSES: readonly AttemptStatus[] = [
  'not_started',
  'in_progress',
  'tests_failed',
  'passed',
  'submitted',
];

/** Exercises the whole class shows before «Ver los N». */
export const OVERVIEW_TOP = 5;

/** How the class goes in an exercise. */
export interface ExerciseOverview {
  readonly exercise: LiveExercise;
  /** In its block, from 1. */
  readonly position: number;
  /** Who is in each status, in the order of the class. */
  readonly students: Readonly<Record<AttemptStatus, readonly LiveStudent[]>>;
  /** Students in the bar. */
  readonly total: number;
  /** The test most students fail, with who fails it; the first in order on a tie. */
  readonly topFailure: { readonly test: Test; readonly students: readonly LiveStudent[] } | null;
}

/** «Dónde está la clase» (D-068). */
export interface ClassOverview {
  readonly exercises: readonly ExerciseOverview[];
  /** With a block: students of the session whose attempt is in another block, in block order. */
  readonly elsewhere: readonly { readonly blockId: string; readonly students: number }[];
}

/**
 * The class exercise by exercise (D-054, D-068): where everybody is and what blocks them, so the
 * teacher can decide to explain something to all. `blockId` null is the whole class.
 *
 * - With a block, its exercises in order, and every student of the group once in each one, with
 *   their latest attempt at it (practice included: it is what they do now).
 * - With the whole class, the exercises of any block in which somebody's latest attempt moved in
 *   the session, with only those students; the one with most students first.
 *
 * A test fails «now», in class, in the latest run of the attempt of a row in the session with
 * failed tests; out of class, in the latest run of each student's latest attempt with failed tests.
 */
export function exerciseOverview(
  state: LiveState,
  rows: readonly LiveRow[],
  blockId: string | null,
  now: number,
): ClassOverview {
  const activities = [...state.students.values()];
  const inSession = rows.filter((row) => row.work !== 'absent');
  const inClass = inSession.length > 0;
  const from = now - LIVE_WINDOW_MINUTES * MINUTE_MS;

  const overviewOf = (exercise: LiveExercise, members: readonly Member[]): ExerciseOverview => {
    const students = Object.fromEntries(
      STATUSES.map((status) => [
        status,
        members
          .filter((m) => (m.attempt?.status ?? 'not_started') === status)
          .map((m) => m.student),
      ]),
    ) as Record<AttemptStatus, LiveStudent[]>;
    const failing = inClass
      ? inSession
          .filter((row) => row.exercise === exercise && row.status === 'tests_failed')
          .map((row) => ({ student: row.student, testIds: row.failedTestIds }))
      : members.map((member) => ({
          student: member.student,
          testIds: lastFailedRun(member.activity, exercise),
        }));
    return {
      exercise,
      position: exercisePosition(state.exercises, exercise.assignmentId) as number,
      students,
      total: members.length,
      topFailure: topFailure(exercise.tests, failing),
    };
  };

  if (blockId === null) {
    const exercises = state.exercises
      .map((exercise) => {
        const members = activities
          .map((activity) => member(activity, exercise))
          .filter((m) => m.attempt !== undefined && Date.parse(m.attempt.updatedAt) >= from);
        return overviewOf(exercise, members);
      })
      .filter((overview) => overview.total > 0)
      .sort((a, b) => b.total - a.total);
    return { exercises, elsewhere: [] };
  }

  const exercises = state.exercises
    .filter((exercise) => exercise.blockId === blockId)
    .map((exercise) =>
      overviewOf(
        exercise,
        activities.map((activity) => member(activity, exercise)),
      ),
    );
  const students = new Map<string, number>();
  for (const row of inSession) {
    if (row.exercise && row.exercise.blockId !== blockId) {
      students.set(row.exercise.blockId, (students.get(row.exercise.blockId) ?? 0) + 1);
    }
  }
  // In the order of the blocks, as the exercises of the snapshot come
  const blockOrder = [...new Set(state.exercises.map((exercise) => exercise.blockId))];
  return {
    exercises,
    elsewhere: blockOrder.flatMap((id) => {
      const count = students.get(id);
      return count ? [{ blockId: id, students: count }] : [];
    }),
  };
}

/** A student of the class with their latest attempt at an exercise. */
interface Member {
  readonly student: LiveStudent;
  readonly activity: StudentActivity;
  readonly attempt: Attempt | undefined;
}

function member(activity: StudentActivity, exercise: LiveExercise): Member {
  return {
    student: activity.student,
    activity,
    attempt: latestAttempt(activity.attempts, exercise),
  };
}

function latestAttempt(attempts: readonly Attempt[], exercise: LiveExercise): Attempt | undefined {
  return attempts
    .filter((attempt) => attempt.assignmentId === exercise.assignmentId)
    .reduce<Attempt | undefined>(
      (best, attempt) => (best === undefined || attempt.number > best.number ? attempt : best),
      undefined,
    );
}

/** The tests failing in the latest run of the latest attempt with failed tests at the exercise. */
function lastFailedRun(activity: StudentActivity, exercise: LiveExercise): readonly string[] {
  const attempt = latestAttempt(
    activity.attempts.filter((candidate) => candidate.status === 'tests_failed'),
    exercise,
  );
  if (!attempt) return [];
  const lastRun = activity.events
    .flatMap((event) => (event.type === 'run' && event.attemptId === attempt.id ? [event] : []))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .at(-1);
  return lastRun?.detail.failedTestIds ?? [];
}

/** The test with most students failing it; the first in order on a tie. */
function topFailure(
  tests: readonly Test[],
  failing: readonly { readonly student: LiveStudent; readonly testIds: readonly string[] }[],
): ExerciseOverview['topFailure'] {
  let best: ExerciseOverview['topFailure'] = null;
  for (const test of tests) {
    const students = failing.filter((f) => f.testIds.includes(test.id)).map((f) => f.student);
    if (students.length > 0 && students.length > (best?.students.length ?? 0)) {
      best = { test, students };
    }
  }
  return best;
}
