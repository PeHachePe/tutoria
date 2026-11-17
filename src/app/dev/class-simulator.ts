import { computed, DestroyRef, inject, Service, signal } from '@angular/core';
import type { ParamMap } from '@angular/router';

import type { Attempt } from '../data/attempt';
import { canManageGroup } from '../data/mock/mock-access';
import { MockDb } from '../data/mock/mock-db';
import { mockLiveGroups } from '../data/mock/mock-live-service';
import type { ProcessEvent } from '../data/process-event';
import { MAX_HINT_LEVEL, type HintLevel, type TutorInteraction } from '../data/tutor';
import { CHAT_STUCK_MESSAGES } from '../teacher/live/live-attention';
import { pickSelection } from '../teacher/live/live-store';

/** Time between two actions of the simulated class. */
export const SIMULATION_TICK_MS = 2000;

/** Runs in a row that fail the same test to get a student stuck, over any threshold of the seed. */
const STUCK_RUNS = 4;

/** Length of the paste of «Provocar un patrón»: well over `LARGE_PASTE_CHARS`. */
const PATTERN_PASTE_CHARS = 420;

/** How long the student of «Provocar un patrón» stays out of the window. */
const PATTERN_AWAY_MS = 90_000;

/**
 * What a student does in a tick, as cumulative odds: a passed attempt is submitted half the time;
 * otherwise, runs the tests, asks for a hint, asks the tutor a question, tells the tutor they cannot
 * go on, pastes, or leaves or comes back to the window (the rest).
 */
const ODDS = {
  submitPassed: 0.5,
  run: 0.55,
  hint: 0.65,
  question: 0.7,
  stuckQuestion: 0.73,
  paste: 0.8,
} as const;

/** What the simulated tutor says for each hint level, as the server would record it. */
const SIMULATED_HINTS: Record<HintLevel, string> = {
  1: '¿Qué tiene que devolver la función si la lista está vacía?',
  2: 'Recorre la lista con un bucle y ve guardando el resultado en una variable.',
  3: 'Antes del bucle, la variable empieza en `0`; dentro, súmale cada elemento.',
};

/** A question of the simulated student and the answer of the tutor. */
const SIMULATED_QUESTION = {
  message: '¿Por qué me sale undefined?',
  answer: 'Mira si tu función tiene un `return` en todos los caminos.',
} as const;

/** What a simulated student says when they cannot go on (D-068), and the answer of the tutor. */
const SIMULATED_STUCK_MESSAGE = 'No sé cómo seguir';
const SIMULATED_STUCK_ANSWER = 'Vamos por partes: ¿qué tiene que devolver la función?';

/** Lines the simulated student writes, one more on every run, so the code changes as in class. */
const SIMULATED_CODE = [
  'function solve(items) {',
  '  let result = 0;',
  '  for (const item of items) {',
  '    result += item;',
  '  }',
  '  return result;',
  '}',
] as const;

/** Chance that each test fails in a simulated run. */
const TEST_FAILURE_ODDS = 0.35;

/** Length of a small paste: from `min` to `min + spread` characters. */
const SMALL_PASTE = { min: 10, spread: 50 } as const;

/**
 * How the simulated class spreads over the blocks (D-068): all in one block, half the group in each
 * of two, or each student in a different one, as far as there are blocks.
 */
export const SIMULATION_SPREADS = ['one_block', 'two_blocks', 'scattered'] as const;
export type SimulationSpread = (typeof SIMULATION_SPREADS)[number];

/** The group and the blocks the simulator works on. */
export interface SimulationTarget {
  readonly groupId: string;
  /** The blocks the class is spread over, in order. */
  readonly blockIds: readonly string[];
  /** «1.º DAW A · Tema 1: Bucles», or «1.º DAW A · 3 bloques», for the toolbar. */
  readonly label: string;
}

type EventDraft = Omit<ProcessEvent, 'id' | 'attemptId' | 'timestamp'>;

/**
 * Students of a group who work by themselves, for the live panel with mock data (4.1, D-068): every
 * tick a student at random opens an exercise of their block, runs the tests, asks for a hint, asks
 * the tutor, pastes, leaves or comes back to the window, or submits. It writes in MockDb as the
 * server would, so the panel receives the changes as with Realtime. «Atascar», «Atascar en el
 * chat» and «Provocar un patrón» show the reasons in a moment. Development only.
 */
@Service()
export class ClassSimulator {
  private readonly db = inject(MockDb);
  private readonly targetState = signal<SimulationTarget | null>(null);
  private timer: ReturnType<typeof setInterval> | undefined;

  /** The blocks being simulated, or null while stopped. */
  readonly target = this.targetState.asReadonly();
  readonly running = computed(() => this.targetState() !== null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /**
   * The group of the live panel for the signed-in teacher (the one of the URL or the first one) and
   * the blocks of `spread` among those the students see (neither hidden nor still closed) with
   * exercises: the block of the URL, or the latest one, or the first; with two blocks, also the
   * next one; scattered, all of them. Null without a group or such blocks.
   */
  targetFor(query: ParamMap, spread: SimulationSpread = 'one_block'): SimulationTarget | null {
    const user = this.db.currentUser();
    if (!user) return null;
    const tables = this.db.tables();
    const groups = mockLiveGroups(tables, (group) => canManageGroup(user, group));
    const request = pickSelection(groups, query);
    if (!request) return null;
    const { group } = request;
    const now = Date.now();
    const candidates = group.blocks.filter(
      (block) =>
        !block.isHidden &&
        (block.opensAt === null || Date.parse(block.opensAt) <= now) &&
        tables.assignments.some((assignment) => assignment.blockId === block.id),
    );
    if (candidates.length === 0) return null;
    // The block of the URL, or the latest one, or the first
    const index =
      [request.blockId, group.latestBlockId]
        .map((id) => candidates.findIndex((block) => block.id === id))
        .find((found) => found >= 0) ?? 0;
    const blocks =
      spread === 'scattered'
        ? candidates
        : spread === 'two_blocks'
          ? [...new Set([candidates[index], candidates[(index + 1) % candidates.length]])]
          : [candidates[index]];
    return {
      groupId: group.id,
      blockIds: blocks.map((block) => block.id),
      label:
        blocks.length === 1
          ? `${group.name} · ${blocks[0].title}`
          : `${group.name} · ${blocks.length} bloques`,
    };
  }

  start(target: SimulationTarget): void {
    this.stop();
    this.targetState.set(target);
    this.step();
    this.timer = setInterval(() => this.step(), SIMULATION_TICK_MS);
  }

  stop(): void {
    clearInterval(this.timer);
    this.targetState.set(null);
  }

  /** One action of one student at random. */
  step(target = this.targetState()): void {
    if (!target) return;
    const student = this.pick(this.students(target));
    if (!student) return;
    const opened = this.openAttempt(target, student);
    // Opening an exercise is the action of this tick
    if (!opened || opened.isNew) return;
    const attempt = opened.attempt;
    const roll = Math.random();
    if (attempt.status === 'passed' && roll < ODDS.submitPassed) {
      this.submit(attempt);
    } else if (roll < ODDS.run) {
      this.run(
        attempt,
        this.testIds(attempt).filter(() => Math.random() < TEST_FAILURE_ODDS),
      );
    } else if (roll < ODDS.hint) {
      const level = this.nextHintLevel(attempt);
      this.record(attempt, { type: 'hint_requested', detail: { level } });
      this.answer(attempt, 'hint', level, null, SIMULATED_HINTS[level]);
    } else if (roll < ODDS.question) {
      const level = this.reachedHintLevel(attempt);
      this.answer(
        attempt,
        'question',
        level,
        SIMULATED_QUESTION.message,
        SIMULATED_QUESTION.answer,
      );
    } else if (roll < ODDS.stuckQuestion) {
      this.sayStuck(attempt);
    } else if (roll < ODDS.paste) {
      const length = SMALL_PASTE.min + Math.floor(Math.random() * SMALL_PASTE.spread);
      this.record(attempt, { type: 'paste', detail: { length } });
    } else {
      this.toggleFocus(attempt);
    }
  }

  /** A student at random fails the same test again and again: they go to «A quién atender». */
  stuckOne(target: SimulationTarget): void {
    const student = this.pick(this.students(target));
    const attempt = student && this.openAttempt(target, student)?.attempt;
    if (!attempt) return;
    const testId = this.testIds(attempt)[0];
    for (let run = 0; run < STUCK_RUNS; run++) {
      this.run(attempt, [testId]);
    }
  }

  /**
   * A student at random tells the tutor `CHAT_STUCK_MESSAGES` times that they cannot go on: they go
   * to «A quién atender» (D-068).
   */
  chatStuckOne(target: SimulationTarget): void {
    const student = this.pick(this.students(target));
    const attempt = student && this.openAttempt(target, student)?.attempt;
    if (!attempt) return;
    for (let message = 0; message < CHAT_STUCK_MESSAGES; message++) {
      this.sayStuck(attempt);
    }
  }

  /**
   * A student at random leaves the window, comes back, pastes a lot and submits: observations of
   * the table.
   */
  patternOne(target: SimulationTarget): void {
    const student = this.pick(this.students(target));
    const attempt = student && this.openAttempt(target, student)?.attempt;
    if (!attempt) return;
    this.record(attempt, { type: 'focus_lost', detail: null });
    this.record(attempt, { type: 'focus_gained', detail: { awayMs: PATTERN_AWAY_MS } });
    this.record(attempt, { type: 'paste', detail: { length: PATTERN_PASTE_CHARS } });
    this.run(attempt, []);
    this.submit(this.attempt(attempt.id));
  }

  private sayStuck(attempt: Attempt): void {
    const level = this.reachedHintLevel(attempt);
    this.answer(attempt, 'question', level, SIMULATED_STUCK_MESSAGE, SIMULATED_STUCK_ANSWER);
  }

  /**
   * The block of a student: the blocks of the target split the enrollment of the group in equal
   * parts, in its order.
   */
  private blockOf(target: SimulationTarget, userId: string): string {
    const students = this.students(target);
    const index = students.indexOf(userId);
    return target.blockIds[Math.floor((index * target.blockIds.length) / students.length)];
  }

  private students(target: SimulationTarget): string[] {
    return this.db
      .tables()
      .enrollments.filter((enrollment) => enrollment.groupId === target.groupId)
      .map((enrollment) => enrollment.userId);
  }

  /**
   * The attempt of their block the student is on, or a new one at the first exercise they have not
   * submitted, or practice at one they have (2.5c).
   */
  private openAttempt(
    target: SimulationTarget,
    userId: string,
  ): { readonly attempt: Attempt; readonly isNew: boolean } | null {
    const { attempts, assignments } = this.db.tables();
    const blockId = this.blockOf(target, userId);
    const block = assignments
      .filter((assignment) => assignment.blockId === blockId)
      .sort((a, b) => a.id.localeCompare(b.id));
    const own = attempts.filter(
      (attempt) => attempt.userId === userId && block.some((a) => a.id === attempt.assignmentId),
    );
    const open = own.find((attempt) => attempt.status !== 'submitted');
    if (open) return { attempt: open, isNew: false };
    const pending = block.find((a) => !own.some((attempt) => attempt.assignmentId === a.id));
    const assignment = pending ?? this.pick(block);
    if (!assignment) return null;
    const number = 1 + own.filter((attempt) => attempt.assignmentId === assignment.id).length;
    const now = new Date().toISOString();
    const attempt: Attempt = {
      id: crypto.randomUUID(),
      exerciseId: assignment.exerciseId,
      userId,
      assignmentId: assignment.id,
      number,
      currentCode: '',
      finalCode: null,
      status: 'in_progress',
      startedAt: now,
      finishedAt: null,
      updatedAt: now,
    };
    this.db.update('attempts', (rows) => [...rows, attempt]);
    return { attempt, isNew: true };
  }

  private run(attempt: Attempt, failedTestIds: readonly string[]): void {
    this.write(attempt);
    const total = this.testIds(attempt).length;
    this.record(
      attempt,
      {
        type: 'run',
        detail: {
          passed: total - failedTestIds.length,
          failed: failedTestIds.length,
          failedTestIds,
        },
      },
      failedTestIds.length === 0 ? 'passed' : 'tests_failed',
    );
  }

  private submit(attempt: Attempt): void {
    this.record(attempt, { type: 'submit', detail: null }, 'submitted');
  }

  private toggleFocus(attempt: Attempt): void {
    const last = this.db
      .tables()
      .events.filter(
        (event) =>
          event.attemptId === attempt.id &&
          (event.type === 'focus_lost' || event.type === 'focus_gained'),
      )
      .at(-1);
    this.record(
      attempt,
      last?.type === 'focus_lost'
        ? { type: 'focus_gained', detail: { awayMs: Date.now() - Date.parse(last.timestamp) } }
        : { type: 'focus_lost', detail: null },
    );
  }

  private nextHintLevel(attempt: Attempt): HintLevel {
    return Math.min(this.hintCount(attempt) + 1, MAX_HINT_LEVEL) as HintLevel;
  }

  /** The level a question is answered at: the last hint reached, or the first. */
  private reachedHintLevel(attempt: Attempt): HintLevel {
    return Math.max(1, Math.min(this.hintCount(attempt), MAX_HINT_LEVEL)) as HintLevel;
  }

  private hintCount(attempt: Attempt): number {
    return this.db
      .tables()
      .events.filter((event) => event.attemptId === attempt.id && event.type === 'hint_requested')
      .length;
  }

  /** The answer of the tutor, recorded as the Edge Function `tutor` does (2.6). */
  private answer(
    attempt: Attempt,
    trigger: TutorInteraction['trigger'],
    hintLevel: HintLevel,
    studentMessage: string | null,
    transcript: string,
  ): void {
    const interaction: TutorInteraction = {
      id: crypto.randomUUID(),
      attemptId: attempt.id,
      trigger,
      hintLevel,
      studentMessage,
      transcript,
      emotion: 'encouragement',
      intensity: 1,
      elusion: false,
      promptVersion: 'simulated',
      createdAt: new Date().toISOString(),
    };
    this.db.update('interactions', (rows) => [...rows, interaction]);
  }

  /** One more line of code before running, so the teacher sees the code change. */
  private write(attempt: Attempt): void {
    const current = this.attempt(attempt.id).currentCode;
    const lines = current === '' ? 0 : current.split('\n').length;
    if (lines >= SIMULATED_CODE.length) return;
    const currentCode = SIMULATED_CODE.slice(0, lines + 1).join('\n');
    this.db.update('attempts', (rows) =>
      rows.map((row) => (row.id === attempt.id ? { ...row, currentCode } : row)),
    );
  }

  /** Adds the event and, as the server would, changes the attempt. */
  private record(attempt: Attempt, draft: EventDraft, status = attempt.status): void {
    const timestamp = new Date().toISOString();
    const event = {
      ...draft,
      id: crypto.randomUUID(),
      attemptId: attempt.id,
      timestamp,
    } as ProcessEvent;
    this.db.update('events', (rows) => [...rows, event]);
    if (draft.type === 'focus_lost' || draft.type === 'focus_gained') return;
    this.db.update('attempts', (rows) =>
      rows.map((row) =>
        row.id === attempt.id
          ? {
              ...row,
              status,
              updatedAt: timestamp,
              finishedAt: status === 'submitted' ? timestamp : row.finishedAt,
            }
          : row,
      ),
    );
  }

  private attempt(id: string): Attempt {
    return this.db.tables().attempts.find((attempt) => attempt.id === id) as Attempt;
  }

  private testIds(attempt: Attempt): string[] {
    return this.db
      .tables()
      .tests.filter((test) => test.exerciseId === attempt.exerciseId)
      .map((test) => test.id);
  }

  private pick<T>(items: readonly T[]): T | undefined {
    return items[Math.floor(Math.random() * items.length)];
  }
}
