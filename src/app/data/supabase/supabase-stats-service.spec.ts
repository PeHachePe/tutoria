import { TestBed } from '@angular/core/testing';

import type { Database } from './database.types';
import { SupabaseStatsService } from './supabase-stats-service';
import { blockRow, exerciseRow, FakeSupabaseServer, provideFakeSupabase } from './supabase-testing';

type Functions = Database['public']['Functions'];
type WorkRow = Functions['group_work_stats']['Returns'][number];
type DeadlineRow = Functions['group_deadline_stats']['Returns'][number];

function workRow(overrides: Partial<WorkRow> = {}): WorkRow {
  return {
    id: 'block-1',
    block_id: 'block-1',
    is_block: true,
    students: 24,
    assignments: 1,
    attempts: 20,
    active_students: 18,
    hints: 12,
    solved: 15,
    median_seconds: 540,
    stuck_students: 2,
    ...overrides,
  };
}

function deadlineRow(overrides: Partial<DeadlineRow> = {}): DeadlineRow {
  return {
    block_id: 'block-1',
    due_at: '2026-11-06 22:59:00+00',
    assignments: 2,
    on_time: 30,
    last_hours: 4,
    late: 1,
    missing_ids: [],
    missing_names: [],
    missing_pending: [],
    ...overrides,
  };
}

describe('SupabaseStatsService', () => {
  let server: FakeSupabaseServer;
  let service: SupabaseStatsService;

  beforeEach(() => {
    server = new FakeSupabaseServer();
    TestBed.configureTestingModule({
      providers: [SupabaseStatsService, provideFakeSupabase(server)],
    });
    service = TestBed.inject(SupabaseStatsService);
  });

  /** The blocks of the group with their exercises, and the two functions. */
  function answer(
    blocks: unknown[],
    work: readonly WorkRow[] = [],
    deadlines: readonly DeadlineRow[] = [],
  ): void {
    server
      .on('GET', '/rest/v1/class_block', { body: blocks })
      .on('POST', '/rest/v1/rpc/group_work_stats', { body: work })
      .on('POST', '/rest/v1/rpc/group_deadline_stats', { body: deadlines });
  }

  it('reads the blocks of the group in order and asks both functions for it', async () => {
    answer([]);

    await service.groupHistory('daw');

    const [blocks] = server.sentTo('GET', '/rest/v1/class_block');
    expect(blocks.params.get('group_id')).toBe('eq.daw');
    expect(blocks.params.get('order')).toBe('position.asc');
    expect(blocks.params.get('exercise_assignment.order')).toBe('position.asc');
    expect(server.sentTo('POST', '/rest/v1/rpc/group_work_stats')[0].body).toEqual({
      target_group_id: 'daw',
    });
    expect(server.sentTo('POST', '/rest/v1/rpc/group_deadline_stats')[0].body).toEqual({
      target_group_id: 'daw',
    });
  });

  it('gives each block its figures and those of the exercises that count, in order', async () => {
    answer(
      [
        {
          ...blockRow(),
          exercise_assignment: [
            { id: 'a-1', exercise: exerciseRow() },
            { id: 'a-hidden', exercise: exerciseRow({ id: 'exercise-hidden' }) },
            { id: 'a-2', exercise: exerciseRow({ id: 'exercise-2' }) },
          ],
        },
        { ...blockRow({ id: 'block-2', position: 2 }), exercise_assignment: [] },
      ],
      [
        workRow({ assignments: 2 }),
        workRow({ id: 'a-1', is_block: false, attempts: 12, median_seconds: 0 }),
        workRow({ id: 'a-2', is_block: false, attempts: 8 }),
        workRow({ id: 'block-2', block_id: 'block-2', assignments: 0, attempts: 0 }),
      ],
    );

    const history = await service.groupHistory('daw');

    expect(history.students).toBe(24);
    expect(history.blocks.map(({ block }) => block.id)).toEqual(['block-1', 'block-2']);
    expect(history.blocks[0]).toMatchObject({
      block: { title: 'Tema 1: Bucles', position: 1 },
      assignments: 2,
      attempts: 20,
      activeStudents: 18,
      hints: 12,
      solved: 15,
      medianSeconds: 540,
      stuckStudents: 2,
    });
    expect(history.blocks[0].exercises).toEqual([
      expect.objectContaining({
        assignmentId: 'a-1',
        exercise: expect.objectContaining({ id: 'exercise-1' }),
        attempts: 12,
        medianSeconds: null,
      }),
      expect.objectContaining({
        assignmentId: 'a-2',
        exercise: expect.objectContaining({ id: 'exercise-2' }),
        attempts: 8,
      }),
    ]);
    expect(history.blocks[1]).toMatchObject({ assignments: 0, attempts: 0, exercises: [] });
  });

  it('gives a block without figures, created meanwhile, everything at zero', async () => {
    answer([{ ...blockRow(), exercise_assignment: [{ id: 'a-1', exercise: exerciseRow() }] }]);

    const [stats] = (await service.groupHistory('daw')).blocks;

    expect(stats).toEqual({
      block: expect.objectContaining({ id: 'block-1' }),
      assignments: 0,
      attempts: 0,
      activeStudents: 0,
      hints: 0,
      solved: 0,
      medianSeconds: null,
      stuckStudents: 0,
      exercises: [],
    });
  });

  it('gives each due date its submissions and who is missing, by name', async () => {
    answer(
      [
        { ...blockRow(), exercise_assignment: [] },
        { ...blockRow({ id: 'block-2', position: 2 }), exercise_assignment: [] },
      ],
      [workRow()],
      [
        deadlineRow({ block_id: 'block-2', due_at: '2026-11-06 22:59:00+00' }),
        deadlineRow({
          missing_ids: ['u-alex', 'u-adrian'],
          missing_names: ['Álex Ruiz', 'Adrián López'],
          missing_pending: [2, 1],
        }),
        deadlineRow({ due_at: '2026-10-30 22:59:00+00' }),
      ],
    );

    const { deadlines } = await service.groupHistory('daw');

    expect(deadlines.map(({ blockId, dueAt }) => [blockId, dueAt])).toEqual([
      ['block-1', '2026-10-30T22:59:00.000Z'],
      ['block-1', '2026-11-06T22:59:00.000Z'],
      ['block-2', '2026-11-06T22:59:00.000Z'],
    ]);
    expect(deadlines[1]).toEqual({
      blockId: 'block-1',
      dueAt: '2026-11-06T22:59:00.000Z',
      assignments: 2,
      onTime: 30,
      lastHours: 4,
      late: 1,
      missing: [
        { student: { id: 'u-adrian', name: 'Adrián López' }, pending: 1 },
        { student: { id: 'u-alex', name: 'Álex Ruiz' }, pending: 2 },
      ],
    });
  });

  it('counts no students in a group without blocks', async () => {
    answer([]);

    expect(await service.groupHistory('daw')).toEqual({ students: 0, blocks: [], deadlines: [] });
  });

  it('answers not_found for a group the user does not teach', async () => {
    answer([]);
    server.on('POST', '/rest/v1/rpc/group_work_stats', {
      status: 404,
      body: { code: 'P0002', message: 'Group not found' },
    });

    await expect(service.groupHistory('dam')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('answers not_found when only the due dates fail', async () => {
    answer([{ ...blockRow(), exercise_assignment: [] }], [workRow()]);
    server.on('POST', '/rest/v1/rpc/group_deadline_stats', {
      status: 404,
      body: { code: 'P0002', message: 'Group not found' },
    });

    await expect(service.groupHistory('dam')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('answers network without a network', async () => {
    server.offline();

    await expect(service.groupHistory('daw')).rejects.toMatchObject({ kind: 'network' });
  });
});
