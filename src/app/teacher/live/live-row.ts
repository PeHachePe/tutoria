import type { Attempt, AttemptStatus } from '../../data/attempt';
import type { Test } from '../../data/exercise';
import { LIVE_WINDOW_MINUTES, type LiveExercise, type LiveStudent } from '../../data/live-service';
import type { ProcessEvent } from '../../data/process-event';
import type { HintLevel, TutorInteraction } from '../../data/tutor';
import { awaySince } from '../../shared/away-since';
import { lastActivityAt } from '../../shared/is-stuck';
import { type Breakthrough, lastBreakthrough } from '../../shared/last-breakthrough';
import type { TestCount } from '../../shared/status-chip/status-chip';
import { type AttentionReason, attentionReason, failingTest } from './live-attention';
import { type LivePattern, livePatterns } from './live-patterns';
import { exercisePosition, type StudentActivity } from './live-state';
import { workState, type WorkState } from './live-work';

const MINUTE_MS = 60_000;

/** A row of the live panel: a student and the attempt they are on now, in any block of the group. */
export interface LiveRow {
  readonly student: LiveStudent;
  /** The attempt that moved last, in any block of the group, or null without any. */
  readonly attempt: Attempt | null;
  readonly exercise: LiveExercise | null;
  /** Position of that exercise in its block, from 1. */
  readonly position: number | null;
  /** The attempt is practice after a submission (2.5c): «Repitiendo». */
  readonly repeating: boolean;
  readonly status: AttemptStatus;
  /**
   * Minutes on the attempt: until it was submitted, until now in the session, or until its last
   * activity. Until the 4.1e, with `pastes` and `focusLosses`: the old table shows them.
   */
  readonly minutes: number | null;
  readonly hints: number;
  readonly hintLevel: HintLevel | null;
  readonly pastes: number;
  readonly focusLosses: number;
  /** Tests passed in the latest run, or null before any. */
  readonly tests: TestCount | null;
  /** Tests failing in the latest run of the attempt; none before a run or with all passed. */
  readonly failedTestIds: readonly string[];
  /** `failingTest()` of the attempt: the one to look at. */
  readonly failingTest: Test | null;
  /** The last thing the student did, in ms, or null. */
  readonly lastActivity: number | null;
  readonly work: WorkState;
  /** Since when they are out of the window, in ms; null if they are there or not in the session. */
  readonly away: number | null;
  /** Why they need the teacher; only for students in the session. */
  readonly reason: AttentionReason | null;
  /** Assignments of the group the student is practising again after submitting them. */
  readonly repeated: number;
  /** A test passed after failing it again and again, in the session window. */
  readonly breakthrough: Breakthrough | null;
  readonly patterns: readonly LivePattern[];
}

/** What the panel says of a student now. `exercises` are those of the group. */
export function liveRow(
  activity: StudentActivity,
  exercises: readonly LiveExercise[],
  now: number,
): LiveRow {
  const { student, attempts, events, interactions } = activity;
  const windowStart = now - LIVE_WINDOW_MINUTES * MINUTE_MS;
  const eventsOf = (attempt: Attempt) => events.filter((event) => event.attemptId === attempt.id);
  const interactionsOf = (attempt: Attempt) =>
    interactions.filter((interaction) => interaction.attemptId === attempt.id);
  const activityOf = (attempt: Attempt) =>
    lastStudentActivity(attempt, eventsOf(attempt), interactionsOf(attempt));

  const attempt = latest(attempts, activityOf);
  const lastActivity = attempt ? activityOf(attempt) : null;
  const own = attempt ? eventsOf(attempt) : [];
  const away = awaySince(own);
  const work = workState(lastActivity, away !== null, now);
  const inSession = work !== 'absent';
  const exercise = exercises.find((entry) => entry.assignmentId === attempt?.assignmentId) ?? null;
  const lastRun = own
    .flatMap((event) => (event.type === 'run' ? [event] : []))
    .sort((a, b) => eventTime(a) - eventTime(b))
    .at(-1);
  const hintLevels = own.flatMap((event) =>
    event.type === 'hint_requested' ? [event.detail.level] : [],
  );
  const breakthrough = exercise
    ? lastBreakthrough(own, exercise.exercise.maxRepeatedFailures)
    : null;

  return {
    student,
    attempt,
    exercise,
    position: exercise ? exercisePosition(exercises, exercise.assignmentId) : null,
    repeating: (attempt?.number ?? 1) > 1,
    status: attempt?.status ?? 'not_started',
    minutes: attempt ? workMinutes(attempt, inSession ? now : activityOf(attempt)) : null,
    hints: hintLevels.length,
    hintLevel: hintLevels.length > 0 ? (Math.max(...hintLevels) as HintLevel) : null,
    pastes: own.filter((event) => event.type === 'paste').length,
    focusLosses: own.filter((event) => event.type === 'focus_lost').length,
    tests: lastRun
      ? { passed: lastRun.detail.passed, total: lastRun.detail.passed + lastRun.detail.failed }
      : null,
    failedTestIds: lastRun?.detail.failedTestIds ?? [],
    failingTest: exercise ? failingTest(own, exercise.tests) : null,
    lastActivity,
    work,
    away: inSession ? away : null,
    reason:
      inSession && attempt && exercise
        ? attentionReason(attempt, own, interactionsOf(attempt), exercise.exercise)
        : null,
    repeated: new Set(attempts.filter((a) => a.number > 1).map((a) => a.assignmentId)).size,
    breakthrough: inSession && breakthrough && breakthrough.at >= windowStart ? breakthrough : null,
    patterns: inSession
      ? livePatterns({
          events: events.filter((event) => eventTime(event) >= windowStart),
          submittedAttemptIds: new Set(
            attempts.filter((a) => a.status === 'submitted').map((a) => a.id),
          ),
        })
      : [],
  };
}

/**
 * The last thing the student did on an attempt (D-068): saving code, running, submitting, asking
 * for a hint, pasting, coming back to the window or asking the tutor. Leaving the window and the
 * interventions of the tutor are not the student's doing.
 */
function lastStudentActivity(
  attempt: Attempt,
  events: readonly ProcessEvent[],
  interactions: readonly TutorInteraction[],
): number {
  const asked = interactions
    .filter((interaction) => interaction.trigger !== 'proactive')
    .map((interaction) => Date.parse(interaction.createdAt));
  return Math.max(lastActivityAt(attempt, events), ...asked);
}

function latest(attempts: readonly Attempt[], time: (attempt: Attempt) => number): Attempt | null {
  return attempts.reduce<Attempt | null>(
    (best, attempt) => (best === null || time(attempt) > time(best) ? attempt : best),
    null,
  );
}

function workMinutes(attempt: Attempt, until: number): number {
  const end = attempt.finishedAt === null ? until : Date.parse(attempt.finishedAt);
  return Math.max(0, Math.floor((end - Date.parse(attempt.startedAt)) / MINUTE_MS));
}

function eventTime(event: ProcessEvent): number {
  return Date.parse(event.timestamp);
}
