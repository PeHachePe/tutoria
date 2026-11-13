import type { Attempt, AttemptStatus } from '../../data/attempt';
import type { LiveExercise, LiveStudent } from '../../data/live-service';
import type { ProcessEvent } from '../../data/process-event';
import { type HintLevel, MAX_HINT_LEVEL } from '../../data/tutor';
import { awaySince } from '../../shared/away-since';
import { failureStreak, lastActivityAt, stuckReason } from '../../shared/is-stuck';
import { type Breakthrough, lastBreakthrough } from '../../shared/last-breakthrough';
import type { TestCount } from '../../shared/status-chip/status-chip';
import type { StudentActivity } from './live-state';
import { type LivePattern, livePatterns } from './live-patterns';

/**
 * Minutes of the session: only what moved in them is live (D-054). Older work is history, and a
 * student who left an exercise days ago is not stuck now.
 */
export const LIVE_WINDOW_MINUTES = 60;

const MINUTE_MS = 60_000;

/** Hints in a row, without running the tests between them, that read as asking instead of trying. */
export const HINT_RUSH_COUNT = 3;

/**
 * Why a student may need the teacher now, where the tutor does not reach (D-054), and since when,
 * in milliseconds: the queue serves first whoever has waited longest. Away comes first: nobody is
 * in front of the screen.
 */
export type LiveSignal =
  | { readonly kind: 'away'; readonly minutes: number; readonly since: number }
  /** Reached the last hint level and keeps failing: the tutor has nothing more to give. */
  | { readonly kind: 'hints_exhausted'; readonly since: number }
  /** The same test fails again and again; `askedForHints` tells avoiding help apart. */
  | {
      readonly kind: 'stuck_failures';
      readonly failures: number;
      readonly askedForHints: boolean;
      readonly since: number;
    }
  /** Asks for hints one after another without trying them. */
  | { readonly kind: 'hint_rush'; readonly hints: number; readonly since: number }
  | { readonly kind: 'stuck_idle'; readonly minutes: number; readonly since: number };

/** A row of the live panel: a student and the attempt they are on now. */
export interface LiveRow {
  readonly student: LiveStudent;
  /** The attempt of the block that changed last, or null if they opened none. */
  readonly attempt: Attempt | null;
  readonly exercise: LiveExercise | null;
  /** Position of that exercise in the block, from 1. */
  readonly position: number | null;
  /** The attempt is practice after a submission (2.5c): «Repitiendo». */
  readonly repeating: boolean;
  readonly status: AttemptStatus;
  /** Minutes on the attempt: until it was submitted, until now while live, or until its last activity. */
  readonly minutes: number | null;
  readonly hints: number;
  readonly hintLevel: HintLevel | null;
  readonly pastes: number;
  readonly focusLosses: number;
  /** Tests passed in the latest run, or null before any. */
  readonly tests: TestCount | null;
  /** Latest activity in the whole block, in milliseconds, or null. */
  readonly lastActivity: number | null;
  /** Something moved in the session window. */
  readonly active: boolean;
  /** Only for active students. */
  readonly signal: LiveSignal | null;
  /** Assignments of the block with a submitted attempt. */
  readonly submitted: number;
  /** Assignments of the block the student is practising again after submitting them. */
  readonly repeated: number;
  /** A test passed after failing it again and again, in the session window. */
  readonly breakthrough: Breakthrough | null;
  readonly patterns: readonly LivePattern[];
}

/**
 * What the panel says of a student now. `classActive` says whether anybody worked in the session
 * window: without a class going on, not starting is no pattern.
 */
export function liveRow(
  activity: StudentActivity,
  exercises: readonly LiveExercise[],
  now: number,
  classActive: boolean,
): LiveRow {
  const { student, attempts, events } = activity;
  const windowStart = now - LIVE_WINDOW_MINUTES * MINUTE_MS;
  const eventsOf = (attempt: Attempt) => events.filter((event) => event.attemptId === attempt.id);
  const lastOf = (attempt: Attempt) =>
    Math.max(lastActivityAt(attempt, eventsOf(attempt)), ...eventsOf(attempt).map(eventTime));

  const attempt = latest(attempts, lastOf);
  const lastActivity = attempt ? lastOf(attempt) : null;
  const active = lastActivity !== null && lastActivity >= windowStart;
  const index = attempt ? exercises.findIndex((e) => e.assignmentId === attempt.assignmentId) : -1;
  const exercise = index >= 0 ? exercises[index] : null;
  const own = attempt ? eventsOf(attempt) : [];
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
    position: index >= 0 ? index + 1 : null,
    repeating: (attempt?.number ?? 1) > 1,
    status: attempt?.status ?? 'not_started',
    minutes: attempt ? workMinutes(attempt, active ? now : lastOf(attempt)) : null,
    hints: hintLevels.length,
    hintLevel: hintLevels.length > 0 ? (Math.max(...hintLevels) as HintLevel) : null,
    pastes: own.filter((event) => event.type === 'paste').length,
    focusLosses: own.filter((event) => event.type === 'focus_lost').length,
    tests: lastRun
      ? { passed: lastRun.detail.passed, total: lastRun.detail.passed + lastRun.detail.failed }
      : null,
    lastActivity,
    active,
    signal: active && attempt && exercise ? signalOf(attempt, own, exercise, now) : null,
    submitted: new Set(attempts.filter((a) => a.status === 'submitted').map((a) => a.assignmentId))
      .size,
    repeated: new Set(attempts.filter((a) => a.number > 1).map((a) => a.assignmentId)).size,
    breakthrough: breakthrough && breakthrough.at >= windowStart ? breakthrough : null,
    patterns: livePatterns({
      hasAttempts: attempts.length > 0,
      active,
      classActive,
      events: events.filter((event) => eventTime(event) >= windowStart),
      submittedAttemptIds: new Set(
        attempts.filter((a) => a.status === 'submitted').map((a) => a.id),
      ),
    }),
  };
}

function signalOf(
  attempt: Attempt,
  events: readonly ProcessEvent[],
  { exercise }: LiveExercise,
  now: number,
): LiveSignal | null {
  const away = awaySince(events);
  if (away !== null) {
    return { kind: 'away', minutes: minutesBetween(away, now), since: away };
  }
  const open = attempt.status === 'in_progress' || attempt.status === 'tests_failed';
  if (!open) return null;
  const sorted = [...events].sort((a, b) => eventTime(a) - eventTime(b));
  const hints = sorted.filter((event) => event.type === 'hint_requested');
  const lastHint = hints.at(-1);
  if (lastHint?.type === 'hint_requested' && lastHint.detail.level === MAX_HINT_LEVEL) {
    const failingAfter = sorted.find(
      (event) =>
        event.type === 'run' && eventTime(event) > eventTime(lastHint) && event.detail.failed > 0,
    );
    if (failingAfter && attempt.status === 'tests_failed') {
      return { kind: 'hints_exhausted', since: eventTime(failingAfter) };
    }
  }
  const reason = stuckReason(attempt, events, exercise, now);
  if (reason === 'failures') {
    const runs = sorted.filter((event) => event.type === 'run');
    const failures = failureStreak(events);
    // The run that reached the threshold, counting back from the latest
    const reached = runs[runs.length - 1 - (failures - exercise.maxRepeatedFailures)];
    return {
      kind: 'stuck_failures',
      failures,
      askedForHints: hints.length > 0,
      since: eventTime(reached),
    };
  }
  const lastRun = sorted.filter((event) => event.type === 'run').at(-1);
  const hintsSinceRun = hints.filter(
    (hint) => lastRun === undefined || eventTime(hint) > eventTime(lastRun),
  );
  if (hintsSinceRun.length >= HINT_RUSH_COUNT) {
    return {
      kind: 'hint_rush',
      hints: hintsSinceRun.length,
      since: eventTime(hintsSinceRun[HINT_RUSH_COUNT - 1]),
    };
  }
  if (reason === 'idle') {
    const last = lastActivityAt(attempt, events);
    return {
      kind: 'stuck_idle',
      minutes: minutesBetween(last, now),
      since: last + exercise.maxIdleMinutes * MINUTE_MS,
    };
  }
  return null;
}

function latest(attempts: readonly Attempt[], time: (attempt: Attempt) => number): Attempt | null {
  return attempts.reduce<Attempt | null>(
    (best, attempt) => (best === null || time(attempt) > time(best) ? attempt : best),
    null,
  );
}

function workMinutes(attempt: Attempt, until: number): number {
  const end = attempt.finishedAt === null ? until : Date.parse(attempt.finishedAt);
  return minutesBetween(Date.parse(attempt.startedAt), end);
}

function minutesBetween(from: number, to: number): number {
  return Math.max(0, Math.floor((to - from) / MINUTE_MS));
}

function eventTime(event: ProcessEvent): number {
  return Date.parse(event.timestamp);
}
