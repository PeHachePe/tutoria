import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { TEACHER_PARAMS } from '../../core/app-paths';
import { DataError } from '../../data/data-error';
import { LiveService } from '../../data/live-service';
import { testEvents as e } from '../../data/process-event-testing';
import type { LiveSnapshot } from '../../data/live-service';
import { LIVE_ACTIVITY_MINUTES } from './activity-by-minute';
import { testInteraction } from './live-testing';
import { LIVE_CLOCK_MS, LiveStore, pickSelection } from './live-store';
import {
  ago,
  BLOCK_EXERCISES,
  FakeLiveService,
  GROUP_EXERCISES,
  GROUPS,
  MINUTE,
  NOW,
  OTHER_BLOCK_EXERCISES,
  testAttempt,
  testSnapshot,
} from './live-testing';

describe('LiveStore', () => {
  let service: FakeLiveService;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    service = new FakeLiveService();
    service.snapshots = () => Promise.resolve(groupSnapshot());
    TestBed.configureTestingModule({
      providers: [provideRouter([]), LiveStore, { provide: LiveService, useValue: service }],
    });
  });

  afterEach(() => vi.useRealTimers());

  async function settle(): Promise<void> {
    await TestBed.inject(ApplicationRef).whenStable();
  }

  /** A snapshot of the whole group g1. */
  function groupSnapshot(overrides: Partial<LiveSnapshot> = {}): LiveSnapshot {
    return testSnapshot({ exercises: GROUP_EXERCISES, ...overrides });
  }

  async function open(query: Record<string, string>): Promise<void> {
    await TestBed.inject(Router).navigate([], { queryParams: query });
  }

  async function create(): Promise<LiveStore> {
    const store = TestBed.inject(LiveStore);
    await settle();
    return store;
  }

  describe('without a block in the URL', () => {
    it('reads the group, picks the block and reads it, out of class the latest one', async () => {
      const store = await create();

      expect(service.snapshotCalls).toEqual(['g1/todos', 'g1/b2']);
      expect(store.group()).toBe(GROUPS[0]);
      expect(store.blocks()).toBe(GROUPS[0].blocks);
      expect(store.selection()).toEqual({ group: GROUPS[0], blockId: 'b2' });
      expect(store.rows().map((row) => row.student.id)).toEqual(['ana', 'bea', 'cai']);
      expect(store.exercises()).toBe(GROUP_EXERCISES);
      expect(store.blockExercises()).toEqual(OTHER_BLOCK_EXERCISES);
      expect(store.isLoading()).toBe(false);
    });

    it('reads once when the class is split and it picks the whole class', async () => {
      service.snapshots = () =>
        Promise.resolve(
          groupSnapshot({
            attempts: [
              testAttempt('a1', 'ana', { updatedAt: ago(1) }),
              testAttempt('b3', 'bea', { assignmentId: 'as3', updatedAt: ago(1) }),
            ],
          }),
        );

      const store = await create();

      expect(service.snapshotCalls).toEqual(['g1/todos']);
      expect(store.selection()).toEqual({ group: GROUPS[0], blockId: null });
      expect(store.blockExercises()).toBe(GROUP_EXERCISES);
    });

    it('has no selection while it picks the block, though it knows the group', async () => {
      // The group arrives; the block it picks never does
      service.snapshots = (_, blockId) =>
        blockId === null ? Promise.resolve(groupSnapshot()) : new Promise(() => undefined);

      const store = TestBed.inject(LiveStore);
      await vi.waitFor(() => {
        TestBed.tick();
        expect(service.snapshotCalls).toEqual(['g1/todos', 'g1/b2']);
      });

      expect(store.group()).toBe(GROUPS[0]);
      expect(store.selection()).toBeUndefined();
      expect(store.blockExercises()).toEqual([]);
    });
  });

  it('reads once the block of the URL', async () => {
    await open({ [TEACHER_PARAMS.group]: 'g1', [TEACHER_PARAMS.block]: 'b1' });

    const store = await create();

    expect(service.snapshotCalls).toEqual(['g1/b1']);
    expect(store.selection()).toEqual({ group: GROUPS[0], blockId: 'b1' });
    expect(store.blockExercises()).toEqual(BLOCK_EXERCISES);
  });

  it('reads once the whole class of the URL', async () => {
    await open({ [TEACHER_PARAMS.block]: 'todos' });

    const store = await create();

    expect(service.snapshotCalls).toEqual(['g1/todos']);
    expect(store.selection()?.blockId).toBeNull();
  });

  it('applies the live changes and moves its clock with them', async () => {
    const store = await create();
    vi.setSystemTime(NOW + 5000);

    service.send({ type: 'attempt', attempt: testAttempt('a1', 'ana', { updatedAt: NOW }) });

    expect(store.rows()[0].attempt?.id).toBe('a1');
    expect(store.now()).toBe(NOW + 5000);
    expect(store.figures().working).toBe(1);
  });

  it('keeps the changes that arrive while the snapshot loads', async () => {
    service.duringSnapshot = () =>
      service.send({ type: 'attempt', attempt: testAttempt('a1', 'bea', { updatedAt: NOW }) });

    const store = await create();

    expect(store.rows()[1].attempt?.id).toBe('a1');
  });

  it('ignores the changes of a previous selection and stops watching it', async () => {
    const store = await create();
    const previous = service.listener;

    await open({ [TEACHER_PARAMS.block]: 'b1' });
    await settle();
    previous?.({ type: 'attempt', attempt: testAttempt('a1', 'ana', { updatedAt: NOW }) });

    expect(service.stopped).toEqual(['g1']);
    expect(store.rows()[0].attempt).toBeNull();
  });

  it('applies a live change of another block of the group to its row', async () => {
    await open({ [TEACHER_PARAMS.block]: 'b1' });
    const store = await create();

    service.send({
      type: 'attempt',
      attempt: testAttempt('a3', 'ana', { assignmentId: 'as3', updatedAt: NOW }),
    });

    expect(store.rows()[0]).toMatchObject({ exercise: OTHER_BLOCK_EXERCISES[0], position: 1 });
  });

  it('leaves the state as it was with a change of another group', async () => {
    const store = await create();
    const rows = store.rows();

    service.send({
      type: 'attempt',
      attempt: testAttempt('x1', 'ana', { assignmentId: 'elsewhere', updatedAt: NOW }),
    });

    expect(store.rows()).toBe(rows);
  });

  it('moves the clock every 15 s and stops it and the watch when destroyed', async () => {
    const store = await create();

    vi.advanceTimersByTime(LIVE_CLOCK_MS);
    expect(store.now()).toBe(NOW + LIVE_CLOCK_MS);

    TestBed.resetTestingModule();
    vi.advanceTimersByTime(LIVE_CLOCK_MS);
    expect(service.stopped).toEqual(['g1']);
  });

  describe('the queue', () => {
    const failing = (id: string, userId: string, assignmentId = 'as1') =>
      testAttempt(id, userId, { assignmentId, status: 'tests_failed', updatedAt: ago(1) });
    const stuck = (attemptId: string, at: number) =>
      testInteraction(attemptId, at, { trigger: 'question', studentMessage: 'no sé seguir' });

    it('puts every student of the group by reason, whatever their block', async () => {
      service.snapshots = () =>
        Promise.resolve(
          groupSnapshot({
            attempts: [failing('a1', 'ana'), failing('b3', 'bea', 'as3'), failing('c1', 'cai')],
            events: [
              ...[4, 3, 2].map((m) => e.run('a1', ago(m), ['e1-t1'])),
              e.hint('b3', ago(9), 3),
              e.run('b3', ago(8), ['e3-t1']),
            ],
            interactions: [stuck('c1', ago(20)), stuck('c1', ago(19))],
          }),
        );

      const store = await create();

      expect(store.queue().map((row) => [row.student.id, row.reason.kind])).toEqual([
        ['bea', 'hints_exhausted'],
        ['ana', 'stuck_failures'],
        ['cai', 'chat_stuck'],
      ]);
      expect(store.figures()).toMatchObject({ needHelp: 3, working: 3 });
    });

    it('serves first whoever has waited longest within a reason', async () => {
      service.snapshots = () =>
        Promise.resolve(
          groupSnapshot({
            attempts: [failing('a1', 'ana'), failing('b1', 'bea')],
            interactions: [
              stuck('a1', ago(4)),
              stuck('a1', ago(3)),
              stuck('b1', ago(8)),
              stuck('b1', ago(7)),
            ],
          }),
        );

      const store = await create();

      expect(store.queue().map((row) => row.student.id)).toEqual(['bea', 'ana']);
    });

    it('takes an attended student out of the queue until a newer reason', async () => {
      service.snapshots = () =>
        Promise.resolve(
          groupSnapshot({
            attempts: [failing('a1', 'ana')],
            interactions: [stuck('a1', ago(4)), stuck('a1', ago(3))],
          }),
        );
      const store = await create();

      store.attend('ana');
      expect(store.queue()).toEqual([]);

      vi.setSystemTime(NOW + MINUTE);
      service.send({ type: 'interaction', interaction: stuck('a1', NOW + MINUTE) });
      expect(store.queue()).toEqual([]);
      for (const m of [3, 2, 1]) {
        service.send({ type: 'event', event: e.run('a1', NOW + MINUTE + m, ['e1-t1']) });
      }
      expect(store.queue().map((row) => row.reason.kind)).toEqual(['stuck_failures']);
    });
  });

  it('gives the live activity of an attempt of the group and its row in the queue', async () => {
    service.snapshots = () =>
      Promise.resolve(
        groupSnapshot({
          attempts: [testAttempt('a1', 'ana', { status: 'tests_failed', updatedAt: ago(9) })],
          events: [3, 2, 1].map((m) => e.run('a1', ago(m), ['e1-t1'])),
        }),
      );
    const store = await create();
    expect(store.activityOf('a1')?.student.id).toBe('ana');
    expect(store.activityOf('unknown')).toBeUndefined();
    expect(store.queuedFor('a1')?.student.id).toBe('ana');

    store.attend('ana');

    expect(store.queuedFor('a1')).toBeUndefined();
  });

  it('knows no attempt before the snapshot arrives', () => {
    service.snapshots = () => new Promise(() => undefined);

    expect(TestBed.inject(LiveStore).activityOf('a1')).toBeUndefined();
  });

  it('gives the figures and the class by exercise of the block shown', async () => {
    await open({ [TEACHER_PARAMS.block]: 'b1' });
    const submitted = (id: string, assignmentId: string) =>
      testAttempt(id, 'cai', {
        assignmentId,
        status: 'submitted',
        finishedAt: ago(2),
        updatedAt: ago(2),
      });
    service.snapshots = () =>
      Promise.resolve(
        groupSnapshot({ attempts: [submitted('a1', 'as1'), submitted('a2', 'as2')] }),
      );

    const store = await create();

    expect(store.figures()).toMatchObject({ inClass: true, working: 1, finished: 1, progress: 33 });
    expect(store.overview().exercises.map((item) => item.students.submitted.length)).toEqual([
      1, 1,
    ]);
  });

  it('tells the recent activity of the group, minute by minute, with its reading', async () => {
    service.snapshots = () =>
      Promise.resolve(
        groupSnapshot({
          attempts: [testAttempt('a1', 'ana', { startedAt: ago(3) })],
          events: [e.run('a1', ago(2)), e.hint('a1', ago(1))],
        }),
      );

    const store = await create();

    expect(store.activity()).toHaveLength(LIVE_ACTIVITY_MINUTES + 1);
    expect(store.activity().at(-3)).toEqual({ start: ago(2), runs: 1, hints: 0 });
    expect(store.activity().at(-2)).toEqual({ start: ago(1), runs: 0, hints: 1 });
    expect(store.rhythm()).toBe('starting');
  });

  it('has no rows nor selection without groups', async () => {
    service.groups = () => Promise.resolve([]);

    const store = await create();

    expect(store.hasNoGroups()).toBe(true);
    expect(store.group()).toBeUndefined();
    expect(store.blocks()).toEqual([]);
    expect(store.selection()).toBeUndefined();
    expect(store.rows()).toEqual([]);
    expect(store.exercises()).toEqual([]);
    expect(store.overview()).toEqual({ exercises: [], elsewhere: [] });
    expect(store.figures()).toMatchObject({ inClass: false, students: 0, progress: null });
    expect(store.activity()).toEqual([]);
    expect(store.rhythm()).toBeNull();
  });

  it('reloads the groups when they failed', async () => {
    service.groups = () => Promise.reject(new DataError('network'));
    const store = await create();
    expect(store.error()).toBeInstanceOf(DataError);

    service.groups = () => Promise.resolve(GROUPS);
    store.reload();
    await settle();

    expect(store.error()).toBeUndefined();
    expect(service.listGroups).toHaveBeenCalledTimes(2);
  });

  it('reloads the snapshot when it failed', async () => {
    service.snapshots = () => Promise.reject(new DataError('network'));
    const store = await create();
    expect(store.error()).toBeInstanceOf(DataError);

    service.snapshots = () => Promise.resolve(groupSnapshot());
    store.reload();
    await settle();

    expect(store.error()).toBeUndefined();
    expect(service.snapshotCalls).toEqual(['g1/todos', 'g1/todos', 'g1/b2']);
  });
});

describe('pickSelection', () => {
  const query = (params: Record<string, string>) => ({
    get: (name: string) => params[name] ?? null,
    has: (name: string) => name in params,
    getAll: (name: string) => (name in params ? [params[name]] : []),
    keys: Object.keys(params),
  });

  it('asks for the whole class with «todos»', () => {
    expect(pickSelection(GROUPS, query({ grupo: 'g1', bloque: 'todos' }))).toEqual({
      group: GROUPS[0],
      blockId: null,
    });
  });

  it('asks for a block of the group', () => {
    expect(pickSelection(GROUPS, query({ grupo: 'g1', bloque: 'b1' }))?.blockId).toBe('b1');
  });

  it('leaves the block to pick without one or with one of another group', () => {
    expect(pickSelection(GROUPS, query({ grupo: 'g1', bloque: 'nope' }))?.blockId).toBeUndefined();
    expect(pickSelection(GROUPS, undefined)).toEqual({ group: GROUPS[0], blockId: undefined });
  });

  it('falls back to the first group when the one of the URL is unknown', () => {
    expect(pickSelection(GROUPS, query({ grupo: 'nope' }))?.group).toBe(GROUPS[0]);
  });

  it('follows the whole class of a group without blocks', () => {
    expect(pickSelection(GROUPS, query({ grupo: 'g2' }))).toEqual({
      group: GROUPS[1],
      blockId: null,
    });
  });

  it('has nothing to follow without groups', () => {
    expect(pickSelection([], undefined)).toBeUndefined();
  });
});
