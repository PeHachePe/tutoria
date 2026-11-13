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
    beforeEach(() => {
      server
        .on('GET', '/rest/v1/class_block', { body: { id: 'b1' } })
        .on('GET', '/rest/v1/enrollment', {
          body: [
            { app_user: { id: 'u2', name: 'Pablo' } },
            { app_user: { id: 'u1', name: 'Ana' } },
          ],
        })
        .on('GET', '/rest/v1/exercise_assignment', {
          body: [
            {
              id: 'as1',
              exercise: {
                ...exerciseRow(),
                test: [testRow({ id: 't2', position: 2 }), testRow({ id: 't1', position: 1 })],
              },
            },
            { id: 'as2', exercise: { ...exerciseRow({ id: 'exercise-2' }), test: [] } },
          ],
        })
        .on('GET', '/rest/v1/attempt', {
          body: [{ ...attemptRow({ assignment_id: 'as1' }), process_event: [eventRow()] }],
        });
    });

    it('reads the students, the exercises with their tests and the attempts with their events', async () => {
      const snapshot = await service.snapshot('daw', 'b1');

      expect(snapshot.students).toEqual([
        { id: 'u1', name: 'Ana' },
        { id: 'u2', name: 'Pablo' },
      ]);
      expect(
        snapshot.exercises.map((entry) => [entry.assignmentId, entry.tests.map((t) => t.id)]),
      ).toEqual([
        ['as1', ['t1', 't2']],
        ['as2', []],
      ]);
      expect(snapshot.exercises[0].exercise.maxIdleMinutes).toBe(4);
      expect(snapshot.attempts.map((attempt) => attempt.id)).toEqual(['attempt-1']);
      expect(snapshot.events.map((event) => event.id)).toEqual(['event-1']);
      const assignments = server.sentTo('GET', '/rest/v1/exercise_assignment')[0].params;
      expect(assignments.get('group_id')).toBe('eq.daw');
      expect(assignments.get('block_id')).toBe('eq.b1');
      expect(server.sentTo('GET', '/rest/v1/attempt')[0].params.get('assignment_id')).toBe(
        'in.(as1,as2)',
      );
    });

    it('does not ask for attempts of a block without exercises', async () => {
      server.on('GET', '/rest/v1/exercise_assignment', { body: [] });

      const snapshot = await service.snapshot('daw', 'b1');

      expect(snapshot.attempts).toEqual([]);
      expect(server.sentTo('GET', '/rest/v1/attempt')).toHaveLength(0);
    });

    it('does not find a block of another group', async () => {
      server.on('GET', '/rest/v1/class_block', { body: null });

      await expect(service.snapshot('daw', 'b9')).rejects.toMatchObject({ kind: 'not_found' });
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

    it('tells the attempts that change and the new events, until it stops', () => {
      const updates: LiveUpdate[] = [];
      const stop = service.watch('daw', (update) => updates.push(update));

      handlers.get('attempt')?.({ eventType: 'UPDATE', new: attemptRow({ status: 'passed' }) });
      handlers.get('attempt')?.({ eventType: 'DELETE', new: {} });
      handlers.get('process_event')?.({ eventType: 'INSERT', new: eventRow() });
      stop();

      expect(updates.map((update) => update.type)).toEqual(['attempt', 'event']);
      expect(updates[0]).toMatchObject({ attempt: { status: 'passed' } });
      expect(TestBed.inject(SUPABASE_CLIENT).channel).toHaveBeenCalledWith('live:daw');
      expect(TestBed.inject(SUPABASE_CLIENT).removeChannel).toHaveBeenCalledWith(channel);
    });
  });
});
