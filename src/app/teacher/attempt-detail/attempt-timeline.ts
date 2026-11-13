import type { Attempt } from '../../data/attempt';
import type { LiveExercise } from '../../data/live-service';
import type { ProcessEvent } from '../../data/process-event';
import { type HintLevel, type TutorInteraction } from '../../data/tutor';
import { formatCall } from '../../shared/format-value';
import type { TestCount } from '../../shared/status-chip/status-chip';
import { LIVE_WINDOW_MINUTES } from '../live/live-row';

const MINUTE_MS = 60_000;

/** Minutes without anything happening that the timeline marks between two entries. */
export const TIMELINE_GAP_MINUTES = 5;

/**
 * Longest time between a hint or an intervention and the answer the tutor recorded with it. The
 * server writes both at once (`record_tutor_interaction`); the margin covers the mock data.
 */
const ANSWER_PAIRING_MS = 60_000;

/** A test that failed in a run, as the student would call it. */
export interface FailingTest {
  readonly id: string;
  readonly call: string;
  readonly hidden: boolean;
}

interface EntryBase {
  readonly id: string;
  /** Milliseconds. */
  readonly at: number;
  /** Minutes since the previous entry, when there was a long silence; null otherwise. */
  readonly gapMinutes: number | null;
}

/** Something that happened in an attempt, as the timeline of the detail tells it (RF-12). */
export type TimelineEntry = EntryBase &
  (
    | { readonly kind: 'start' }
    | {
        readonly kind: 'run';
        readonly passed: number;
        readonly total: number;
        readonly failing: readonly FailingTest[];
      }
    | { readonly kind: 'tutor'; readonly interaction: TutorInteraction }
    /** A hint whose answer was not recorded. */
    | { readonly kind: 'hint'; readonly level: HintLevel }
    /** An intervention of the tutor on its own; `silent` when it chose to say nothing. */
    | { readonly kind: 'proactive'; readonly silent: boolean }
    | { readonly kind: 'paste'; readonly length: number }
    /** Out of the window for `ms`, or null while the return has not been recorded. */
    | { readonly kind: 'away'; readonly ms: number | null }
    | { readonly kind: 'submit' }
  );

export type TimelineCategory = 'tests' | 'tutor' | 'browser' | 'other';

const CATEGORIES: Record<TimelineEntry['kind'], TimelineCategory> = {
  start: 'other',
  run: 'tests',
  submit: 'tests',
  tutor: 'tutor',
  hint: 'tutor',
  proactive: 'tutor',
  paste: 'browser',
  away: 'browser',
};

/** The filter of the timeline an entry belongs to. */
export function timelineCategory(entry: Pick<TimelineEntry, 'kind'>): TimelineCategory {
  return CATEGORIES[entry.kind];
}

type Draft = TimelineEntry extends infer Entry
  ? Entry extends TimelineEntry
    ? Omit<Entry, 'gapMinutes'>
    : never
  : never;

/**
 * The attempt from its opening, in order: each tutor answer once (with the hint or intervention it
 * recorded), a time away joined with its return, and the long silences marked.
 */
export function attemptTimeline(
  attempt: Attempt,
  events: readonly ProcessEvent[],
  interactions: readonly TutorInteraction[],
  { exercise, tests }: LiveExercise,
): TimelineEntry[] {
  const sorted = [...events].sort((a, b) => time(a) - time(b));
  const unpaired = new Set(interactions);
  const drafts: Draft[] = [
    { id: 'start', kind: 'start', at: Date.parse(attempt.startedAt) },
    ...interactions.map((interaction): Draft => ({
      id: interaction.id,
      kind: 'tutor',
      at: Date.parse(interaction.createdAt),
      interaction,
    })),
  ];
  let away: Extract<ProcessEvent, { type: 'focus_lost' }> | null = null;

  for (const event of sorted) {
    const at = time(event);
    switch (event.type) {
      case 'run': {
        const failed = new Set(event.detail.failedTestIds);
        drafts.push({
          id: event.id,
          kind: 'run',
          at,
          passed: event.detail.passed,
          total: event.detail.passed + event.detail.failed,
          failing: tests
            .filter((test) => failed.has(test.id))
            .map((test) => ({
              id: test.id,
              call: formatCall(exercise.functionName, test.input),
              hidden: test.isHidden,
            })),
        });
        break;
      }
      case 'hint_requested':
        if (!takeAnswer(unpaired, 'hint', at)) {
          drafts.push({ id: event.id, kind: 'hint', at, level: event.detail.level });
        }
        break;
      case 'proactive_intervention':
        if (event.detail.silent || !takeAnswer(unpaired, 'proactive', at)) {
          drafts.push({ id: event.id, kind: 'proactive', at, silent: event.detail.silent });
        }
        break;
      case 'paste':
        drafts.push({ id: event.id, kind: 'paste', at, length: event.detail.length });
        break;
      case 'focus_lost':
        if (away) drafts.push({ id: away.id, kind: 'away', at: time(away), ms: null });
        away = event;
        break;
      case 'focus_gained':
        drafts.push(
          away
            ? { id: away.id, kind: 'away', at: time(away), ms: event.detail.awayMs }
            : { id: event.id, kind: 'away', at: at - event.detail.awayMs, ms: event.detail.awayMs },
        );
        away = null;
        break;
      case 'submit':
        drafts.push({ id: event.id, kind: 'submit', at });
        break;
    }
  }
  if (away) drafts.push({ id: away.id, kind: 'away', at: time(away), ms: null });

  // Stable: what happened at the same time keeps the order above
  return drafts
    .sort((a, b) => a.at - b.at)
    .map((draft, index, all) => {
      const minutes = index === 0 ? 0 : Math.floor((draft.at - all[index - 1].at) / MINUTE_MS);
      return { ...draft, gapMinutes: minutes >= TIMELINE_GAP_MINUTES ? minutes : null };
    });
}

/** Takes out of `unpaired` the answer recorded with a hint or intervention at `at`, if there is one. */
function takeAnswer(
  unpaired: Set<TutorInteraction>,
  trigger: TutorInteraction['trigger'],
  at: number,
): boolean {
  const answer = [...unpaired].find(
    (interaction) =>
      interaction.trigger === trigger &&
      Math.abs(Date.parse(interaction.createdAt) - at) <= ANSWER_PAIRING_MS,
  );
  if (answer) unpaired.delete(answer);
  return answer !== undefined;
}

/** The figures of an attempt, above its timeline. */
export interface AttemptFigures {
  /** Until the submission, until now while the student works, or until their last activity. */
  readonly minutes: number;
  readonly runs: number;
  readonly lastRun: TestCount | null;
  readonly hints: number;
  readonly hintLevel: HintLevel | null;
  readonly questions: number;
  readonly pastes: number;
  readonly pastedChars: number;
  readonly focusLosses: number;
  readonly awayMs: number;
  readonly lastActivity: number;
  /** The student is on it now: open and with activity in the session window (D-054). */
  readonly live: boolean;
}

export function attemptFigures(
  attempt: Attempt,
  events: readonly ProcessEvent[],
  interactions: readonly TutorInteraction[],
  now: number,
): AttemptFigures {
  const of = <Type extends ProcessEvent['type']>(type: Type) =>
    events.filter((event): event is Extract<ProcessEvent, { type: Type }> => event.type === type);
  const runs = of('run').sort((a, b) => time(a) - time(b));
  const lastRun = runs.at(-1);
  const levels = of('hint_requested').map((event) => event.detail.level);
  const lastActivity = Math.max(
    Date.parse(attempt.updatedAt),
    ...events.map(time),
    ...interactions.map((interaction) => Date.parse(interaction.createdAt)),
  );
  const live =
    attempt.status !== 'submitted' && now - lastActivity < LIVE_WINDOW_MINUTES * MINUTE_MS;
  const end = attempt.finishedAt ? Date.parse(attempt.finishedAt) : live ? now : lastActivity;
  return {
    minutes: Math.max(0, Math.floor((end - Date.parse(attempt.startedAt)) / MINUTE_MS)),
    runs: runs.length,
    lastRun: lastRun
      ? { passed: lastRun.detail.passed, total: lastRun.detail.passed + lastRun.detail.failed }
      : null,
    hints: levels.length,
    hintLevel: levels.length > 0 ? (Math.max(...levels) as HintLevel) : null,
    questions: interactions.filter((interaction) => interaction.trigger === 'question').length,
    pastes: of('paste').length,
    pastedChars: of('paste').reduce((sum, event) => sum + event.detail.length, 0),
    focusLosses: of('focus_lost').length,
    awayMs: of('focus_gained').reduce((sum, event) => sum + event.detail.awayMs, 0),
    lastActivity,
    live,
  };
}

/** Every row once, by id: what was loaded, then what arrived live. */
export function mergeById<Row extends { readonly id: string }>(
  loaded: readonly Row[],
  live: readonly Row[],
): Row[] {
  const ids = new Set(loaded.map((row) => row.id));
  return [...loaded, ...live.filter((row) => !ids.has(row.id))];
}

/** The version of an attempt that changed last: the loaded one or the one that arrived live. */
export function latestAttempt(loaded: Attempt, live: Attempt | undefined): Attempt {
  return live && live.updatedAt > loaded.updatedAt ? live : loaded;
}

function time(event: ProcessEvent): number {
  return Date.parse(event.timestamp);
}
