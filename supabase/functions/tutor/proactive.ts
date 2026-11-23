import {
  currentFailure,
  lastActivityAt,
  lastBreakthrough,
  PROACTIVE_LIMITS,
  type ProactiveInput,
  type ProactiveLimits,
  type ProactiveReason,
  proactiveReasons,
} from '../../../src/app/shared/proactive-reason.ts';
import type { AttemptActivity } from './answer-store.ts';

/**
 * The limits of the browser, looser for its clock and for the time a request takes (2.7, D-065):
 * a cooldown of 2 minutes instead of 3, and a pause 30 seconds shorter.
 */
export const SERVER_PROACTIVE_LIMITS: ProactiveLimits = {
  ...PROACTIVE_LIMITS,
  cooldownMs: 120_000,
  idleSlackMs: 30_000,
};

/** What the tutor is told of the reason it steps in for (prompt v7). */
export type ProactiveFacts =
  | { readonly reason: 'failures'; readonly testId: string; readonly runs: number }
  | { readonly reason: 'idle'; readonly minutes: number }
  | { readonly reason: 'achievement'; readonly testId: string; readonly failures: number };

const MINUTE_MS = 60_000;

/**
 * The facts of the reason the app gives, or null if the data of the server do not hold it (D-065):
 * `kind: 'proactive'` is chosen in the browser, so the server works the reasons out again, with the
 * same function and some slack. Without them, the tutor keeps quiet and the model is not asked.
 */
export function checkReason(
  reason: ProactiveReason,
  status: ProactiveInput['status'],
  activity: AttemptActivity,
  now: number,
): ProactiveFacts | null {
  const { events, thresholds } = activity;
  const lastTurnAt = activity.lastTurnAt === null ? null : Date.parse(activity.lastTurnAt);
  const reasons = proactiveReasons(
    { status, updatedAt: activity.updatedAt, events, lastTurnAt, thresholds, now },
    SERVER_PROACTIVE_LIMITS,
  );
  if (!reasons.includes(reason)) return null;
  switch (reason) {
    case 'failures': {
      const failure = currentFailure(events);
      return failure && { reason, testId: failure.testId, runs: failure.runs };
    }
    case 'idle': {
      // A question is activity too, as `proactiveReasons()` reads it (D-088)
      const since = Math.max(lastActivityAt(activity, events), lastTurnAt ?? -Infinity);
      return { reason, minutes: Math.max(1, Math.round((now - since) / MINUTE_MS)) };
    }
    case 'achievement': {
      const breakthrough = lastBreakthrough(events, thresholds.maxRepeatedFailures);
      return (
        breakthrough && { reason, testId: breakthrough.testId, failures: breakthrough.failures }
      );
    }
  }
}
