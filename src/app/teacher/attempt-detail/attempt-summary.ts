import type { Attempt } from '../../data/attempt';
import { LIVE_WINDOW_MINUTES } from '../../data/live-service';
import type { ProcessEvent } from '../../data/process-event';
import type { HintLevel, TutorInteraction } from '../../data/tutor';
import type { AttemptMode } from './attempt-now';

const MINUTE_MS = 60_000;

/** What the line under «Ahora» and its chips say of an attempt; the view leaves out what is zero. */
export interface AttemptSummary {
  /** Milliseconds of work: without the time between two sittings. */
  readonly workMs: number;
  readonly runs: number;
  readonly hints: number;
  /** The highest level asked for, or null without hints. */
  readonly hintLevel: HintLevel | null;
  readonly questions: number;
  readonly pastedChars: number;
  /** Out of the window, in the absences that ended. */
  readonly awayMs: number;
}

/**
 * The work is the sum of the time between two moments of the attempt in a row (its opening, each
 * event, each tutor turn, the latest save and its end) shorter than the session window: an attempt
 * taken up again three days later does not say «3 d of work». The end is the submission, now while
 * the student is on it, or nothing else.
 */
export function attemptSummary(
  attempt: Attempt,
  events: readonly ProcessEvent[],
  interactions: readonly TutorInteraction[],
  mode: AttemptMode,
  now: number,
): AttemptSummary {
  const moments = [
    Date.parse(attempt.startedAt),
    ...events.map((event) => Date.parse(event.timestamp)),
    ...interactions.map((interaction) => Date.parse(interaction.createdAt)),
    Date.parse(attempt.updatedAt),
    ...(mode === 'solved' && attempt.finishedAt ? [Date.parse(attempt.finishedAt)] : []),
    ...(mode === 'now' ? [now] : []),
  ].sort((a, b) => a - b);
  let workMs = 0;
  for (let index = 1; index < moments.length; index++) {
    const pause = moments[index] - moments[index - 1];
    if (pause < LIVE_WINDOW_MINUTES * MINUTE_MS) workMs += pause;
  }

  let runs = 0;
  let pastedChars = 0;
  let awayMs = 0;
  const levels: HintLevel[] = [];
  for (const event of events) {
    switch (event.type) {
      case 'run':
        runs++;
        break;
      case 'hint_requested':
        levels.push(event.detail.level);
        break;
      case 'paste':
        pastedChars += event.detail.length;
        break;
      case 'focus_gained':
        awayMs += event.detail.awayMs;
        break;
    }
  }
  return {
    workMs,
    runs,
    hints: levels.length,
    hintLevel: levels.length > 0 ? (Math.max(...levels) as HintLevel) : null,
    questions: interactions.filter((interaction) => interaction.trigger === 'question').length,
    pastedChars,
    awayMs,
  };
}
