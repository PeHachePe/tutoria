import { TestBed } from '@angular/core/testing';
import type { RealtimeChannel } from '@supabase/supabase-js';

import type { LiveUpdate } from '../live-service';
import { SUPABASE_CLIENT } from './supabase-client';
import { SupabaseLiveService } from './supabase-live-service';
import {
  attemptRow,
  blockRow,
  eventRow,
  exerciseRow,
  FakeSupabaseServer,
  interactionRow,
  provideFakeSupabase,
  subjectRow,
  testRow,
} from './supabase-testing';

describe('SupabaseLiveService', () => {
  let server: FakeSupabaseServer;
  let service: SupabaseLiveService;

  beforeEach(() => {
    server = new FakeSupabaseServer();
    TestBed.configureTestingModule({
      providers: [SupabaseLiveService, provideFakeSupabase(server)],
    });
    service = TestBed.inject(SupabaseLiveService);
  });

  describe('listGroups', () => {
    it('reads the groups the RLS lets through, sorted, with their blocks and latest block', async () => {
      server
        .on('GET', '/rest/v1/class_group', {
          body: [
            {
              id: 'daw',
              name: '1.º DAW A',
              subject: subjectRow(),
              class_block: [blockRow({ id: 'b2', position: 2 }), blockRow({ id: 'b1' })],
            },
            {
              id: 'web',
              name: '1.º DAW A',
              subject: subjectRow({ id: 's2', name: 'Desarrollo web' }),
              class_block: [],
            },
          ],
        })
        .on('GET', '/rest/v1/attempt', (request) => ({
          body:
            request.params.get('exercise_assignment.group_id') === 'eq.daw'
              ? { exercise_assignment: { block_id: 'b2', group_id: 'daw' } }
              : null,
        }));

      const groups = await service.listGroups();

      expect(groups.map((group) => [group.id, group.latestBlockId])).toEqual([
        ['web', null],
        ['daw', 'b2'],
      ]);
      expect(groups[1].blocks.map((block) => block.id)).toEqual(['b1', 'b2']);
      expect(groups[1].subject.name).toBe('Programación básica');
      const latest = server.sentTo('GET', '/rest/v1/attempt')[0].params;
      expect(latest.get('order')).toBe('updated_at.desc');
      expect(latest.get('limit')).toBe('1');
    });

    it('sorts groups of the same name by the name of their subject', async () => {
      server
        .on('GET', '/rest/v1/class_group', {
          body: [
            { id: 'b', name: 'X', subject: subjectRow({ name: 'Zeta' }), class_block: [] },
            { id: 'a', name: 'X', subject: subjectRow({ name: 'Alfa' }), class_block: [] },
          ],
        })
        .on('GET', '/rest/v1/attempt', { body: null });

      expect((await service.listGroups()).map((group) => group.id)).toEqual(['a', 'b']);
    });
  });

  describe('snapshot', () => {
    const exercise = (id: string, tests: ReturnType<typeof testRow>[] = []) => ({
      ...exerciseRow({ id }),
      test: tests,
    });

    beforeEach(() => {
      server
        .on('GET', '/rest/v1/class_group', {
          body: {
            id: 'daw',
            class_block: [
              { id: 'b2', position: 2 },
              { id: 'b1', position: 1 },
            ],
          },
        })
        .on('GET', '/rest/v1/enrollment', {
          body: [
            { app_user: { id: 'u2', name: 'Pablo' } },
            { app_user: { id: 'u1', name: 'Ana' } },
          ],
        })
        .on('GET', '/rest/v1/exercise_assignment', {
          body: [
            { id: 'as3', block_id: 'b2', position: 1, exercise: exercise('exercise-3') },
            { id: 'as2', block_id: 'b1', position: 5, exercise: exercise('exercise-2') },
            {
              id: 'as1',
              block_id: 'b1',
              position: 2,
              exercise: exercise('exercise-1', [
                testRow({ id: 't2', position: 2 }),
                testRow({ id: 't1', position: 1 }),
              ]),
            },
          ],
        })
        // The attempts of the session, or every attempt of the block
        .on('GET', '/rest/v1/attempt', (request) => ({
          body: request.params.has('updated_at')
            ? [
                {
                  ...attemptRow({ id: 'a3', assignment_id: 'as3' }),
                  process_event: [eventRow({ id: 'e3', attempt_id: 'a3' })],
                  tutor_interaction: [interactionRow({ id: 'i3', attempt_id: 'a3' })],
                },
                {
                  ...attemptRow({ id: 'a1', assignment_id: 'as1' }),
                  process_event: [eventRow({ id: 'e1', attempt_id: 'a1' })],
                  tutor_interaction: [],
                },
              ]
            : [
                {
                  ...attemptRow({ id: 'a1', assignment_id: 'as1' }),
                  process_event: [eventRow({ id: 'e1', attempt_id: 'a1' })],
                  tutor_interaction: [],
                },
                {
                  ...attemptRow({ id: 'a2', assignment_id: 'as2' }),
                  process_event: [],
                  tutor_interaction: [interactionRow({ id: 'i2', attempt_id: 'a2' })],
                },
              ],
        }));
    });

    it('reads the students and every exercise of the group, by block and position', async () => {
      const snapshot = await service.snapshot('daw', null);

      expect(snapshot.students).toEqual([
        { id: 'u1', name: 'Ana' },
        { id: 'u2', name: 'Pablo' },
      ]);
      expect(
        snapshot.exercises.map((entry) => [
          entry.assignmentId,
          entry.blockId,
          entry.tests.map((t) => t.id),
        ]),
      ).toEqual([
        ['as1', 'b1', ['t1', 't2']],
        ['as2', 'b1', []],
        ['as3', 'b2', []],
      ]);
      expect(snapshot.exercises[0].exercise.maxIdleMinutes).toBe(4);
      expect(server.sentTo('GET', '/rest/v1/class_group')[0].params.get('id')).toBe('eq.daw');
      expect(server.sentTo('GET', '/rest/v1/exercise_assignment')[0].params.get('group_id')).toBe(
        'eq.daw',
      );
    });

    it('without a block, reads only the attempts of the session, with their events and interactions', async () => {
      const snapshot = await service.snapshot('daw', null);

      expect(snapshot.attempts.map((attempt) => attempt.id)).toEqual(['a3', 'a1']);
      expect(snapshot.events.map((event) => event.id)).toEqual(['e3', 'e1']);
      expect(snapshot.interactions.map((interaction) => interaction.id)).toEqual(['i3']);
      const requests = server.sentTo('GET', '/rest/v1/attempt');
      expect(requests).toHaveLength(1);
      expect(requests[0].params.get('assignment_id')).toBe('in.(as1,as2,as3)');
      expect(requests[0].params.get('updated_at')).toMatch(/^gte\./);
    });

    it('with a block, also reads every attempt of it, joined without repeating any', async () => {
      const snapshot = await service.snapshot('daw', 'b1');

      expect(snapshot.attempts.map((attempt) => attempt.id)).toEqual(['a3', 'a1', 'a2']);
      expect(snapshot.events.map((event) => event.id)).toEqual(['e3', 'e1']);
      expect(snapshot.interactions.map((interaction) => interaction.id)).toEqual(['i3', 'i2']);
      const block = server
        .sentTo('GET', '/rest/v1/attempt')
        .find((request) => !request.params.has('updated_at'));
      expect(block?.params.get('assignment_id')).toBe('in.(as1,as2)');
    });

    it('reads only the attempts of the session for a block without exercises', async () => {
      server.on('GET', '/rest/v1/exercise_assignment', {
        body: [{ id: 'as1', block_id: 'b1', position: 1, exercise: exercise('exercise-1') }],
      });

      await service.snapshot('daw', 'b2');

      expect(server.sentTo('GET', '/rest/v1/attempt')).toHaveLength(1);
    });

    it('does not ask for attempts of a group without exercises', async () => {
      server.on('GET', '/rest/v1/exercise_assignment', { body: [] });

      const snapshot = await service.snapshot('daw', 'b1');

      expect(snapshot.attempts).toEqual([]);
      expect(server.sentTo('GET', '/rest/v1/attempt')).toHaveLength(0);
    });

    it('does not find a group the RLS hides or a block of another group', async () => {
      await expect(service.snapshot('daw', 'b9')).rejects.toMatchObject({ kind: 'not_found' });
      server.on('GET', '/rest/v1/class_group', { body: null });
      await expect(service.snapshot('dam', null)).rejects.toMatchObject({ kind: 'not_found' });
    });
  });

  describe('attemptDetail', () => {
    const detailRow = (overrides: Record<string, unknown> = {}) => ({
      ...attemptRow({ assignment_id: 'as1' }),
      app_user: { id: 'user-1', name: 'Ana' },
      process_event: [
        eventRow({ id: 'e2', timestamp: '2026-11-13T10:05:00.000Z' }),
        eventRow({ id: 'e1', timestamp: '2026-11-13T10:01:00.000Z' }),
      ],
      tutor_interaction: [
        interactionRow({ id: 'i2', created_at: '2026-11-13T10:04:00.000Z' }),
        interactionRow({ id: 'i1', created_at: '2026-11-13T10:02:00.000Z' }),
      ],
      exercise_assignment: {
        id: 'as1',
        group_id: 'daw',
        block_id: 'b1',
        exercise: {
          ...exerciseRow(),
          test: [testRow({ id: 't2', position: 2 }), testRow({ id: 't1', position: 1 })],
        },
        attempt: [
          { id: 'attempt-2', number: 2, user_id: 'user-1' },
          { id: 'other', number: 1, user_id: 'user-2' },
          { id: 'attempt-1', number: 1, user_id: 'user-1' },
        ],
      },
      ...overrides,
    });

    it('reads the attempt with its student, exercise, assignment, events and interactions in one request', async () => {
      server.on('GET', '/rest/v1/attempt', { body: detailRow() });

      const detail = await service.attemptDetail('attempt-1');

      expect(detail.attempt.id).toBe('attempt-1');
      expect(detail).toMatchObject({
        groupId: 'daw',
        blockId: 'b1',
        student: { id: 'user-1', name: 'Ana' },
        exercise: { assignmentId: 'as1', blockId: 'b1', exercise: { maxIdleMinutes: 4 } },
      });
      expect(detail.exercise.tests.map((test) => test.id)).toEqual(['t1', 't2']);
      expect(detail.events.map((event) => event.id)).toEqual(['e1', 'e2']);
      expect(detail.interactions.map((interaction) => interaction.id)).toEqual(['i1', 'i2']);
      expect(detail.siblings).toEqual([
        { id: 'attempt-1', number: 1 },
        { id: 'attempt-2', number: 2 },
      ]);
      expect(server.sentTo('GET', '/rest/v1/attempt')[0].params.get('id')).toBe('eq.attempt-1');
    });

    it.each([
      ['an attempt the RLS hides', null],
      ['an attempt without assignment', detailRow({ exercise_assignment: null })],
    ])('does not find %s', async (_, body) => {
      server.on('GET', '/rest/v1/attempt', { body });

      await expect(service.attemptDetail('attempt-1')).rejects.toMatchObject({
        kind: 'not_found',
      });
    });
  });

  describe('watch', () => {
    type Handler = (change: { eventType: string; new: unknown }) => void;
    let handlers: Map<string, Handler>;
    let channel: RealtimeChannel;

    beforeEach(() => {
      handlers = new Map();
      channel = {
        on: (_type: string, filter: { table: string }, handler: Handler) => {
          handlers.set(filter.table, handler);
          return channel;
        },
        subscribe: () => channel,
      } as unknown as RealtimeChannel;
      const client = TestBed.inject(SUPABASE_CLIENT);
      vi.spyOn(client, 'channel').mockReturnValue(channel);
      vi.spyOn(client, 'removeChannel').mockResolvedValue('ok');
    });

    it('tells the attempts that change and the new events and interactions, until it stops', () => {
      const updates: LiveUpdate[] = [];
      const stop = service.watch('daw', (update) => updates.push(update));

      handlers.get('attempt')?.({ eventType: 'UPDATE', new: attemptRow({ status: 'passed' }) });
      handlers.get('attempt')?.({ eventType: 'DELETE', new: {} });
      handlers.get('process_event')?.({ eventType: 'INSERT', new: eventRow() });
      handlers.get('tutor_interaction')?.({ eventType: 'INSERT', new: interactionRow() });
      stop();

      expect(updates.map((update) => update.type)).toEqual(['attempt', 'event', 'interaction']);
      expect(updates[0]).toMatchObject({ attempt: { status: 'passed' } });
      expect(TestBed.inject(SUPABASE_CLIENT).channel).toHaveBeenCalledWith('live:daw');
      expect(TestBed.inject(SUPABASE_CLIENT).removeChannel).toHaveBeenCalledWith(channel);
    });
  });
});
