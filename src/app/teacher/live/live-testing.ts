import type { Attempt } from '../../data/attempt';
import type { ClassBlock, Exercise, Test } from '../../data/exercise';
import {
  type LiveExercise,
  type LiveGroup,
  LiveService,
  type LiveSnapshot,
  type LiveStudent,
  type LiveUpdate,
} from '../../data/live-service';
import { SUBJECTS } from '../../data/mock/fixtures/subjects';
import { EXERCISES } from '../../data/mock/fixtures/exercises';
import { liveRow, type LiveRow } from './live-row';
import { liveState } from './live-state';

/** Test helpers of the live panel: a block with two exercises and three students. */

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

export const BLOCK_EXERCISES: readonly LiveExercise[] = [
  { assignmentId: 'as1', exercise: exercise(0), tests: tests('e1', 5) },
  { assignmentId: 'as2', exercise: exercise(1), tests: tests('e2', 6) },
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
    ...overrides,
  };
}

/** The rows of a snapshot at NOW, with a class at work. */
export function testRows(snapshot: LiveSnapshot): LiveRow[] {
  return [...liveState(snapshot).students.values()].map((activity) =>
    liveRow(activity, snapshot.exercises, NOW, true),
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
});

export const GROUPS: LiveGroup[] = [
  {
    id: 'g1',
    name: '1.º DAW A',
    subject: SUBJECTS[0],
    blocks: [block('b1', 1), block('b2', 2)],
    latestBlockId: 'b2',
  },
  { id: 'g2', name: '1.º DAM B', subject: SUBJECTS[0], blocks: [], latestBlockId: null },
];

/** A LiveService whose answers each test decides, and whose live changes it sends. */
export class FakeLiveService extends LiveService {
  groups: () => Promise<LiveGroup[]> = () => Promise.resolve(GROUPS);
  snapshots: () => Promise<LiveSnapshot> = () => Promise.resolve(testSnapshot());
  readonly snapshotCalls: string[] = [];
  listener: ((update: LiveUpdate) => void) | null = null;
  readonly stopped: string[] = [];
  /** Something to do inside `snapshot()`, before it answers. */
  duringSnapshot: () => void = () => undefined;

  listGroups = vi.fn(() => this.groups());

  snapshot(groupId: string, blockId: string): Promise<LiveSnapshot> {
    this.snapshotCalls.push(`${groupId}/${blockId}`);
    this.duringSnapshot();
    return this.snapshots();
  }

  watch(groupId: string, onUpdate: (update: LiveUpdate) => void): () => void {
    this.listener = onUpdate;
    return () => this.stopped.push(groupId);
  }

  send(update: LiveUpdate): void {
    this.listener?.(update);
  }
}
