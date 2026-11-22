import type { Attempt } from '../../data/attempt';
import type { StuckThresholds, Test } from '../../data/exercise';
import type { ProcessEvent } from '../../data/process-event';
import { isStuckMessage, MAX_HINT_LEVEL, type TutorInteraction } from '../../data/tutor';
import { failingStreaks, failureStreak } from '../../shared/proactive-reason';

/** Messages in a row telling the tutor they do not know how to go on (D-068). */
export const CHAT_STUCK_MESSAGES = 2;

/** Hints in a row, without running the tests between them, that read as asking instead of trying. */
export const HINT_RUSH_COUNT = 3;

/**
 * Why a student needs the teacher, where the tutor does not reach (D-054, D-068), and since when,
 * in milliseconds: the queue serves first whoever has waited longest. Only reasons in the code,
 * which the teacher solves by coming to look: leaving the window or stopping are not.
 */
export type AttentionReason =
  /** Reached the last hint level and keeps failing: the tutor has nothing more to give. */
  | { readonly kind: 'hints_exhausted'; readonly since: number }
  /** The same test fails again and again; `askedForHints` tells avoiding help apart. */
  | {
      readonly kind: 'stuck_failures';
      readonly failures: number;
      readonly askedForHints: boolean;
      readonly since: number;
    }
  /** Keeps telling the tutor they cannot go on. */
  | { readonly kind: 'chat_stuck'; readonly messages: number; readonly since: number }
  /** Asks for hints one after another without trying them. */
  | { readonly kind: 'hint_rush'; readonly hints: number; readonly since: number };

export type AttentionKind = AttentionReason['kind'];

/** The order of the queue, and of the reasons of one student. */
export const ATTENTION_ORDER: readonly AttentionKind[] = [
  'hints_exhausted',
  'stuck_failures',
  'chat_stuck',
  'hint_rush',
];

/**
 * Why the student of an attempt needs the teacher, or null: the first reason that holds in
 * `ATTENTION_ORDER`, only for an attempt in progress or with failed tests. `events` and
 * `interactions` are those of the attempt.
 */
export function attentionReason(
  attempt: Pick<Attempt, 'status'>,
  events: readonly ProcessEvent[],
  interactions: readonly TutorInteraction[],
  thresholds: Pick<StuckThresholds, 'maxRepeatedFailures'>,
): AttentionReason | null {
  if (attempt.status !== 'in_progress' && attempt.status !== 'tests_failed') {
    return null;
  }
  const sorted = [...events].sort((a, b) => eventTime(a) - eventTime(b));
  return (
    hintsExhausted(attempt, sorted) ??
    stuckFailures(sorted, thresholds.maxRepeatedFailures) ??
    chatStuck(interactions) ??
    hintRush(sorted)
  );
}

/** The test to look at: of those failing in the latest run, the one failing longest. */
export function failingTest(events: readonly ProcessEvent[], tests: readonly Test[]): Test | null {
  const streaks = failingStreaks(events);
  let best: { readonly test: Test; readonly streak: number } | null = null;
  for (const test of tests) {
    const streak = streaks.get(test.id);
    if (streak !== undefined && streak > (best?.streak ?? 0)) {
      best = { test, streak };
    }
  }
  return best?.test ?? null;
}

function hintsExhausted(
  attempt: Pick<Attempt, 'status'>,
  sorted: readonly ProcessEvent[],
): AttentionReason | null {
  const lastHint = sorted.filter((event) => event.type === 'hint_requested').at(-1);
  if (lastHint?.type !== 'hint_requested' || lastHint.detail.level !== MAX_HINT_LEVEL) {
    return null;
  }
  const failingAfter = sorted.find(
    (event) =>
      event.type === 'run' && eventTime(event) > eventTime(lastHint) && event.detail.failed > 0,
  );
  return failingAfter && attempt.status === 'tests_failed'
    ? { kind: 'hints_exhausted', since: eventTime(failingAfter) }
    : null;
}

function stuckFailures(sorted: readonly ProcessEvent[], threshold: number): AttentionReason | null {
  const failures = failureStreak(sorted);
  if (failures < threshold) return null;
  const runs = sorted.filter((event) => event.type === 'run');
  // The run that reached the threshold, counting back from the latest
  const reached = runs[runs.length - 1 - (failures - threshold)];
  return {
    kind: 'stuck_failures',
    failures,
    askedForHints: sorted.some((event) => event.type === 'hint_requested'),
    since: eventTime(reached),
  };
}

/**
 * The same rule as the tutor (`stuckAgain()` of the contract): the turns of the student, past the
 * interventions of the tutor, end with questions saying they cannot go on.
 */
function chatStuck(interactions: readonly TutorInteraction[]): AttentionReason | null {
  const turns = interactions
    .filter((interaction) => interaction.trigger !== 'proactive')
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  let messages = 0;
  while (messages < turns.length && isStuckTurn(turns[turns.length - 1 - messages])) {
    messages++;
  }
  if (messages < CHAT_STUCK_MESSAGES) return null;
  const reached = turns[turns.length - messages + CHAT_STUCK_MESSAGES - 1];
  return { kind: 'chat_stuck', messages, since: Date.parse(reached.createdAt) };
}

function isStuckTurn(turn: TutorInteraction): boolean {
  return turn.trigger === 'question' && isStuckMessage(turn.studentMessage);
}

function hintRush(sorted: readonly ProcessEvent[]): AttentionReason | null {
  const lastRun = sorted.filter((event) => event.type === 'run').at(-1);
  const hints = sorted.filter(
    (event) =>
      event.type === 'hint_requested' &&
      (lastRun === undefined || eventTime(event) > eventTime(lastRun)),
  );
  return hints.length >= HINT_RUSH_COUNT
    ? { kind: 'hint_rush', hints: hints.length, since: eventTime(hints[HINT_RUSH_COUNT - 1]) }
    : null;
}

function eventTime(event: ProcessEvent): number {
  return Date.parse(event.timestamp);
}
