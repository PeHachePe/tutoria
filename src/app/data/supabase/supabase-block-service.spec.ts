import { TestBed } from '@angular/core/testing';

import type { BlockDraft } from '../block-service';
import { SupabaseBlockService } from './supabase-block-service';
import {
  assignmentRow,
  blockRow,
  exerciseRow,
  FakeSupabaseServer,
  provideFakeSupabase,
  subjectRow,
} from './supabase-testing';

const DRAFT: BlockDraft = {
  title: 'Examen',
  sourceLocale: 'es',
  translations: { en: { title: 'Exam' } },
  isHidden: true,
  opensAt: '2026-12-14T08:00:00.000Z',
};

describe('SupabaseBlockService', () => {
  let server: FakeSupabaseServer;
  let service: SupabaseBlockService;

  beforeEach(() => {
    server = new FakeSupabaseServer();
    TestBed.configureTestingModule({
      providers: [SupabaseBlockService, provideFakeSupabase(server)],
    });
    service = TestBed.inject(SupabaseBlockService);
  });

  it('lists the groups the RLS gives, by name and subject', async () => {
    const web = subjectRow({ id: 'web', name: 'Desarrollo web' });
    server.on('GET', '/rest/v1/class_group', {
      body: [
        { id: 'daw', name: '1.º DAW A', subject: subjectRow() },
        { id: 'dam', name: '1.º DAM B', subject: subjectRow() },
        { id: 'daw-web', name: '1.º DAW A', subject: web },
      ],
    });

    const groups = await service.listGroups();

    expect(groups.map((group) => group.id)).toEqual(['dam', 'daw-web', 'daw']);
    expect(groups[1].subject).toMatchObject({ id: 'web', name: 'Desarrollo web' });
  });

  it('lists the blocks of a group in order, with their exercises and who started them', async () => {
    server
      .on('GET', '/rest/v1/class_group', {
        body: {
          id: 'daw',
          class_block: [
            {
              ...blockRow(),
              exercise_assignment: [
                { ...assignmentRow(), exercise: exerciseRow() },
                {
                  ...assignmentRow({ id: 'a-2', position: 2, due_at: '2026-12-01T22:59:00+00:00' }),
                  exercise: exerciseRow({ id: 'exercise-2' }),
                },
              ],
            },
            { ...blockRow({ id: 'block-2', position: 2 }), exercise_assignment: [] },
          ],
        },
      })
      .on('POST', '/rest/v1/rpc/assignment_student_counts', {
        body: [{ assignment_id: 'a-1', student_count: 3 }],
      });

    const blocks = await service.listBlocks('daw');

    expect(blocks.map((entry) => entry.block.id)).toEqual(['block-1', 'block-2']);
    expect(blocks[0].assignments).toEqual([
      expect.objectContaining({
        studentCount: 3,
        exercise: expect.objectContaining({ id: 'exercise-1' }),
      }),
      expect.objectContaining({
        assignment: expect.objectContaining({ id: 'a-2', dueAt: '2026-12-01T22:59:00.000Z' }),
        studentCount: 0,
      }),
    ]);
    const [request] = server.sentTo('GET', '/rest/v1/class_group');
    expect(request.params.get('id')).toBe('eq.daw');
    expect(request.params.get('class_block.order')).toBe('position.asc');
    expect(request.params.get('class_block.exercise_assignment.order')).toBe('position.asc');
    const [counts] = server.sentTo('POST', '/rest/v1/rpc/assignment_student_counts');
    expect(counts.body).toEqual({ target_group_id: 'daw' });
  });

  it('does not find a group the RLS hides', async () => {
    server
      .on('GET', '/rest/v1/class_group', {
        status: 406,
        body: { code: 'PGRST116', message: 'No rows' },
      })
      .on('POST', '/rest/v1/rpc/assignment_student_counts', { body: [] });

    await expect(service.listBlocks('dam')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('creates a block after the others on the server', async () => {
    server.on('POST', '/rest/v1/rpc/create_block', {
      body: blockRow({ id: 'block-9', position: 9, title: 'Examen', is_hidden: true }),
    });

    await expect(service.createBlock('daw', DRAFT)).resolves.toMatchObject({
      id: 'block-9',
      position: 9,
    });
    expect(server.requests[0].body).toEqual({
      target_group_id: 'daw',
      block_title: 'Examen',
      block_source_locale: 'es',
      block_translations: { en: { title: 'Exam' } },
      block_is_hidden: true,
      block_opens_at: '2026-12-14T08:00:00.000Z',
    });
  });

  it('creates a block that opens at once without the date', async () => {
    server.on('POST', '/rest/v1/rpc/create_block', { body: blockRow({ id: 'block-9' }) });

    await service.createBlock('daw', { ...DRAFT, opensAt: null });

    expect(server.requests[0].body).not.toHaveProperty('block_opens_at');
  });

  it('changes a block', async () => {
    server.on('PATCH', '/rest/v1/class_block', { body: blockRow({ title: 'Examen' }) });

    await expect(service.updateBlock('block-1', DRAFT)).resolves.toMatchObject({ title: 'Examen' });
    expect(server.requests[0].params.get('id')).toBe('eq.block-1');
    expect(server.requests[0].body).toEqual({
      title: 'Examen',
      source_locale: 'es',
      translations: { en: { title: 'Exam' } },
      is_hidden: true,
      opens_at: '2026-12-14T08:00:00.000Z',
    });
  });

  it('reads when a block opens', async () => {
    server.on('PATCH', '/rest/v1/class_block', {
      body: blockRow({ opens_at: '2026-12-14 08:00:00+00' }),
    });

    await expect(service.updateBlock('block-1', DRAFT)).resolves.toMatchObject({
      opensAt: '2026-12-14T08:00:00.000Z',
    });
  });

  it('removes a block, or says it cannot when the RLS keeps it', async () => {
    server.on('DELETE', '/rest/v1/class_block', { body: [{ id: 'block-1' }] });
    await service.removeBlock('block-1');
    expect(server.requests[0].params.get('id')).toBe('eq.block-1');

    server.on('DELETE', '/rest/v1/class_block', { body: [] });
    await expect(service.removeBlock('block-1')).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('reorders the blocks of a group', async () => {
    server.on('POST', '/rest/v1/rpc/reorder_blocks', { status: 204 });

    await service.reorderBlocks('daw', ['block-2', 'block-1']);

    expect(server.requests[0].body).toEqual({
      target_group_id: 'daw',
      block_ids: ['block-2', 'block-1'],
    });
  });

  it('rejects an order without every block', async () => {
    server.on('POST', '/rest/v1/rpc/reorder_blocks', {
      status: 400,
      body: { code: '22023', message: 'The new order must have every block of the group once' },
    });

    await expect(service.reorderBlocks('daw', ['block-1'])).rejects.toMatchObject({
      kind: 'invalid',
    });
  });

  it('assigns exercises at the end of a block', async () => {
    server.on('POST', '/rest/v1/rpc/assign_exercises', {
      body: [assignmentRow({ id: 'a-3', position: 3 })],
    });

    await expect(service.assign('block-1', ['exercise-1'])).resolves.toEqual([
      expect.objectContaining({ id: 'a-3', position: 3, dueAt: null }),
    ]);
    expect(server.requests[0].body).toEqual({
      target_block_id: 'block-1',
      exercise_ids: ['exercise-1'],
    });
  });

  it('changes only what is given of an assignment', async () => {
    server.on('PATCH', '/rest/v1/exercise_assignment', {
      body: assignmentRow({ due_at: '2026-12-01T22:59:00+00:00' }),
    });

    await expect(
      service.updateAssignment('a-1', { dueAt: '2026-12-01T22:59:00.000Z' }),
    ).resolves.toMatchObject({ dueAt: '2026-12-01T22:59:00.000Z' });
    expect(server.requests[0].body).toEqual({ due_at: '2026-12-01T22:59:00.000Z' });
  });

  it('unassigns an exercise, or says it cannot when the RLS keeps it', async () => {
    server.on('DELETE', '/rest/v1/exercise_assignment', { body: [{ id: 'a-1' }] });
    await service.unassign('a-1');
    expect(server.requests[0].params.get('id')).toBe('eq.a-1');

    server.on('DELETE', '/rest/v1/exercise_assignment', { body: [] });
    await expect(service.unassign('a-1')).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('reorders the exercises of a block', async () => {
    server.on('POST', '/rest/v1/rpc/reorder_assignments', { status: 204 });

    await service.reorderAssignments('block-1', ['a-2', 'a-1']);

    expect(server.requests[0].body).toEqual({
      target_block_id: 'block-1',
      assignment_ids: ['a-2', 'a-1'],
    });
  });

  it('moves an exercise to a place of another block', async () => {
    server.on('POST', '/rest/v1/rpc/move_assignment', {
      body: assignmentRow({ block_id: 'block-2', position: 2 }),
    });

    await expect(service.moveAssignment('a-1', 'block-2', 2)).resolves.toMatchObject({
      blockId: 'block-2',
      position: 2,
    });
    expect(server.requests[0].body).toEqual({
      target_assignment_id: 'a-1',
      target_block_id: 'block-2',
      target_position: 2,
    });
  });

  it('rejects moving an exercise to a block that has it', async () => {
    server.on('POST', '/rest/v1/rpc/move_assignment', {
      status: 409,
      body: { code: '23505', message: 'duplicate key value' },
    });

    await expect(service.moveAssignment('a-1', 'block-2', 1)).rejects.toMatchObject({
      kind: 'invalid',
    });
  });
});
