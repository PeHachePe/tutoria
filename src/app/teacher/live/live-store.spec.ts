import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { TEACHER_PARAMS } from '../../core/app-paths';
import { DataError } from '../../data/data-error';
import { LiveService } from '../../data/live-service';
import { testEvents as e } from '../../data/process-event-testing';
import { LIVE_CLOCK_MS, LiveStore, pickSelection } from './live-store';
import {
  ago,
  BLOCK_EXERCISES,
  FakeLiveService,
  GROUPS,
  MINUTE,
  NOW,
  testAttempt,
  testSnapshot,
} from './live-testing';

describe('LiveStore', () => {
  let service: FakeLiveService;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    service = new FakeLiveService();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), LiveStore, { provide: LiveService, useValue: service }],
    });
  });

  afterEach(() => vi.useRealTimers());

  async function settle(): Promise<void> {
    await TestBed.inject(ApplicationRef).whenStable();
  }

  async function create(): Promise<LiveStore> {
    const store = TestBed.inject(LiveStore);
    await settle();
    return store;
  }

  it('follows the latest block of the first group without parameters', async () => {
    const store = await create();

    expect(store.selection()).toEqual({ group: GROUPS[0], blockId: 'b2' });
    expect(service.snapshotCalls).toEqual(['g1/b2']);
    expect(store.rows().map((row) => row.student.id)).toEqual(['ana', 'bea', 'cai']);
    expect(store.exercises()).toBe(BLOCK_EXERCISES);
    expect(store.isLoading()).toBe(false);
  });

  it('follows the group and the block of the URL', async () => {
    await TestBed.inject(Router).navigate([], {
      queryParams: { [TEACHER_PARAMS.group]: 'g1', [TEACHER_PARAMS.block]: 'b1' },
    });

    await create();

    expect(service.snapshotCalls).toEqual(['g1/b1']);
  });

  it('applies the live changes and moves its clock with them', async () => {
    const store = await create();
    vi.setSystemTime(NOW + 5000);

    service.send({ type: 'attempt', attempt: testAttempt('a1', 'ana', { updatedAt: NOW }) });

    expect(store.rows()[0].attempt?.id).toBe('a1');
    expect(store.now()).toBe(NOW + 5000);
    expect(store.summary().inSession).toBe(1);
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

    await TestBed.inject(Router).navigate([], { queryParams: { [TEACHER_PARAMS.block]: 'b1' } });
    await settle();
    previous?.({ type: 'attempt', attempt: testAttempt('a1', 'ana', { updatedAt: NOW }) });

    expect(service.stopped).toEqual(['g1']);
    expect(store.rows()[0].attempt).toBeNull();
  });

  it('moves the clock every 15 s and stops it and the watch when destroyed', async () => {
    const store = await create();

    vi.advanceTimersByTime(LIVE_CLOCK_MS);
    expect(store.now()).toBe(NOW + LIVE_CLOCK_MS);

    TestBed.resetTestingModule();
    vi.advanceTimersByTime(LIVE_CLOCK_MS);
    expect(service.stopped).toEqual(['g1']);
  });

  it('queues who needs help: stuck with the code first, then idle, then away', async () => {
    service.snapshots = () =>
      Promise.resolve(
        testSnapshot({
          attempts: [
            testAttempt('a1', 'ana', { updatedAt: ago(1) }),
            testAttempt('a2', 'bea', { updatedAt: ago(9) }),
            testAttempt('a3', 'cai', { status: 'tests_failed', updatedAt: ago(1) }),
          ],
          events: [
            e.focusLost('a1', ago(20)),
            ...[3, 2, 1].map((m) => e.run('a3', ago(m), ['e1-t1'])),
          ],
        }),
      );

    const store = await create();

    expect(store.queue().map((row) => row.student.id)).toEqual(['cai', 'bea', 'ana']);
    expect(store.summary()).toEqual({ inSession: 3, finished: 0 });
  });

  it('serves first whoever has waited longest within a tier', async () => {
    service.snapshots = () =>
      Promise.resolve(
        testSnapshot({
          attempts: [
            testAttempt('a1', 'ana', { updatedAt: ago(6) }),
            testAttempt('a2', 'bea', { updatedAt: ago(9) }),
          ],
        }),
      );

    const store = await create();

    expect(store.queue().map((row) => row.student.id)).toEqual(['bea', 'ana']);
  });

  it('takes an attended student out of the queue until a newer signal', async () => {
    service.snapshots = () =>
      Promise.resolve(
        testSnapshot({ attempts: [testAttempt('a1', 'ana', { updatedAt: ago(9) })] }),
      );
    const store = await create();

    store.attend('ana');
    expect(store.queue()).toEqual([]);

    vi.setSystemTime(NOW + MINUTE);
    service.send({ type: 'event', event: e.focusLost('a1', NOW + MINUTE) });
    expect(store.queue().map((row) => row.student.id)).toEqual(['ana']);
  });

  it('gives the live activity of an attempt of the block and its row in the queue', async () => {
    service.snapshots = () =>
      Promise.resolve(
        testSnapshot({ attempts: [testAttempt('a1', 'ana', { updatedAt: ago(9) })] }),
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

  it('counts who has the whole block submitted and gives the class by exercise', async () => {
    const submitted = (id: string, assignmentId: string) =>
      testAttempt(id, 'cai', {
        assignmentId,
        status: 'submitted',
        finishedAt: ago(2),
        updatedAt: ago(2),
      });
    service.snapshots = () =>
      Promise.resolve(testSnapshot({ attempts: [submitted('a1', 'as1'), submitted('a2', 'as2')] }));

    const store = await create();

    expect(store.summary()).toEqual({ inSession: 1, finished: 1 });
    expect(store.overview().map((exercise) => exercise.counts.submitted)).toEqual([1, 1]);
  });

  it('has no rows nor selection without groups', async () => {
    service.groups = () => Promise.resolve([]);

    const store = await create();

    expect(store.hasNoGroups()).toBe(true);
    expect(store.selection()).toBeUndefined();
    expect(store.rows()).toEqual([]);
    expect(store.exercises()).toEqual([]);
    expect(store.overview()).toEqual([]);
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

    service.snapshots = () => Promise.resolve(testSnapshot());
    store.reload();
    await settle();

    expect(store.error()).toBeUndefined();
    expect(service.snapshotCalls).toHaveLength(2);
  });
});

describe('pickSelection', () => {
  const query = (params: Record<string, string>) => ({
    get: (name: string) => params[name] ?? null,
    has: (name: string) => name in params,
    getAll: (name: string) => (name in params ? [params[name]] : []),
    keys: Object.keys(params),
  });

  it('falls back to the first group when the one of the URL is unknown', () => {
    expect(pickSelection(GROUPS, query({ grupo: 'nope', bloque: 'nope' }))).toEqual({
      group: GROUPS[0],
      blockId: 'b2',
    });
  });

  it('falls back to the first block without a latest one', () => {
    const group = { ...GROUPS[0], latestBlockId: null };

    expect(pickSelection([group], undefined)?.blockId).toBe('b1');
  });

  it('has no selection for a group without blocks', () => {
    expect(pickSelection(GROUPS, query({ grupo: 'g2' }))).toBeUndefined();
  });
});
