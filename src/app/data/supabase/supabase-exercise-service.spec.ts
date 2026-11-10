import { TestBed } from '@angular/core/testing';

import { SupabaseExerciseService } from './supabase-exercise-service';
import { exerciseRow, FakeSupabaseServer, provideFakeSupabase, testRow } from './supabase-testing';

const SUM = exerciseRow({ id: 'sum' });
const VOWELS = exerciseRow({
  id: 'vowels',
  title: 'Contar vocales',
  function_name: 'contarVocales',
});

describe('SupabaseExerciseService', () => {
  let server: FakeSupabaseServer;
  let service: SupabaseExerciseService;

  beforeEach(() => {
    server = new FakeSupabaseServer();
    TestBed.configureTestingModule({
      providers: [SupabaseExerciseService, provideFakeSupabase(server)],
    });
    service = TestBed.inject(SupabaseExerciseService);
  });

  describe('listAssigned', () => {
    beforeEach(() => {
      server
        .on('GET', '/rest/v1/exercise_assignment', {
          body: [
            { id: 'a-1', session: 1, exercise: SUM, class_session: { title: 'Bucles' } },
            { id: 'a-2', session: 2, exercise: VOWELS, class_session: { title: null } },
          ],
        })
        .on('GET', '/rest/v1/attempt', {
          body: [
            {
              exercise_id: 'sum',
              status: 'passed',
              updated_at: '2026-10-01 09:30:00+00',
              tutor_interaction: [
                { trigger: 'hint', hint_level: 1 },
                { trigger: 'question', hint_level: 3 },
                { trigger: 'hint', hint_level: 2 },
              ],
            },
          ],
        });
    });

    it('asks for the assignments of the student and their attempts, in two requests', async () => {
      await service.listAssigned('lucia');

      const [assignments] = server.sentTo('GET', '/rest/v1/exercise_assignment');
      expect(assignments.params.get('class_group.enrollment.user_id')).toBe('eq.lucia');
      expect(assignments.params.get('order')).toBe('session.asc,id.asc');
      const [attempts] = server.sentTo('GET', '/rest/v1/attempt');
      expect(attempts.params.get('user_id')).toBe('eq.lucia');
      expect(server.requests).toHaveLength(2);
    });

    it('builds each card with its session, its latest attempt and its hints', async () => {
      const [sum, vowels] = await service.listAssigned('lucia');

      expect(sum).toEqual({
        exercise: expect.objectContaining({ id: 'sum', functionName: 'sumar' }),
        assignmentId: 'a-1',
        session: 1,
        sessionTitle: 'Bucles',
        updatedAt: '2026-10-01T09:30:00.000Z',
        status: 'passed',
        hintCount: 2,
        hintLevel: 3,
      });
      expect(vowels).toMatchObject({
        sessionTitle: null,
        updatedAt: null,
        status: 'not_started',
        hintCount: 0,
        hintLevel: null,
      });
    });

    it('fails with the error of either request', async () => {
      server.on('GET', '/rest/v1/attempt', { status: 401, body: { message: 'JWT expired' } });

      await expect(service.listAssigned('lucia')).rejects.toMatchObject({ kind: 'unauthorized' });
    });
  });

  describe('getDetail', () => {
    it('returns the exercise, its visible tests in order and how many are hidden', async () => {
      server
        .on('GET', '/rest/v1/exercise', { body: SUM })
        .on('GET', '/rest/v1/test', { body: [testRow({ id: 't-1' }), testRow({ id: 't-2' })] })
        .on('POST', '/rest/v1/rpc/hidden_test_count', { body: 3 });

      const detail = await service.getDetail('sum');

      expect(detail.exercise.id).toBe('sum');
      expect(detail.visibleTests.map((test) => test.id)).toEqual(['t-1', 't-2']);
      expect(detail.visibleTests[0]).toEqual({
        id: 't-1',
        exerciseId: 'exercise-1',
        input: [[1, 2, 3]],
        expectedOutput: 6,
        isHidden: false,
        position: 1,
      });
      expect(detail.hiddenTestCount).toBe(3);
      const [tests] = server.sentTo('GET', '/rest/v1/test');
      expect(tests.params.get('is_hidden')).toBe('eq.false');
      expect(tests.params.get('order')).toBe('position.asc');
      const [count] = server.sentTo('POST', '/rest/v1/rpc/hidden_test_count');
      expect(count.body).toEqual({ target_exercise_id: 'sum' });
    });

    it('is not found when the RLS hides the exercise', async () => {
      server
        .on('GET', '/rest/v1/exercise', {
          status: 406,
          body: { code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object' },
        })
        .on('GET', '/rest/v1/test', { body: [] })
        .on('POST', '/rest/v1/rpc/hidden_test_count', {
          status: 400,
          body: { code: 'P0002', message: 'Exercise not found' },
        });

      await expect(service.getDetail('sum')).rejects.toMatchObject({ kind: 'not_found' });
    });
  });

  it('lists the exercise bank by date', async () => {
    server.on('GET', '/rest/v1/exercise', { body: [SUM, VOWELS] });

    const exercises = await service.list();

    expect(exercises.map((exercise) => exercise.id)).toEqual(['sum', 'vowels']);
    expect(server.requests[0].params.get('order')).toBe('created_at.asc');
  });

  it('returns an exercise with all its tests in order', async () => {
    server.on('GET', '/rest/v1/exercise', {
      body: { ...SUM, test: [testRow({ id: 't-1' }), testRow({ id: 't-2', is_hidden: true })] },
    });

    const { exercise, tests } = await service.getWithTests('sum');

    expect(exercise).toEqual(expect.objectContaining({ id: 'sum' }));
    expect(exercise).not.toHaveProperty('test');
    expect(tests.map((test) => test.isHidden)).toEqual([false, true]);
    expect(server.requests[0].params.get('test.order')).toBe('position.asc');
  });

  it.each(['create', 'update'] as const)(
    'leaves %s for the teacher screen of step 4.3',
    async (method) => {
      await expect(service[method]()).rejects.toMatchObject({ kind: 'unavailable' });
    },
  );

  describe('remove', () => {
    it('deletes the exercise', async () => {
      server.on('DELETE', '/rest/v1/exercise', { body: [{ id: 'sum' }] });

      await service.remove('sum');

      expect(server.requests[0].params.get('id')).toBe('eq.sum');
    });

    it('is not found when nothing was deleted', async () => {
      server.on('DELETE', '/rest/v1/exercise', { body: [] });

      await expect(service.remove('sum')).rejects.toMatchObject({ kind: 'not_found' });
    });

    it('is invalid when the exercise has attempts', async () => {
      server.on('DELETE', '/rest/v1/exercise', {
        status: 409,
        body: { code: '23503', message: 'violates foreign key constraint' },
      });

      await expect(service.remove('sum')).rejects.toMatchObject({ kind: 'invalid' });
    });
  });

  describe('assignments', () => {
    const ROW = { id: 'a-1', group_id: 'daw', exercise_id: 'sum', session: 2 };
    const ASSIGNMENT = { id: 'a-1', groupId: 'daw', exerciseId: 'sum', session: 2 };

    it('lists those of a group by session', async () => {
      server.on('GET', '/rest/v1/exercise_assignment', { body: [ROW] });

      await expect(service.listAssignments('daw')).resolves.toEqual([ASSIGNMENT]);
      expect(server.requests[0].params.get('group_id')).toBe('eq.daw');
    });

    it('assigns an exercise to a session', async () => {
      server.on('POST', '/rest/v1/exercise_assignment', { status: 201, body: ROW });

      await expect(
        service.assign({ groupId: 'daw', exerciseId: 'sum', session: 2 }),
      ).resolves.toEqual(ASSIGNMENT);
      expect(server.requests[0].body).toEqual({ group_id: 'daw', exercise_id: 'sum', session: 2 });
    });

    it('rejects assigning the same exercise twice to a session', async () => {
      server.on('POST', '/rest/v1/exercise_assignment', {
        status: 409,
        body: { code: '23505', message: 'duplicate key value' },
      });

      await expect(
        service.assign({ groupId: 'daw', exerciseId: 'sum', session: 2 }),
      ).rejects.toMatchObject({ kind: 'invalid' });
    });

    it('unassigns an exercise', async () => {
      server.on('DELETE', '/rest/v1/exercise_assignment', { body: [{ id: 'a-1' }] });

      await service.unassign('a-1');

      expect(server.requests[0].params.get('id')).toBe('eq.a-1');
    });

    it('is not found when unassigning an assignment the user cannot see', async () => {
      server.on('DELETE', '/rest/v1/exercise_assignment', { body: [] });

      await expect(service.unassign('a-1')).rejects.toMatchObject({ kind: 'not_found' });
    });
  });
});
