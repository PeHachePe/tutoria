import type { AttemptNow } from '../../teacher/attempt-detail/attempt-now';
import type { AttemptRuns, EvolutionItem } from '../../teacher/attempt-detail/attempt-runs';
import type { AttemptSummary } from '../../teacher/attempt-detail/attempt-summary';

/** Pieces of the attempt detail (ficha 07) with sample data, for the showcase. */

const MINUTE_MS = 60_000;
/** A fixed morning, so the showcase reads the same every day. */
const START = Date.parse('2026-11-13T10:00:00.000Z');
const at = (minutes: number) => START + minutes * MINUTE_MS;

/** Four runs, 3/6, 3/6, 5/6 and 6/6, with two hints and a paste between them. */
export const SAMPLE_EVOLUTION: readonly EvolutionItem[] = [
  { kind: 'run', id: 'run-1', at: at(2), passed: 3, total: 6 },
  { kind: 'hint', id: 'hint-1', at: at(4), level: 1 },
  { kind: 'run', id: 'run-2', at: at(6), passed: 3, total: 6 },
  { kind: 'hint', id: 'hint-2', at: at(9), level: 2 },
  { kind: 'paste', id: 'paste-1', at: at(11), length: 120 },
  { kind: 'run', id: 'run-3', at: at(12), passed: 5, total: 6 },
  { kind: 'run', id: 'run-4', at: at(15), passed: 6, total: 6 },
];

/** A student working on it: two tests fail and the tutor gave a hint. */
export const SAMPLE_NOW: AttemptNow = {
  mode: 'now',
  lastRun: { passed: 4, total: 6 },
  tests: [
    { id: 't4', call: 'maximum([-5, -2, -8])', expected: '-2', hidden: false, runs: 4 },
    { id: 't6', call: 'maximum([])', expected: 'null', hidden: true, runs: 2 },
  ],
  failingRunId: 'run-3',
  help: {
    entryId: 'hint-2',
    trigger: 'hint',
    level: 2,
    at: at(9),
    question: null,
    text: '¿Con qué valor empiezas a comparar? Piensa en un vector con todos los números negativos.',
  },
};

export const SAMPLE_NOW_SUMMARY: AttemptSummary = {
  workMs: 18 * MINUTE_MS,
  runs: 5,
  hints: 2,
  hintLevel: 2,
  questions: 1,
  pastedChars: 120,
  awayMs: 3 * MINUTE_MS,
};

/** A submitted attempt: three tests failed on the way. */
export const SAMPLE_SOLVED: AttemptNow = {
  mode: 'solved',
  lastRun: { passed: 6, total: 6 },
  tests: [
    { id: 't2', call: 'sum([1, 2, 3])', expected: '6', hidden: false, runs: 2 },
    { id: 't3', call: 'sum([-1, 1])', expected: '0', hidden: false, runs: 2 },
    { id: 't5', call: 'sum([0.5, 0.25])', expected: '0.75', hidden: true, runs: 1 },
  ],
  failingRunId: 'run-3',
  help: {
    entryId: 'hint-3',
    trigger: 'hint',
    level: 3,
    at: at(14),
    question: null,
    text: 'El acumulador tiene que empezar en 0 antes del bucle.',
  },
};

export const SAMPLE_SOLVED_SUMMARY: AttemptSummary = {
  workMs: 27 * MINUTE_MS,
  runs: 4,
  hints: 3,
  hintLevel: 3,
  questions: 0,
  pastedChars: 0,
  awayMs: 0,
};

/** The clock of the samples: a little after the latest help. */
export const SAMPLE_CLOCK = at(20);

const TOTAL = 6;

/**
 * A run more for the evolution, two minutes after the latest item: one test more than the run
 * before, and back to none after all. `items` start with the sample, so they end with a run.
 */
export function nextRun(items: readonly EvolutionItem[]): EvolutionItem {
  const last = items[items.length - 1] as Extract<EvolutionItem, { kind: 'run' }>;
  return {
    kind: 'run',
    id: `run-${items.length + 1}`,
    at: last.at + 2 * MINUTE_MS,
    passed: (last.passed + 1) % (TOTAL + 1),
    total: TOTAL,
  };
}

/** The evolution of `items`, with its counts. */
export function sampleRuns(items: readonly EvolutionItem[]): AttemptRuns {
  const count = (kind: EvolutionItem['kind']) => items.filter((item) => item.kind === kind).length;
  return { items, runs: count('run'), hints: count('hint'), pastes: count('paste') };
}
