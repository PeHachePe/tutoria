import { TestBed } from '@angular/core/testing';

import { SupabaseExerciseService } from './supabase-exercise-service';
import {
  blockRow,
  exerciseRow,
  FakeSupabaseServer,
  provideFakeSupabase,
  subjectRow,
  testRow,
} from './supabase-testing';

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
    const GROUP = { id: 'daw', name: '1.º DAW A', subject: subjectRow() };

    beforeEach(() => {
      server
        .on('GET', '/rest/v1/exercise_assignment', {
          body: [
            { id: 'a-1', exercise: SUM, class_block: blockRow(), class_group: GROUP },
            {
              id: 'a-2',
              exercise: VOWELS,
              class_block: blockRow({ id: 'block-2', position: 2, title: 'Repaso' }),
              class_group: GROUP,
            },
          ],
        })
        .on('GET', '/rest/v1/attempt', {
          body: [
            {
              assignment_id: 'a-1',
              number: 2,
              status: 'in_progress',
              updated_at: '2026-10-02 10:00:00+00',
              tutor_interaction: [],
            },
            {
              assignment_id: 'a-1',
              number: 1,
              status: 'submitted',
              updated_at: '2026-10-01 09:30:00+00',
              tutor_interaction: [
                { trigger: 'hint', hint_level: 1 },
                { trigger: 'question', hint_level: 3 },
                { trigger: 'hint', hint_level: 2 },
              ],
            },
            {
              assignment_id: null,
              number: 1,
              status: 'passed',
              updated_at: '2026-10-01 09:30:00+00',
              tutor_interaction: [],
            },
          ],
        });
    });

    it('asks for the assignments of the student and their attempts, in two requests', async () => {
      await service.listAssigned('lucia');

      const [assignments] = server.sentTo('GET', '/rest/v1/exercise_assignment');
      expect(assignments.params.get('class_group.enrollment.user_id')).toBe('eq.lucia');
      expect(assignments.params.get('order')).toBe('id.asc');
      const [attempts] = server.sentTo('GET', '/rest/v1/attempt');
      expect(attempts.params.get('user_id')).toBe('eq.lucia');
      expect(server.requests).toHaveLength(2);
    });

    it('builds each card with its group, block, the attempt that counts and the practice', async () => {
      const [sum, vowels] = await service.listAssigned('lucia');

      expect(sum).toEqual({
        exercise: expect.objectContaining({ id: 'sum', functionName: 'sumar' }),
        assignmentId: 'a-1',
        group: {
          id: 'daw',
          name: '1.º DAW A',
          subject: {
            id: 'subject-1',
            name: 'Programación básica',
            sourceLocale: 'es',
            translations: { en: { name: 'Basic programming' } },
          },
        },
        block: {
          id: 'block-1',
          groupId: 'daw',
          position: 1,
          title: 'Tema 1: Bucles',
          sourceLocale: 'es',
          translations: {},
          isHidden: false,
        },
        updatedAt: '2026-10-01T09:30:00.000Z',
        status: 'submitted',
        hintCount: 2,
        hintLevel: 3,
        practice: {
          number: 2,
          status: 'in_progress',
          updatedAt: '2026-10-02T10:00:00.000Z',
          hintCount: 0,
          hintLevel: null,
        },
        repetitions: 1,
      });
      expect(vowels).toMatchObject({
        block: { title: 'Repaso' },
        updatedAt: null,
        status: 'not_started',
        practice: null,
        repetitions: 0,
      });
    });

    it('fails with the error of either request', async () => {
      server.on('GET', '/rest/v1/attempt', { status: 401, body: { message: 'JWT expired' } });

      await expect(service.listAssigned('lucia')).rejects.toMatchObject({ kind: 'unauthorized' });
    });
  });

  describe('getDetail', () => {
    it('returns the exercise of the assignment, where it is, its visible tests and how many are hidden', async () => {
      server
        .on('GET', '/rest/v1/exercise_assignment', {
          body: {
            id: 'a-1',
            exercise: { ...SUM, test: [testRow({ id: 't-1' }), testRow({ id: 't-2' })] },
            class_block: blockRow(),
            class_group: { id: 'daw', name: '1.º DAW A', subject: subjectRow() },
          },
        })
        .on('POST', '/rest/v1/rpc/hidden_test_count', { body: 3 });

      const detail = await service.getDetail('a-1');

      expect(detail).toMatchObject({
        exercise: { id: 'sum' },
        assignmentId: 'a-1',
        group: { id: 'daw', subject: { name: 'Programación básica' } },
        block: { title: 'Tema 1: Bucles' },
        hiddenTestCount: 3,
      });
      expect(detail.exercise).not.toHaveProperty('test');
      expect(detail.visibleTests).toEqual([
        {
          id: 't-1',
          exerciseId: 'exercise-1',
          input: [[1, 2, 3]],
          expectedOutput: 6,
          isHidden: false,
          position: 1,
        },
        expect.objectContaining({ id: 't-2' }),
      ]);
      const [assignment] = server.sentTo('GET', '/rest/v1/exercise_assignment');
      expect(assignment.params.get('id')).toBe('eq.a-1');
      expect(assignment.params.get('exercise.test.is_hidden')).toBe('eq.false');
      expect(assignment.params.get('exercise.test.order')).toBe('position.asc');
      const [count] = server.sentTo('POST', '/rest/v1/rpc/hidden_test_count');
      expect(count.body).toEqual({ target_exercise_id: 'sum' });
    });

    it('is not found when the RLS hides the assignment', async () => {
      server.on('GET', '/rest/v1/exercise_assignment', {
        status: 406,
        body: { code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object' },
      });

      await expect(service.getDetail('a-1')).rejects.toMatchObject({ kind: 'not_found' });
      expect(server.sentTo('POST', '/rest/v1/rpc/hidden_test_count')).toHaveLength(0);
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
    const ROW = {
      id: 'a-1',
      group_id: 'daw',
      block_id: 'block-1',
      exercise_id: 'sum',
      is_hidden: false,
    };
    const ASSIGNMENT = {
      id: 'a-1',
      groupId: 'daw',
      blockId: 'block-1',
      exerciseId: 'sum',
      isHidden: false,
    };
    const NEW_ASSIGNMENT = {
      groupId: 'daw',
      blockId: 'block-1',
      exerciseId: 'sum',
      isHidden: false,
    };

    it('lists those of a group', async () => {
      server.on('GET', '/rest/v1/exercise_assignment', { body: [ROW] });

      await expect(service.listAssignments('daw')).resolves.toEqual([ASSIGNMENT]);
      expect(server.requests[0].params.get('group_id')).toBe('eq.daw');
    });

    it('assigns an exercise to a block', async () => {
      server.on('POST', '/rest/v1/exercise_assignment', { status: 201, body: ROW });

      await expect(service.assign(NEW_ASSIGNMENT)).resolves.toEqual(ASSIGNMENT);
      expect(server.requests[0].body).toEqual({
        group_id: 'daw',
        block_id: 'block-1',
        exercise_id: 'sum',
        is_hidden: false,
      });
    });

    it('rejects assigning the same exercise twice to a block', async () => {
      server.on('POST', '/rest/v1/exercise_assignment', {
        status: 409,
        body: { code: '23505', message: 'duplicate key value' },
      });

      await expect(service.assign(NEW_ASSIGNMENT)).rejects.toMatchObject({ kind: 'invalid' });
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
