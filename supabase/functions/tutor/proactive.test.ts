import { assertEquals } from '@std/assert';

import type { AttemptEvent } from '../../../src/app/shared/proactive-reason.ts';
import type { AttemptActivity } from './answer-store.ts';
import { checkReason, SERVER_PROACTIVE_LIMITS } from './proactive.ts';

const NOW = Date.parse('2026-11-22T10:00:00Z');
const MINUTE = 60_000;

/** A moment `ms` before now, as the database gives it. */
function ago(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

function run(msAgo: number, failedTestIds: string[] = []): AttemptEvent {
  return { type: 'run', timestamp: ago(msAgo), detail: { failedTestIds } };
}

function intervention(
  msAgo: number,
  reason: 'failures' | 'idle' | 'achievement' | undefined,
  silent = false,
): AttemptEvent {
  return {
    type: 'proactive_intervention',
    timestamp: ago(msAgo),
    detail: { silent, ...(reason ? { reason } : {}) },
  };
}

/** Saved a while ago, with the thresholds by default (3 failures, 4 minutes). */
function activity(
  events: AttemptEvent[],
  { updatedAt = ago(MINUTE), lastTurnAt = null as string | null } = {},
): AttemptActivity {
  return {
    updatedAt,
    thresholds: { maxRepeatedFailures: 3, maxIdleMinutes: 4 },
    events,
    lastTurnAt,
  };
}

const FAILING = [run(40_000, ['t1']), run(30_000, ['t1', 't2']), run(20_000, ['t1'])];

Deno.test('the server gives a cooldown of 2 minutes and 30 seconds of slack to the pause', () => {
  assertEquals(SERVER_PROACTIVE_LIMITS.cooldownMs, 2 * MINUTE);
  assertEquals(SERVER_PROACTIVE_LIMITS.idleSlackMs, 30_000);
  assertEquals(SERVER_PROACTIVE_LIMITS.maxHelp, 5);
});

Deno.test('repeated failures hold with the test that fails and its runs', () => {
  assertEquals(checkReason('failures', 'tests_failed', activity(FAILING), NOW), {
    reason: 'failures',
    testId: 't1',
    runs: 3,
  });
});

Deno.test('repeated failures do not hold one run short, nor after the reason was given', () => {
  assertEquals(checkReason('failures', 'tests_failed', activity(FAILING.slice(1)), NOW), null);
  // Long enough ago for the cooldown: only the episode stops it
  const answered = [
    run(10 * MINUTE, ['t1']),
    run(9 * MINUTE, ['t1']),
    run(8.5 * MINUTE, ['t1']),
    intervention(8 * MINUTE, 'failures'),
    run(7 * MINUTE, ['t1']),
  ];
  assertEquals(checkReason('failures', 'tests_failed', activity(answered), NOW), null);
});

Deno.test('a pause holds with its minutes, rounded', () => {
  assertEquals(
    checkReason('idle', 'in_progress', activity([], { updatedAt: ago(5 * MINUTE) }), NOW),
    { reason: 'idle', minutes: 5 },
  );
});

Deno.test('a pause holds 30 seconds before the threshold, and not before that', () => {
  assertEquals(
    checkReason('idle', 'in_progress', activity([], { updatedAt: ago(3.5 * MINUTE) }), NOW),
    { reason: 'idle', minutes: 4 },
  );
  assertEquals(
    checkReason('idle', 'in_progress', activity([], { updatedAt: ago(3.5 * MINUTE - 1) }), NOW),
    null,
  );
});

Deno.test('a question of the student is activity: no pause right after it', () => {
  const asked = activity([], { updatedAt: ago(10 * MINUTE), lastTurnAt: ago(3 * MINUTE) });
  assertEquals(checkReason('idle', 'in_progress', asked, NOW), null);
});

Deno.test('a pause is stepped in on once', () => {
  const answered = activity([intervention(4 * MINUTE, 'idle', true)], {
    updatedAt: ago(10 * MINUTE),
  });
  assertEquals(checkReason('idle', 'in_progress', answered, NOW), null);
});

Deno.test('an achievement holds with the test passed and the failures it took', () => {
  const passed = [...FAILING, run(5_000)];
  assertEquals(checkReason('achievement', 'passed', activity(passed), NOW), {
    reason: 'achievement',
    testId: 't1',
    failures: 3,
  });
});

Deno.test('an achievement does not hold without a breakthrough, nor twice', () => {
  assertEquals(checkReason('achievement', 'passed', activity([run(5_000)]), NOW), null);
  const celebrated = [...FAILING, run(5_000), intervention(4_000, 'achievement')];
  assertEquals(checkReason('achievement', 'passed', activity(celebrated), NOW), null);
});

Deno.test('the cooldown of the server is 2 minutes since the last turn with the tutor', () => {
  const asked = (msAgo: number) =>
    checkReason('failures', 'tests_failed', activity(FAILING, { lastTurnAt: ago(msAgo) }), NOW);
  assertEquals(asked(2 * MINUTE)?.reason, 'failures');
  assertEquals(asked(2 * MINUTE - 1), null);
  // A silent intervention counts too
  const quiet = [intervention(2 * MINUTE - 1, 'idle', true), ...FAILING];
  assertEquals(checkReason('failures', 'tests_failed', activity(quiet), NOW), null);
});

Deno.test('after 5 interventions to help, only an achievement', () => {
  const helped = [
    intervention(60 * MINUTE, undefined),
    ...[50, 40, 30, 20].map((minutes) => intervention(minutes * MINUTE, 'idle')),
  ];
  assertEquals(
    checkReason('failures', 'tests_failed', activity([...helped, ...FAILING]), NOW),
    null,
  );
  const passed = [...helped, ...FAILING, run(5_000)];
  assertEquals(
    checkReason('achievement', 'tests_failed', activity(passed), NOW)?.reason,
    'achievement',
  );
});

Deno.test('an achievement and failures at once: both reasons hold', () => {
  // t1 passes after failing 3 runs, and t2 fails its third run in a row
  const both = [
    run(50_000, ['t1']),
    run(40_000, ['t1', 't2']),
    run(30_000, ['t1', 't2']),
    run(5_000, ['t2']),
  ];
  assertEquals(checkReason('achievement', 'tests_failed', activity(both), NOW), {
    reason: 'achievement',
    testId: 't1',
    failures: 3,
  });
  assertEquals(checkReason('failures', 'tests_failed', activity(both), NOW), {
    reason: 'failures',
    testId: 't2',
    runs: 3,
  });
});

Deno.test('a submitted attempt gets no intervention', () => {
  assertEquals(
    checkReason('achievement', 'submitted', activity([...FAILING, run(5_000)]), NOW),
    null,
  );
});
