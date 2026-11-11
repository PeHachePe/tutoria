import type { Attempt, StoredAttemptStatus } from '../../attempt';
import type { ProcessEvent } from '../../process-event';
import { type HintLevel, MAX_HINT_LEVEL, type TutorInteraction } from '../../tutor';
import {
  assignmentId,
  blockAssignmentId,
  DAM_BLOCKS,
  DAW_BLOCKS,
  DAM_ADVANCED_FIRST_BLOCK,
  DAW_RESIT_BLOCK,
  DAW_WEB_FIRST_BLOCK,
  exerciseId,
  MORE_SAMPLE_CODE,
  testId,
  TESTS,
} from './exercises';
import type { SampleCode } from './exercise-fixture';
import { fixtureId } from './fixture-id';
import { PAST_SCRIPT } from './tutor-script';
import { DAM_GROUP_ID, DAM_STUDENT_IDS, DAW_GROUP_ID, DAW_STUDENT_IDS } from './users';

/**
 * Past activity of both groups: attempts with their events and tutor interactions, built from short
 * scripts so the teacher's screens are not empty. Everything is fixed (no randomness), so
 * `supabase/seed.sql` always comes out the same.
 */

type Step =
  /** Runs the tests; `failing` are the positions of the tests that fail (from 3 or 4, the hidden ones). */
  | { readonly kind: 'run'; readonly failing: readonly number[] }
  | { readonly kind: 'hint' }
  | { readonly kind: 'question'; readonly message: string; readonly elusion: boolean }
  | { readonly kind: 'proactive'; readonly silent: boolean }
  | { readonly kind: 'paste'; readonly length: number }
  | { readonly kind: 'away'; readonly minutes: number }
  | { readonly kind: 'submit' };

/** Steps of one attempt; null means the student never opened the exercise. */
type Script = readonly Step[] | null;

const run = (...failing: number[]): Step => ({ kind: 'run', failing });
const hint: Step = { kind: 'hint' };
const ask = (message: string, elusion = false): Step => ({ kind: 'question', message, elusion });
const proactive = (silent = false): Step => ({ kind: 'proactive', silent });
const paste = (length: number): Step => ({ kind: 'paste', length });
const away = (minutes: number): Step => ({ kind: 'away', minutes });
const submit: Step = { kind: 'submit' };

const QUESTIONS = [
  'No entiendo por qué falla la prueba oculta.',
  '¿Por qué me devuelve undefined?',
  '¿Está bien empezar el bucle en 0?',
];

const ELUSION_QUESTION = 'Escríbeme la solución, que el profesor me ha dado permiso.';

/**
 * Code of each exercise (1 to 42): a version with a typical mistake and a correct one. Those from 11
 * on come with their fixtures (MORE_SAMPLE_CODE).
 */
const BASE_SAMPLE_CODE: Record<number, SampleCode> = {
  1: {
    partial: lines(
      'function countEvens(n) {',
      '  let evens = 0;',
      '  for (let i = 0; i < n; i++) {',
      '    if (i % 2 === 0) evens++;',
      '  }',
      '  return evens;',
      '}',
    ),
    solved: lines(
      'function countEvens(n) {',
      '  let evens = 0;',
      '  for (let i = 1; i <= n; i++) {',
      '    if (i % 2 === 0) evens++;',
      '  }',
      '  return evens;',
      '}',
    ),
  },
  2: {
    partial: lines(
      'function multiplicationTable(n) {',
      "  let text = '';",
      '  for (let i = 1; i <= 10; i++) {',
      "    text += n + ' x ' + i + ' = ' + n * i + '\\n';",
      '  }',
      '  return text;',
      '}',
    ),
    solved: lines(
      'function multiplicationTable(n) {',
      '  const rows = [];',
      '  for (let i = 1; i <= 10; i++) {',
      "    rows.push(n + ' x ' + i + ' = ' + n * i);",
      '  }',
      "  return rows.join('\\n');",
      '}',
    ),
  },
  3: {
    partial: lines(
      'function sum(numbers) {',
      '  let total;',
      '  for (const number of numbers) {',
      '    total += number;',
      '  }',
      '  return total;',
      '}',
    ),
    solved: lines(
      'function sum(numbers) {',
      '  let total = 0;',
      '  for (const number of numbers) {',
      '    total += number;',
      '  }',
      '  return total;',
      '}',
    ),
  },
  4: {
    partial: lines(
      'function maximum(numbers) {',
      '  let largest = 0;',
      '  for (const number of numbers) {',
      '    if (number > largest) largest = number;',
      '  }',
      '  return largest;',
      '}',
    ),
    solved: lines(
      'function maximum(numbers) {',
      '  if (numbers.length === 0) return null;',
      '  let largest = numbers[0];',
      '  for (const number of numbers) {',
      '    if (number > largest) largest = number;',
      '  }',
      '  return largest;',
      '}',
    ),
  },
  5: {
    partial: lines(
      'function reverseArray(items) {',
      '  const copy = [...items];',
      '  for (let i = 0; i < copy.length; i++) {',
      '    const j = copy.length - 1 - i;',
      '    [copy[i], copy[j]] = [copy[j], copy[i]];',
      '  }',
      '  return copy;',
      '}',
    ),
    solved: lines(
      'function reverseArray(items) {',
      '  const result = [];',
      '  for (let i = items.length - 1; i >= 0; i--) {',
      '    result.push(items[i]);',
      '  }',
      '  return result;',
      '}',
    ),
  },
  6: {
    partial: lines(
      'function countVowels(text) {',
      '  let vowels = 0;',
      '  for (const letter of text) {',
      "    if ('aeiou'.includes(letter)) vowels++;",
      '  }',
      '  return vowels;',
      '}',
    ),
    solved: lines(
      'function countVowels(text) {',
      '  let vowels = 0;',
      '  for (const letter of text.toLowerCase()) {',
      "    if ('aeiouáéíóú'.includes(letter)) vowels++;",
      '  }',
      '  return vowels;',
      '}',
    ),
  },
  7: {
    partial: lines(
      'function average(numbers) {',
      '  let total = 0;',
      '  for (const number of numbers) total += number;',
      '  return total / numbers.length;',
      '}',
    ),
    solved: lines(
      'function average(numbers) {',
      "  if (numbers.length === 0) return '0.00';",
      '  let total = 0;',
      '  for (const number of numbers) total += number;',
      '  return (total / numbers.length).toFixed(2);',
      '}',
    ),
  },
  8: {
    partial: lines(
      'function firstIndexOf(items, value) {',
      '  let position = -1;',
      '  for (let i = 0; i < items.length; i++) {',
      '    if (items[i] === value) position = i;',
      '  }',
      '  return position;',
      '}',
    ),
    solved: lines(
      'function firstIndexOf(items, value) {',
      '  for (let i = 0; i < items.length; i++) {',
      '    if (items[i] === value) return i;',
      '  }',
      '  return -1;',
      '}',
    ),
  },
  9: {
    partial: lines(
      'function isValidEmail(text) {',
      "  return text.includes('@') && text.includes('.');",
      '}',
    ),
    solved: lines(
      'function isValidEmail(text) {',
      "  if (text.includes(' ')) return false;",
      "  const parts = text.split('@');",
      '  if (parts.length !== 2) return false;',
      '  const [user, domain] = parts;',
      "  const dot = domain.indexOf('.');",
      "  return user.length > 0 && dot > 0 && !domain.endsWith('.');",
      '}',
    ),
  },
  10: {
    partial: lines(
      'function toQueryString(params) {',
      "  let query = '';",
      '  for (const key in params) {',
      "    query += key + '=' + params[key] + '&';",
      '  }',
      '  return query;',
      '}',
    ),
    solved: lines(
      'function toQueryString(params) {',
      '  return Object.entries(params)',
      "    .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value))",
      "    .join('&');",
      '}',
    ),
  },
};

export const SAMPLE_CODE: Readonly<Record<number, SampleCode>> = {
  ...BASE_SAMPLE_CODE,
  ...MORE_SAMPLE_CODE,
};

/** Start of each block, per group: a week each, as the class sessions they were. */
const BLOCK_STARTS: Record<string, Record<number, string>> = {
  [DAW_GROUP_ID]: {
    1: '2026-10-06T08:00:00.000Z',
    2: '2026-10-13T08:00:00.000Z',
    3: '2026-10-20T08:00:00.000Z',
    4: '2026-10-27T09:00:00.000Z',
  },
  [DAM_GROUP_ID]: {
    1: '2026-10-08T10:00:00.000Z',
    2: '2026-10-15T10:00:00.000Z',
  },
};

/** The resit of topic 2 and the first topic of the web client subject, both in 1.º DAW A. */
const RESIT_START = '2026-11-03T08:00:00.000Z';
const WEB_START = '2026-10-29T11:00:00.000Z';
/** Lucía practises again the first exercise she submitted, some days later. */
const PRACTICE_START = '2026-11-02T17:00:00.000Z';
/** The first topic of advanced programming in 1.º DAM B. */
const ADVANCED_START = '2026-11-05T10:00:00.000Z';

/** The four students with the richest history in 1.º DAW A, one script per exercise (1 to 8). */
const FEATURED_SCRIPTS: readonly (readonly Script[])[] = [
  // Lucía: works on her own, rarely asks.
  [
    [run(), submit],
    [run(4), run(), submit],
    [run(), submit],
    [run(1), run(), submit],
    [run(2), ask(QUESTIONS[2]), run(), submit],
    [run(), submit],
    [run(3), run(), submit],
    [run(1), run()],
  ],
  // Hugo: struggles, climbs the hint levels and tries to get the solution once.
  [
    [run(0, 2), hint, run(2), hint, run(), submit],
    [run(0, 1, 2, 3, 4), hint, hint, hint, run(3), ask(ELUSION_QUESTION, true), run(), submit],
    [run(0, 2, 3), run(0, 2, 3), hint, run(2), hint, proactive(), hint, run(), submit],
    [run(1, 3), run(1, 3), run(1, 3), proactive(), hint, run(1, 3)],
    [run(0, 1, 3, 4), hint, hint],
    [],
    null,
    null,
  ],
  // Aya: needs many hints at first and fewer each block.
  [
    [run(0), hint, run(0), hint, hint, run(), submit],
    [run(0, 1, 2), hint, run(2), hint, run(), submit],
    [run(3), hint, run(), submit],
    [run(3), ask(QUESTIONS[1]), run(), submit],
    [run(4), run(), submit],
    [run(), submit],
    [run(), submit],
    [run(2), run(), submit],
  ],
  // Daniel: leaves the tab and pastes code often.
  [
    [away(5), paste(240), run(), submit],
    [run(0, 1, 2, 3, 4), away(6), paste(310), run(), submit],
    [run(1), away(3), run()],
    [paste(150), run(4), proactive(true), run(4)],
    null,
    [],
    null,
    null,
  ],
];

/** Scripts of the rest of the students, by block: fewer hints as the course moves on. */
const SCRIPTS_BY_BLOCK: Record<number, readonly Script[]> = {
  1: [
    [run(0, 2), hint, run(2), hint, run(), submit],
    [run(4), run(), submit],
    [run(1), ask(QUESTIONS[0]), run(), submit],
    [run(0), hint, run(), submit],
    [run(), submit],
    [run(2), run(2), hint, run(2), hint, proactive(), hint, run(), submit],
    [run(4), run(), submit],
    [run(0, 2), hint, run(2), hint, run(), submit],
  ],
  2: [
    [run(4), run(), submit],
    [run(2), hint, run(2), hint, run(), submit],
    [run(), submit],
    [run(1), ask(QUESTIONS[1]), run(), submit],
    [run(3), run(), submit],
    [away(4), paste(180), run(), submit],
    [run(0, 3), hint, run(3), hint, run(), submit],
    [run(), submit],
  ],
  3: [
    [run(), submit],
    [run(4), run(), submit],
    [run(1), ask(QUESTIONS[2]), run(), submit],
    [run(0, 1), hint, run(1), hint, run(), submit],
    [run(2), run(), submit],
    [run(), submit],
    [run(0, 1)],
    [run(), submit],
  ],
  4: [
    [run(), submit],
    [run(4), run(), submit],
    [],
    [run(), submit],
    null,
    [run(0, 1)],
    [run(3), run(), submit],
    [run(), submit],
  ],
};

const attempts: Attempt[] = [];
const events: ProcessEvent[] = [];
const interactions: TutorInteraction[] = [];

for (const [index, userId] of DAW_STUDENT_IDS.entries()) {
  DAW_BLOCKS.forEach((block, exerciseIndex) => {
    // A featured script may be null (never opened), so `??` would not do here.
    const script =
      index < FEATURED_SCRIPTS.length
        ? FEATURED_SCRIPTS[index][exerciseIndex]
        : pickScript(block, index, exerciseIndex);
    addAttempt({
      ...classAttempt(DAW_GROUP_ID, DAW_BLOCKS, exerciseIndex + 1, index),
      userId,
      script,
    });
  });
}

for (const [index, userId] of DAM_STUDENT_IDS.entries()) {
  DAM_BLOCKS.forEach((block, exerciseIndex) => {
    addAttempt({
      ...classAttempt(DAM_GROUP_ID, DAM_BLOCKS, exerciseIndex + 1, index),
      userId,
      script: pickScript(block, index + 3, exerciseIndex),
    });
  });
}

// The attempts of 2.5c go after those of 2.1, so these keep their ids (the pgTAP tests use them).
const [LUCIA_ID, HUGO_ID, AYA_ID] = DAW_STUDENT_IDS;

// Practice: Lucía repeats the first exercise once she submitted it, and Aya starts the third again.
addAttempt({
  userId: LUCIA_ID,
  exerciseNumber: 1,
  assignmentId: assignmentId(DAW_GROUP_ID, 1),
  number: 2,
  start: Date.parse(PRACTICE_START),
  script: [run(), submit],
});
addAttempt({
  userId: AYA_ID,
  exerciseNumber: 3,
  assignmentId: assignmentId(DAW_GROUP_ID, 3),
  number: 2,
  start: Date.parse(PRACTICE_START) + minutes(90),
  script: [run(2)],
});

// The resit of topic 2: Hugo, who never got exercise 4 right, tries it again from scratch.
addAttempt({
  userId: HUGO_ID,
  exerciseNumber: 4,
  assignmentId: blockAssignmentId(DAW_RESIT_BLOCK, 4),
  start: Date.parse(RESIT_START),
  script: [run(1, 3), hint, run(3)],
});

// The web client subject has just started: most of the class has not opened it yet.
addAttempt({
  userId: LUCIA_ID,
  exerciseNumber: 9,
  assignmentId: blockAssignmentId(DAW_WEB_FIRST_BLOCK, 9),
  start: Date.parse(WEB_START),
  script: [run(2, 4, 5), run(), submit],
});
addAttempt({
  userId: AYA_ID,
  exerciseNumber: 9,
  assignmentId: blockAssignmentId(DAW_WEB_FIRST_BLOCK, 9),
  start: Date.parse(WEB_START) + minutes(4),
  script: [run(2, 4, 5), hint],
});

// Advanced programming in 1.º DAM B has just started: only Elena, with a subject other than Lucía's.
addAttempt({
  userId: DAM_STUDENT_IDS[0],
  exerciseNumber: 6,
  assignmentId: blockAssignmentId(DAM_ADVANCED_FIRST_BLOCK, 6),
  start: Date.parse(ADVANCED_START),
  script: [run(4), run(), submit],
});
addAttempt({
  userId: DAM_STUDENT_IDS[0],
  exerciseNumber: 7,
  assignmentId: blockAssignmentId(DAM_ADVANCED_FIRST_BLOCK, 7),
  start: Date.parse(ADVANCED_START) + minutes(25),
  script: [run(3), hint],
});

export const ATTEMPTS: readonly Attempt[] = attempts;
export const EVENTS: readonly ProcessEvent[] = events;
export const INTERACTIONS: readonly TutorInteraction[] = interactions;

function pickScript(block: number, studentIndex: number, exerciseIndex: number): Script {
  const scripts = SCRIPTS_BY_BLOCK[block];
  return scripts[(studentIndex + exerciseIndex) % scripts.length];
}

/** Who did what, where and when: one attempt of the past. */
interface PastAttempt {
  readonly userId: string;
  readonly exerciseNumber: number;
  readonly assignmentId: string;
  /** 1 by default; the next ones are practice. */
  readonly number?: number;
  /** When the student opened it. */
  readonly start: number;
  readonly script: Script;
}

/** The first attempt at exercise `n` in its block of the class, opened in the order of the block. */
function classAttempt(
  groupId: string,
  blocks: readonly number[],
  n: number,
  studentIndex: number,
): Omit<PastAttempt, 'userId' | 'script'> {
  const block = blocks[n - 1];
  const orderInBlock = n - 1 - blocks.indexOf(block);
  return {
    exerciseNumber: n,
    assignmentId: assignmentId(groupId, n),
    start:
      Date.parse(BLOCK_STARTS[groupId][block]) +
      minutes(5 + orderInBlock * 30 + (studentIndex % 6)),
  };
}

function addAttempt({
  userId,
  exerciseNumber,
  assignmentId: attemptAssignmentId,
  number = 1,
  start,
  script,
}: PastAttempt): void {
  if (script === null) {
    return;
  }
  let clock = start;
  const startedAt = clock;
  const attemptId = fixtureId('attempt', attempts.length + 1);
  const testCount = TESTS.filter((test) => test.exerciseId === exerciseId(exerciseNumber)).length;
  let status: StoredAttemptStatus = 'in_progress';
  let level = 0;
  let lastActivity = clock;
  let finishedAt: number | null = null;

  const nextEventId = (): string => fixtureId('event', events.length + 1);
  const addInteraction = (interaction: Omit<TutorInteraction, 'id' | 'attemptId' | 'createdAt'>) =>
    interactions.push({
      id: fixtureId('interaction', interactions.length + 1),
      attemptId,
      createdAt: iso(clock),
      ...interaction,
    });
  const answerLevel = (): HintLevel => Math.max(level, 1) as HintLevel;
  const turn = (): number => interactions.length % 3;

  for (const step of script) {
    clock += minutes(3);
    const timestamp = iso(clock);
    switch (step.kind) {
      case 'run':
        events.push({
          id: nextEventId(),
          attemptId,
          type: 'run',
          timestamp,
          detail: {
            passed: testCount - step.failing.length,
            failed: step.failing.length,
            failedTestIds: step.failing.map((position) => testId(exerciseNumber, position)),
          },
        });
        status = step.failing.length === 0 ? 'passed' : 'tests_failed';
        lastActivity = clock;
        break;
      case 'hint':
        level = Math.min(level + 1, MAX_HINT_LEVEL);
        events.push({
          id: nextEventId(),
          attemptId,
          type: 'hint_requested',
          timestamp,
          detail: { level: answerLevel() },
        });
        addInteraction({
          trigger: 'hint',
          hintLevel: answerLevel(),
          studentMessage: null,
          transcript: PAST_SCRIPT.hints[answerLevel()][turn()],
          emotion: 'encouragement',
          intensity: 1,
          elusion: false,
          promptVersion: 'v0',
        });
        lastActivity = clock;
        break;
      case 'question':
        addInteraction({
          trigger: 'question',
          hintLevel: answerLevel(),
          studentMessage: step.message,
          transcript: step.elusion ? PAST_SCRIPT.elusion : PAST_SCRIPT.hints[answerLevel()][turn()],
          emotion: step.elusion ? 'surprise' : 'joy',
          intensity: step.elusion ? 2 : 1,
          elusion: step.elusion,
          promptVersion: 'v0',
        });
        break;
      case 'proactive':
        events.push({
          id: nextEventId(),
          attemptId,
          type: 'proactive_intervention',
          timestamp,
          detail: { silent: step.silent },
        });
        if (!step.silent) {
          addInteraction({
            trigger: 'proactive',
            hintLevel: answerLevel(),
            studentMessage: null,
            transcript: PAST_SCRIPT.proactive,
            emotion: 'encouragement',
            intensity: 2,
            elusion: false,
            promptVersion: 'v0',
          });
        }
        break;
      case 'paste':
        events.push({
          id: nextEventId(),
          attemptId,
          type: 'paste',
          timestamp,
          detail: { length: step.length },
        });
        lastActivity = clock;
        break;
      case 'away':
        events.push({ id: nextEventId(), attemptId, type: 'focus_lost', timestamp, detail: null });
        clock += minutes(step.minutes);
        events.push({
          id: nextEventId(),
          attemptId,
          type: 'focus_gained',
          timestamp: iso(clock),
          detail: { awayMs: minutes(step.minutes) },
        });
        lastActivity = clock;
        break;
      case 'submit':
        // Scripts only submit after a passing run: fixtures.spec.ts checks it.
        events.push({ id: nextEventId(), attemptId, type: 'submit', timestamp, detail: null });
        status = 'submitted';
        finishedAt = clock;
        lastActivity = clock;
        break;
    }
  }

  const code = SAMPLE_CODE[exerciseNumber];
  const solved = status === 'passed' || status === 'submitted';
  attempts.push({
    id: attemptId,
    exerciseId: exerciseId(exerciseNumber),
    userId,
    assignmentId: attemptAssignmentId,
    number,
    currentCode: solved ? code.solved : code.partial,
    finalCode: status === 'submitted' ? code.solved : null,
    status,
    startedAt: iso(startedAt),
    finishedAt: finishedAt === null ? null : iso(finishedAt),
    updatedAt: iso(lastActivity),
  });
}

function lines(...code: string[]): string {
  return code.join('\n') + '\n';
}

function minutes(count: number): number {
  return count * 60_000;
}

function iso(time: number): string {
  return new Date(time).toISOString();
}
