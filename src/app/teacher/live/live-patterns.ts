import type { ProcessEvent } from '../../data/process-event';

/** A paste this long or longer is a lot of text from outside the editor: a few lines of code. */
export const LARGE_PASTE_CHARS = 100;
/** Runs at most of an attempt submitted with a large paste. */
export const FEW_RUNS = 2;
/** A paste this soon after coming back to the window. */
export const PASTE_AFTER_RETURN_MS = 60_000;
/** Submissions within `BURST_MINUTES` that make a burst. */
export const BURST_SUBMISSIONS = 3;
export const BURST_MINUTES = 10;

const MINUTE_MS = 60_000;

/**
 * Something worth a look, said as a fact and never as a verdict (2.8, D-054): the events describe
 * behaviour, they do not prove anything. The teacher opens the attempt and judges.
 */
export type LivePattern =
  /** Nothing opened in the block while the class works. */
  | { readonly kind: 'not_started' }
  /** Opened something but did nothing in the session while the class works. */
  | { readonly kind: 'inactive' }
  /** Submitted with a large paste and few runs. */
  | { readonly kind: 'paste_submit'; readonly chars: number; readonly runs: number }
  /** Pasted a lot soon after coming back to the window. */
  | { readonly kind: 'paste_on_return'; readonly chars: number }
  /** Several submissions in a few minutes. */
  | { readonly kind: 'submit_burst'; readonly count: number; readonly minutes: number };

/** What the patterns of a student look at. */
export interface PatternInput {
  readonly hasAttempts: boolean;
  /** The student did something in the session window. */
  readonly active: boolean;
  /** Somebody in the class did something in the session window. */
  readonly classActive: boolean;
  /** Events of the student in the session window. */
  readonly events: readonly ProcessEvent[];
  readonly submittedAttemptIds: ReadonlySet<string>;
}

/** The patterns of a student in the session, in the order the panel lists them. */
export function livePatterns(input: PatternInput): LivePattern[] {
  if (!input.active) {
    if (!input.classActive) return [];
    return [{ kind: input.hasAttempts ? 'inactive' : 'not_started' }];
  }
  const events = [...input.events].sort((a, b) => time(a) - time(b));
  return [
    pasteSubmit(events, input.submittedAttemptIds),
    pasteOnReturn(events),
    burst(events),
  ].filter((pattern) => pattern !== null);
}

function pasteSubmit(
  events: readonly ProcessEvent[],
  submitted: ReadonlySet<string>,
): LivePattern | null {
  for (const attemptId of submitted) {
    const own = events.filter((event) => event.attemptId === attemptId);
    const chars = own.reduce(
      (total, event) => total + (event.type === 'paste' ? event.detail.length : 0),
      0,
    );
    const runs = own.filter((event) => event.type === 'run').length;
    if (chars >= LARGE_PASTE_CHARS && runs <= FEW_RUNS) {
      return { kind: 'paste_submit', chars, runs };
    }
  }
  return null;
}

function pasteOnReturn(events: readonly ProcessEvent[]): LivePattern | null {
  let returnedAt: number | null = null;
  let largest = 0;
  for (const event of events) {
    if (event.type === 'focus_gained') {
      returnedAt = time(event);
    } else if (
      event.type === 'paste' &&
      event.detail.length >= LARGE_PASTE_CHARS &&
      returnedAt !== null &&
      time(event) - returnedAt <= PASTE_AFTER_RETURN_MS
    ) {
      largest = Math.max(largest, event.detail.length);
    }
  }
  return largest > 0 ? { kind: 'paste_on_return', chars: largest } : null;
}

function burst(events: readonly ProcessEvent[]): LivePattern | null {
  const submits = events.filter((event) => event.type === 'submit').map(time);
  let best = 0;
  for (const [index, start] of submits.entries()) {
    const count = submits
      .slice(index)
      .filter((at) => at - start <= BURST_MINUTES * MINUTE_MS).length;
    best = Math.max(best, count);
  }
  return best >= BURST_SUBMISSIONS
    ? { kind: 'submit_burst', count: best, minutes: BURST_MINUTES }
    : null;
}

function time(event: ProcessEvent): number {
  return Date.parse(event.timestamp);
}
