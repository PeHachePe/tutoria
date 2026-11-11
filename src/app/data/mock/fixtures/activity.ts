import type { Attempt, StoredAttemptStatus } from '../../attempt';
import type { ProcessEvent } from '../../process-event';
import { type HintLevel, MAX_HINT_LEVEL, type TutorInteraction } from '../../tutor';
import { assignmentId, DAM_SESSIONS, DAW_SESSIONS, exerciseId, testId, TESTS } from './exercises';
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

/** Code of each exercise (1 to 8): a version with a typical mistake and a correct one. */
export const SAMPLE_CODE: Record<number, { readonly partial: string; readonly solved: string }> = {
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
};

/** Start of each class session, per group. */
const SESSION_STARTS: Record<string, Record<number, string>> = {
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
  // Aya: needs many hints at first and fewer each session.
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

/** Scripts of the rest of the students, by session: fewer hints as the course moves on. */
const SCRIPTS_BY_SESSION: Record<number, readonly Script[]> = {
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
  DAW_SESSIONS.forEach((session, exerciseIndex) => {
    // A featured script may be null (never opened), so `??` would not do here.
    const script =
      index < FEATURED_SCRIPTS.length
        ? FEATURED_SCRIPTS[index][exerciseIndex]
        : pickScript(session, index, exerciseIndex);
    addAttempt(DAW_GROUP_ID, DAW_SESSIONS, userId, index, exerciseIndex + 1, script);
  });
}

for (const [index, userId] of DAM_STUDENT_IDS.entries()) {
  DAM_SESSIONS.forEach((session, exerciseIndex) => {
    addAttempt(
      DAM_GROUP_ID,
      DAM_SESSIONS,
      userId,
      index,
      exerciseIndex + 1,
      pickScript(session, index + 3, exerciseIndex),
    );
  });
}

export const ATTEMPTS: readonly Attempt[] = attempts;
export const EVENTS: readonly ProcessEvent[] = events;
export const INTERACTIONS: readonly TutorInteraction[] = interactions;

function pickScript(session: number, studentIndex: number, exerciseIndex: number): Script {
  const scripts = SCRIPTS_BY_SESSION[session];
  return scripts[(studentIndex + exerciseIndex) % scripts.length];
}

function addAttempt(
  groupId: string,
  sessions: readonly number[],
  userId: string,
  studentIndex: number,
  exerciseNumber: number,
  script: Script,
): void {
  if (script === null) {
    return;
  }
  const session = sessions[exerciseNumber - 1];
  const orderInSession = exerciseNumber - 1 - sessions.indexOf(session);
  let clock =
    Date.parse(SESSION_STARTS[groupId][session]) +
    minutes(5 + orderInSession * 30 + (studentIndex % 6));
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
    assignmentId: assignmentId(groupId, exerciseNumber),
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
