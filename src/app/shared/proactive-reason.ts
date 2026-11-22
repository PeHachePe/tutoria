// No imports: the Edge Function `tutor` imports this file as it is (D-042), and the Edge Runtime
// only resolves imports with their extension. The types it reads are structural instead.

/** Why the tutor steps in without being asked (2.7): `reason` of the request and of its event. */
export const PROACTIVE_REASONS = ['failures', 'idle', 'achievement'] as const;
export type ProactiveReason = (typeof PROACTIVE_REASONS)[number];

/** What is read of a process event: `ProcessEvent` fits it, and so does one not stored yet. */
export type AttemptEvent =
  | {
      readonly type: 'run';
      readonly timestamp: string;
      readonly detail: { readonly failedTestIds: readonly string[] };
    }
  | {
      readonly type: 'proactive_intervention';
      readonly timestamp: string;
      /** Recorded before interventions had a reason (6.2b), it has none. */
      readonly detail: { readonly silent: boolean; readonly reason?: ProactiveReason };
    }
  | {
      readonly type: 'submit' | 'hint_requested' | 'paste' | 'focus_lost' | 'focus_gained';
      readonly timestamp: string;
    };

/** The thresholds of an exercise: `StuckThresholds` fits them. */
export interface ReasonThresholds {
  /** Consecutive runs in which the same test fails. */
  readonly maxRepeatedFailures: number;
  /** Minutes without any activity from the student. */
  readonly maxIdleMinutes: number;
}

/** How often the tutor may step in: the client takes these, and the server a looser copy (2.7). */
export interface ProactiveLimits {
  /** Since the last turn with the tutor, an intervention it kept to itself included. */
  readonly cooldownMs: number;
  /** Taken off the idle threshold, for the clocks of browser and server: only the server gives any. */
  readonly idleSlackMs: number;
  /** Interventions to help in an attempt; the achievements do not count. */
  readonly maxHelp: number;
}

export const PROACTIVE_LIMITS: ProactiveLimits = {
  cooldownMs: 180_000,
  idleSlackMs: 0,
  maxHelp: 5,
};

/** What the reasons are read from: the attempt, its events and the last turn of the student. */
export interface ProactiveInput {
  readonly status: 'in_progress' | 'tests_failed' | 'passed' | 'submitted';
  /** The last change of the attempt: every code save updates it. */
  readonly updatedAt: string;
  readonly events: readonly AttemptEvent[];
  /**
   * The last turn the student asked for (a question or a hint), in ms; null without one. It counts
   * as activity, as in the live panel (D-068). The interventions are read from the events.
   */
  readonly lastTurnAt: number | null;
  readonly thresholds: ReasonThresholds;
  /** In milliseconds. */
  readonly now: number;
}

/** A run that passed a test the student had been failing. */
export interface Breakthrough {
  /** When, in milliseconds. */
  readonly at: number;
  /** Runs in a row in which the test had failed before. */
  readonly failures: number;
  readonly testId: string;
}

const MINUTE_MS = 60_000;

/** Events that show the student is working. `focus_lost` and `proactive_intervention` do not. */
const ACTIVITY_EVENTS: ReadonlySet<AttemptEvent['type']> = new Set([
  'run',
  'submit',
  'hint_requested',
  'paste',
  'focus_gained',
]);

/** The attempts the tutor helps: a passed one only gets congratulated. */
const HELP_STATUSES: ReadonlySet<ProactiveInput['status']> = new Set([
  'in_progress',
  'tests_failed',
]);

/**
 * Why the tutor steps in now, if it does (2.7): every reason that holds, in the order `achievement`,
 * `failures`, `idle`. Shared by the browser, which asks, and the server, which checks the reason it
 * gets is among them (D-065). One intervention for each episode, read from the events, so reloading
 * the page never repeats one:
 * - `achievement`: the latest run passed a test that had failed `maxRepeatedFailures` runs in a row,
 *   and it was not celebrated. Without cooldown or limit, in any attempt not submitted;
 * - `failures`: a test failed `maxRepeatedFailures` runs in a row since the last intervention for
 *   failures (with 3, at 3, 6, 9… failures in a row);
 * - `idle`: `maxIdleMinutes` since the last activity, once for each pause.
 *
 * Help (the last two) only in attempts in progress or with failed tests, `cooldownMs` after the last
 * turn with the tutor and up to `maxHelp` times.
 */
export function proactiveReasons(
  input: ProactiveInput,
  limits: ProactiveLimits = PROACTIVE_LIMITS,
): ProactiveReason[] {
  const { status, events, thresholds, now } = input;
  if (status === 'submitted') return [];
  const interventions = events.flatMap((event) =>
    event.type === 'proactive_intervention'
      ? [{ at: time(event), reason: event.detail.reason }]
      : [],
  );
  const lastOf = (reason: ProactiveReason) =>
    Math.max(-Infinity, ...interventions.filter((i) => i.reason === reason).map((i) => i.at));
  const reasons: ProactiveReason[] = [];

  const breakthrough = lastBreakthrough(events, thresholds.maxRepeatedFailures);
  const lastRunAt = Math.max(-Infinity, ...runsInOrder(events).map(time));
  if (breakthrough?.at === lastRunAt && lastOf('achievement') < breakthrough.at) {
    reasons.push('achievement');
  }

  const lastTurnAt = Math.max(input.lastTurnAt ?? -Infinity, ...interventions.map((i) => i.at));
  const helps = interventions.filter((i) => i.reason !== 'achievement').length;
  if (
    !HELP_STATUSES.has(status) ||
    now - lastTurnAt < limits.cooldownMs ||
    helps >= limits.maxHelp
  ) {
    return reasons;
  }

  const sinceFailures = lastOf('failures');
  const newRuns = events.filter((event) => event.type !== 'run' || time(event) > sinceFailures);
  if (failureStreak(newRuns) >= thresholds.maxRepeatedFailures) reasons.push('failures');

  const activity = Math.max(lastActivityAt(input, events), input.lastTurnAt ?? -Infinity);
  const idleFor = thresholds.maxIdleMinutes * MINUTE_MS - limits.idleSlackMs;
  if (now - activity >= idleFor && lastOf('idle') < activity) reasons.push('idle');

  return reasons;
}

/** The first of `proactiveReasons()`, or null without any. */
export function proactiveReason(
  input: ProactiveInput,
  limits: ProactiveLimits = PROACTIVE_LIMITS,
): ProactiveReason | null {
  return proactiveReasons(input, limits)[0] ?? null;
}

/**
 * The test failing in the latest run that has failed in the most runs in a row, counting back from
 * it; null before any run or with every test passed. Of two with as many, the first of the run.
 */
export function currentFailure(
  events: readonly AttemptEvent[],
): { readonly testId: string; readonly runs: number } | null {
  let current: { testId: string; runs: number } | null = null;
  for (const [testId, runs] of failingStreaks(events)) {
    if (runs > (current?.runs ?? 0)) current = { testId, runs };
  }
  return current;
}

/** Longest run of latest consecutive runs in which one same test failed. */
export function failureStreak(events: readonly AttemptEvent[]): number {
  return currentFailure(events)?.runs ?? 0;
}

/**
 * Each test failing in the latest run, with the runs in a row, counting back from it, in which it
 * failed. Empty before any run or with every test passed.
 */
export function failingStreaks(events: readonly AttemptEvent[]): ReadonlyMap<string, number> {
  const runs = failedTestsByRun(events);
  const failingNow = runs.at(-1) ?? [];
  return new Map(failingNow.map((testId) => [testId, trailingFailures(runs, testId)]));
}

/** The tests that failed in each run, in the order of the runs. */
export function failedTestsByRun(events: readonly AttemptEvent[]): (readonly string[])[] {
  return runsInOrder(events).map((run) => run.detail.failedTestIds);
}

/** Time of the latest activity on an attempt, in milliseconds. */
export function lastActivityAt(
  attempt: { readonly updatedAt: string },
  events: readonly AttemptEvent[],
): number {
  const activityTimes = events.filter((event) => ACTIVITY_EVENTS.has(event.type)).map(time);
  return Math.max(Date.parse(attempt.updatedAt), ...activityTimes);
}

/**
 * The latest run that passed a test after it failed in at least `threshold` runs in a row (2.7,
 * RF-09): an achievement worth celebrating. The teacher's panel shows it as perseverance (D-054)
 * and the proactive tutor congratulates on it.
 */
export function lastBreakthrough(
  events: readonly AttemptEvent[],
  threshold: number,
): Breakthrough | null {
  let streaks = new Map<string, number>();
  let latest: Breakthrough | null = null;
  for (const run of runsInOrder(events)) {
    const failing = new Set(run.detail.failedTestIds);
    for (const [testId, failures] of streaks) {
      if (!failing.has(testId) && failures >= threshold) {
        latest = { at: time(run), failures, testId };
      }
    }
    streaks = new Map([...failing].map((testId) => [testId, (streaks.get(testId) ?? 0) + 1]));
  }
  return latest;
}

type RunEvent = Extract<AttemptEvent, { type: 'run' }>;

function runsInOrder(events: readonly AttemptEvent[]): RunEvent[] {
  return events
    .flatMap((event) => (event.type === 'run' ? [event] : []))
    .sort((a, b) => time(a) - time(b));
}

/** Runs in a row, counting back from the latest, in which `testId` failed. */
function trailingFailures(runs: readonly (readonly string[])[], testId: string): number {
  let count = 0;
  while (count < runs.length && runs[runs.length - 1 - count].includes(testId)) {
    count++;
  }
  return count;
}

function time(event: { readonly timestamp: string }): number {
  return Date.parse(event.timestamp);
}
