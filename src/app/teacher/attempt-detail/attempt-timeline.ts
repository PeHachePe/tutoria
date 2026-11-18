import type { Attempt } from '../../data/attempt';
import type { LiveExercise } from '../../data/live-service';
import type { ProcessEvent } from '../../data/process-event';
import type { HintLevel, TutorInteraction } from '../../data/tutor';
import { formatCall } from '../../shared/format-value';

const MINUTE_MS = 60_000;

/** Minutes without anything happening that the timeline marks between two entries. */
export const TIMELINE_GAP_MINUTES = 5;

/** Runs in a row with the same result that the timeline tells as one entry. */
export const RUN_GROUP_MIN = 2;

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
  /** Milliseconds; of a group of runs, the latest. */
  readonly at: number;
  /** Minutes of silence before it, when it was long; null otherwise. */
  readonly gapMinutes: number | null;
  /** The process events it tells: every run of a group, or the hint or intervention of an answer. */
  readonly eventIds: readonly string[];
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
        /** Runs in a row with this same result; 1 for a single one. */
        readonly count: number;
        /** When the first of them ran: `at` for a single one. */
        readonly from: number;
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
 * The attempt from its opening, the latest first: each tutor answer once (with the hint or
 * intervention it recorded), a time away joined with its return, runs in a row with the same
 * result as one entry and the long silences marked.
 */
export function attemptTimeline(
  attempt: Attempt,
  events: readonly ProcessEvent[],
  interactions: readonly TutorInteraction[],
  { exercise, tests }: LiveExercise,
): TimelineEntry[] {
  const sorted = [...events].sort((a, b) => time(a) - time(b));
  const unpaired = new Set(interactions);
  /** The hint or intervention event each answer recorded, by the id of the interaction. */
  const pairedEvent = new Map<string, string>();
  const drafts: Draft[] = [
    { id: 'start', kind: 'start', at: Date.parse(attempt.startedAt), eventIds: [] },
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
          eventIds: [event.id],
          passed: event.detail.passed,
          total: event.detail.passed + event.detail.failed,
          failing: tests
            .filter((test) => failed.has(test.id))
            .map((test) => ({
              id: test.id,
              call: formatCall(exercise.functionName, test.input),
              hidden: test.isHidden,
            })),
          count: 1,
          from: at,
        });
        break;
      }
      case 'hint_requested': {
        const answer = takeAnswer(unpaired, 'hint', at);
        if (answer) {
          pairedEvent.set(answer.id, event.id);
        } else {
          drafts.push({
            id: event.id,
            kind: 'hint',
            at,
            eventIds: [event.id],
            level: event.detail.level,
          });
        }
        break;
      }
      case 'proactive_intervention': {
        const answer = event.detail.silent ? null : takeAnswer(unpaired, 'proactive', at);
        if (answer) {
          pairedEvent.set(answer.id, event.id);
        } else {
          drafts.push({
            id: event.id,
            kind: 'proactive',
            at,
            eventIds: [event.id],
            silent: event.detail.silent,
          });
        }
        break;
      }
      case 'paste':
        drafts.push({
          id: event.id,
          kind: 'paste',
          at,
          eventIds: [event.id],
          length: event.detail.length,
        });
        break;
      case 'focus_lost':
        if (away) drafts.push(unreturned(away));
        away = event;
        break;
      case 'focus_gained':
        drafts.push(
          away
            ? {
                id: away.id,
                kind: 'away',
                at: time(away),
                eventIds: [away.id, event.id],
                ms: event.detail.awayMs,
              }
            : {
                id: event.id,
                kind: 'away',
                at: at - event.detail.awayMs,
                eventIds: [event.id],
                ms: event.detail.awayMs,
              },
        );
        away = null;
        break;
      case 'submit':
        drafts.push({ id: event.id, kind: 'submit', at, eventIds: [event.id] });
        break;
    }
  }
  if (away) drafts.push(unreturned(away));
  // After the opening and before the events, so what happens at the same time keeps that order
  drafts.splice(
    1,
    0,
    ...interactions.map((interaction): Draft => {
      const eventId = pairedEvent.get(interaction.id);
      return {
        id: interaction.id,
        kind: 'tutor',
        at: Date.parse(interaction.createdAt),
        eventIds: eventId ? [eventId] : [],
        interaction,
      };
    }),
  );

  // Stable: what happened at the same time keeps the order above
  const entries = drafts
    .sort((a, b) => a.at - b.at)
    .map((draft, index, all): TimelineEntry => {
      const minutes = index === 0 ? 0 : Math.floor((draft.at - all[index - 1].at) / MINUTE_MS);
      return { ...draft, gapMinutes: minutes >= TIMELINE_GAP_MINUTES ? minutes : null };
    });
  return groupRuns(entries).reverse();
}

/**
 * Each run joins the entry before it when that one is a run failing the same tests and no long
 * silence separates them: anything in between (a hint, a paste) splits the group.
 */
function groupRuns(entries: readonly TimelineEntry[]): TimelineEntry[] {
  const grouped: TimelineEntry[] = [];
  for (const entry of entries) {
    const previous = grouped.at(-1);
    if (
      entry.kind === 'run' &&
      previous?.kind === 'run' &&
      entry.gapMinutes === null &&
      sameTests(previous.failing, entry.failing)
    ) {
      grouped[grouped.length - 1] = {
        ...previous,
        at: entry.at,
        passed: entry.passed,
        total: entry.total,
        count: previous.count + 1,
        eventIds: [...previous.eventIds, ...entry.eventIds],
      };
    } else {
      grouped.push(entry);
    }
  }
  return grouped;
}

function sameTests(a: readonly FailingTest[], b: readonly FailingTest[]): boolean {
  return a.length === b.length && a.every((test, index) => test.id === b[index].id);
}

function unreturned(lost: Extract<ProcessEvent, { type: 'focus_lost' }>): Draft {
  return { id: lost.id, kind: 'away', at: time(lost), eventIds: [lost.id], ms: null };
}

/** The id of the entry that tells an event or an interaction, or null. */
export function entryIdOf(timeline: readonly TimelineEntry[], id: string): string | null {
  return timeline.find((entry) => entry.id === id || entry.eventIds.includes(id))?.id ?? null;
}

/** Takes out of `unpaired` the answer recorded with a hint or intervention at `at`, if there is one. */
function takeAnswer(
  unpaired: Set<TutorInteraction>,
  trigger: TutorInteraction['trigger'],
  at: number,
): TutorInteraction | null {
  const answer = [...unpaired].find(
    (interaction) =>
      interaction.trigger === trigger &&
      Math.abs(Date.parse(interaction.createdAt) - at) <= ANSWER_PAIRING_MS,
  );
  if (answer) unpaired.delete(answer);
  return answer ?? null;
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
