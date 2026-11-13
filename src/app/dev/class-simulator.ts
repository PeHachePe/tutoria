import { computed, DestroyRef, inject, Service, signal } from '@angular/core';
import type { ParamMap } from '@angular/router';

import type { Attempt } from '../data/attempt';
import type { ClassBlock } from '../data/exercise';
import { canManageGroup } from '../data/mock/mock-access';
import { MockDb } from '../data/mock/mock-db';
import { mockLiveGroups } from '../data/mock/mock-live-service';
import type { ProcessEvent } from '../data/process-event';
import { MAX_HINT_LEVEL, type HintLevel } from '../data/tutor';
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
 * otherwise, runs the tests, asks for a hint, pastes, or leaves or comes back to the window (the
 * rest).
 */
const ODDS = { submitPassed: 0.5, run: 0.55, hint: 0.7, paste: 0.8 } as const;

/** Chance that each test fails in a simulated run. */
const TEST_FAILURE_ODDS = 0.35;

/** Length of a small paste: from `min` to `min + spread` characters. */
const SMALL_PASTE = { min: 10, spread: 50 } as const;

/** The group and the block the simulator works on. */
export interface SimulationTarget {
  readonly groupId: string;
  readonly blockId: string;
  /** «1.º DAW A · Tema 1: Bucles», for the toolbar. */
  readonly label: string;
}

type EventDraft = Omit<ProcessEvent, 'id' | 'attemptId' | 'timestamp'>;

/**
 * Students of a block who work by themselves, for the live panel with mock data (4.1): every tick a
 * student at random opens an exercise, runs the tests, asks for a hint, pastes, leaves or comes back
 * to the window, or submits. It writes in MockDb as the server would, so the panel receives the
 * changes as with Realtime. «Atascar» and «Provocar un patrón» show the signals in a moment.
 * Development only.
 */
@Service()
export class ClassSimulator {
  private readonly db = inject(MockDb);
  private readonly targetState = signal<SimulationTarget | null>(null);
  private timer: ReturnType<typeof setInterval> | undefined;

  /** The block being simulated, or null while stopped. */
  readonly target = this.targetState.asReadonly();
  readonly running = computed(() => this.targetState() !== null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /**
   * The block to simulate for the signed-in teacher: the one of the URL of the live panel or,
   * without it, the first group and its latest block, as the panel picks them.
   */
  targetFor(query: ParamMap): SimulationTarget | null {
    const user = this.db.currentUser();
    if (!user) return null;
    const groups = mockLiveGroups(this.db.tables(), (group) => canManageGroup(user, group));
    const selection = pickSelection(groups, query);
    if (!selection) return null;
    const { group, blockId } = selection;
    // pickSelection picks one of the blocks of the group
    const block = group.blocks.find((candidate) => candidate.id === blockId) as ClassBlock;
    return { groupId: group.id, blockId, label: `${group.name} · ${block.title}` };
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
      this.record(attempt, {
        type: 'hint_requested',
        detail: { level: this.nextHintLevel(attempt) },
      });
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

  private students(target: SimulationTarget): string[] {
    return this.db
      .tables()
      .enrollments.filter((enrollment) => enrollment.groupId === target.groupId)
      .map((enrollment) => enrollment.userId);
  }

  /**
   * The attempt of the block the student is on, or a new one at the first exercise they have not
   * submitted, or practice at one they have (2.5c).
   */
  private openAttempt(
    target: SimulationTarget,
    userId: string,
  ): { readonly attempt: Attempt; readonly isNew: boolean } | null {
    const { attempts, assignments } = this.db.tables();
    const block = assignments
      .filter((assignment) => assignment.blockId === target.blockId)
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
    const hints = this.db
      .tables()
      .events.filter((event) => event.attemptId === attempt.id && event.type === 'hint_requested');
    return Math.min(hints.length + 1, MAX_HINT_LEVEL) as HintLevel;
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
