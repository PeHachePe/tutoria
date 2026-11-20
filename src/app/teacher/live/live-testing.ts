import type { Attempt } from '../../data/attempt';
import type { ClassBlock, Exercise, Test } from '../../data/exercise';
import {
  type LiveAttemptDetail,
  type LiveExercise,
  type LiveGroup,
  LiveService,
  type LiveSnapshot,
  type LiveStudent,
  type LiveUpdate,
} from '../../data/live-service';
import { SUBJECTS } from '../../data/mock/fixtures/subjects';
import { EXERCISES } from '../../data/mock/fixtures/exercises';
import type { TutorInteraction } from '../../data/tutor';
import { liveRow, type LiveRow } from './live-row';
import { liveState } from './live-state';

/**
 * Test helpers of the live panel: a group with three students and two blocks, `b1` with two
 * exercises and `b2` with one.
 */

export const NOW = Date.parse('2026-11-13T10:00:00.000Z');
export const MINUTE = 60_000;

/** Milliseconds `minutes` before NOW. */
export const ago = (minutes: number): number => NOW - minutes * MINUTE;

export const STUDENTS: readonly LiveStudent[] = [
  { id: 'ana', name: 'Ana' },
  { id: 'bea', name: 'Bea' },
  { id: 'cai', name: 'Cai' },
];

const exercise = (index: number): Exercise => ({
  ...EXERCISES[index],
  maxRepeatedFailures: 3,
  maxIdleMinutes: 4,
});

/** Tests `t1`… of an exercise, the first one calling it with an empty array. */
const tests = (exerciseId: string, count: number): Test[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${exerciseId}-t${index + 1}`,
    exerciseId,
    input: index === 0 ? [[]] : [[index]],
    expectedOutput: index,
    isHidden: index >= count - 2,
    position: index,
  }));

/** The exercises of block `b1`. */
export const BLOCK_EXERCISES: readonly LiveExercise[] = [
  { assignmentId: 'as1', blockId: 'b1', exercise: exercise(0), tests: tests('e1', 5) },
  { assignmentId: 'as2', blockId: 'b1', exercise: exercise(1), tests: tests('e2', 6) },
];

/** The exercise of block `b2`. */
export const OTHER_BLOCK_EXERCISES: readonly LiveExercise[] = [
  { assignmentId: 'as3', blockId: 'b2', exercise: exercise(2), tests: tests('e3', 4) },
];

/** Every exercise of the group, as a snapshot gives them. */
export const GROUP_EXERCISES: readonly LiveExercise[] = [
  ...BLOCK_EXERCISES,
  ...OTHER_BLOCK_EXERCISES,
];

export function testAttempt(
  id: string,
  userId: string,
  options: Partial<Omit<Attempt, 'startedAt' | 'updatedAt' | 'finishedAt'>> & {
    readonly startedAt?: number;
    readonly updatedAt?: number;
    readonly finishedAt?: number | null;
  } = {},
): Attempt {
  const { startedAt = ago(20), updatedAt = startedAt, finishedAt = null, ...rest } = options;
  return {
    id,
    exerciseId: BLOCK_EXERCISES[0].exercise.id,
    userId,
    assignmentId: 'as1',
    number: 1,
    currentCode: '',
    finalCode: null,
    status: 'in_progress',
    ...rest,
    startedAt: new Date(startedAt).toISOString(),
    updatedAt: new Date(updatedAt).toISOString(),
    finishedAt: finishedAt === null ? null : new Date(finishedAt).toISOString(),
  };
}

export function testSnapshot(overrides: Partial<LiveSnapshot> = {}): LiveSnapshot {
  return {
    students: STUDENTS,
    exercises: BLOCK_EXERCISES,
    attempts: [],
    events: [],
    interactions: [],
    ...overrides,
  };
}

let nextInteraction = 0;

/** A tutor interaction of an attempt at `at`: a hint of level 1 unless told otherwise. */
export function testInteraction(
  attemptId: string,
  at: number,
  overrides: Partial<TutorInteraction> = {},
): TutorInteraction {
  return {
    id: `interaction-${++nextInteraction}`,
    attemptId,
    trigger: 'hint',
    hintLevel: 1,
    studentMessage: null,
    transcript: 'Mira qué devuelve la función con una lista vacía.',
    emotion: 'encouragement',
    intensity: 1,
    elusion: false,
    promptVersion: 'v5',
    createdAt: new Date(at).toISOString(),
    ...overrides,
  };
}

/** The detail of Ana's attempt `a1` at the first exercise of the block, in group g1 and block b1. */
export function testDetail(overrides: Partial<LiveAttemptDetail> = {}): LiveAttemptDetail {
  return {
    groupId: 'g1',
    blockId: 'b1',
    student: STUDENTS[0],
    exercise: BLOCK_EXERCISES[0],
    attempt: testAttempt('a1', 'ana'),
    siblings: [{ id: 'a1', number: 1 }],
    events: [],
    interactions: [],
    ...overrides,
  };
}

/** A row of a student who has not opened anything, with what a test needs changed. */
export function testRow(overrides: Partial<LiveRow> = {}): LiveRow {
  return {
    student: STUDENTS[0],
    attempt: null,
    exercise: null,
    position: null,
    repeating: false,
    status: 'not_started',
    hints: 0,
    hintLevel: null,
    tests: null,
    failedTestIds: [],
    failingTest: null,
    lastActivity: null,
    work: 'absent',
    away: null,
    reason: null,
    repeated: 0,
    breakthrough: null,
    patterns: [],
    ...overrides,
  };
}

/** The rows of a snapshot at NOW. */
export function testRows(snapshot: LiveSnapshot): LiveRow[] {
  return [...liveState(snapshot).students.values()].map((activity) =>
    liveRow(activity, snapshot.exercises, NOW),
  );
}

const block = (id: string, position: number): ClassBlock => ({
  id,
  groupId: 'g1',
  position,
  title: id,
  sourceLocale: 'es',
  translations: {},
  isHidden: false,
  opensAt: null,
});

export const GROUPS: LiveGroup[] = [
  {
    id: 'g1',
    name: '1.º DAW A',
    label: null,
    subject: SUBJECTS[0],
    blocks: [block('b1', 1), block('b2', 2)],
    latestBlockId: 'b2',
  },
  {
    id: 'g2',
    name: '1.º DAM B',
    label: null,
    subject: SUBJECTS[0],
    blocks: [],
    latestBlockId: null,
  },
];

/** A LiveService whose answers each test decides, and whose live changes it sends. */
export class FakeLiveService extends LiveService {
  groups: () => Promise<LiveGroup[]> = () => Promise.resolve(GROUPS);
  snapshots: (groupId: string, blockId: string | null) => Promise<LiveSnapshot> = () =>
    Promise.resolve(testSnapshot());
  readonly snapshotCalls: string[] = [];
  listener: ((update: LiveUpdate) => void) | null = null;
  readonly stopped: string[] = [];
  /** Something to do inside `snapshot()`, before it answers. */
  duringSnapshot: () => void = () => undefined;

  details: (attemptId: string) => Promise<LiveAttemptDetail> = () => Promise.resolve(testDetail());

  listGroups = vi.fn(() => this.groups());

  attemptDetail = vi.fn((attemptId: string) => this.details(attemptId));

  snapshot(groupId: string, blockId: string | null): Promise<LiveSnapshot> {
    this.snapshotCalls.push(`${groupId}/${blockId ?? 'todos'}`);
    this.duringSnapshot();
    return this.snapshots(groupId, blockId);
  }

  watch(groupId: string, onUpdate: (update: LiveUpdate) => void): () => void {
    this.listener = onUpdate;
    return () => this.stopped.push(groupId);
  }

  send(update: LiveUpdate): void {
    this.listener?.(update);
  }
}
