import { TestBed } from '@angular/core/testing';

import type { ExerciseDraft } from '../exercise-service';
import { SupabaseExerciseService } from './supabase-exercise-service';
import { SUPABASE_CLIENT } from './supabase-client';
import {
  appUserRow,
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
  function_name: 'countVowels',
  parameters: ['text'],
});

const DRAFT: ExerciseDraft = {
  title: 'Producto',
  statement: 'Escribe `product(numbers)`.',
  difficulty: 'medium',
  topics: ['Vectores'],
  sourceLocale: 'es',
  translations: { en: { title: 'Product', statement: 'Write…', topics: ['Arrays'] } },
  functionName: 'product',
  parameters: ['numbers'],
  maxRepeatedFailures: 2,
  maxIdleMinutes: 5,
  subjectIds: ['subject-1'],
  tests: [{ input: [[2, 3]], expectedOutput: 6, isHidden: false, position: 0 }],
};

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
        exercise: expect.objectContaining({ id: 'sum', functionName: 'sum' }),
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

  describe('the bank', () => {
    const COUNTS = [
      { exercise_id: 'sum', student_count: 30 },
      { exercise_id: 'vowels', student_count: 0 },
    ];
    const DAW = { id: 'g-1', name: '1.º DAW A' };
    const DAM = { id: 'g-2', name: '1.º DAM B' };

    beforeEach(() => {
      server.on('POST', '/rest/v1/rpc/exercise_student_counts', { body: COUNTS });
    });

    it("brings the exercises of the teacher's subjects, newest first, with their tests, subjects, groups and students", async () => {
      server
        .acceptSignIn(appUserRow({ id: 'marta', email: 'marta@tutoria.test', role: 'teacher' }))
        .on('GET', '/rest/v1/class_group', {
          body: [{ subject_id: 'subject-1' }, { subject_id: 'subject-1' }],
        })
        .on('GET', '/rest/v1/exercise', {
          body: [
            {
              ...SUM,
              test: [{ count: 5 }],
              subjects: [{ subject_id: 'subject-1' }, { subject_id: 'subject-2' }],
              scope: [{ subject_id: 'subject-1' }],
              exercise_assignment: [
                { class_group: DAW },
                { class_group: DAM },
                { class_group: DAW },
              ],
            },
            { ...VOWELS, test: [], subjects: [], scope: [], exercise_assignment: [] },
          ],
        })
        .on('GET', '/rest/v1/subject', { body: [subjectRow({ id: 'subject-1' })] });
      await TestBed.inject(SUPABASE_CLIENT).auth.signInWithPassword({
        email: 'marta@tutoria.test',
        password: 'test',
      });

      const bank = await service.listBank({ kind: 'mine' });

      expect(server.sentTo('GET', '/rest/v1/class_group')[0].params.get('teacher_id')).toBe(
        'eq.marta',
      );
      expect(bank.mySubjectIds).toEqual(['subject-1']);
      expect(bank.subjects.map((subject) => subject.id)).toEqual(['subject-1']);
      expect(bank.exercises[0]).toEqual({
        exercise: expect.objectContaining({ id: 'sum', parameters: ['numbers'] }),
        subjectIds: ['subject-1', 'subject-2'],
        testCount: 5,
        studentCount: 30,
        groups: [DAM, DAW],
      });
      expect(bank.exercises[1]).toMatchObject({ testCount: 0, studentCount: 0, groups: [] });
      expect(bank.exercises[0].exercise).not.toHaveProperty('test');
      expect(bank.exercises[0].exercise).not.toHaveProperty('scope');
      const request = server.sentTo('GET', '/rest/v1/exercise')[0];
      expect(request.params.get('order')).toBe('created_at.desc');
      expect(request.params.get('scope.subject_id')).toBe('in.(subject-1)');
    });

    it('brings one subject, or the whole bank without filtering it', async () => {
      server
        .on('GET', '/rest/v1/class_group', { body: [] })
        .on('GET', '/rest/v1/exercise', { body: [] })
        .on('GET', '/rest/v1/subject', { body: [] });

      await service.listBank({ kind: 'subject', subjectId: 'subject-2' });
      await service.listBank({ kind: 'all' });
      // Without groups of their own, «mine» is the whole bank too
      await service.listBank({ kind: 'mine' });

      const [one, all, mine] = server.sentTo('GET', '/rest/v1/exercise');
      expect(one.params.get('scope.subject_id')).toBe('in.(subject-2)');
      expect(one.params.get('select')).toContain('scope:exercise_subject!inner');
      expect(all.params.has('scope.subject_id')).toBe(false);
      expect(all.params.get('select')).not.toContain('scope:');
      expect(mine.params.has('scope.subject_id')).toBe(false);
    });

    it('lists the subjects by name', async () => {
      server.on('GET', '/rest/v1/subject', { body: [subjectRow({ id: 'subject-1' })] });

      const subjects = await service.listSubjects();

      expect(subjects.map((subject) => subject.id)).toEqual(['subject-1']);
      expect(server.requests[0].params.get('order')).toBe('name.asc');
    });

    it('counts no students for an exercise nobody started', async () => {
      server.on('POST', '/rest/v1/rpc/exercise_student_counts', { body: [] });
      server
        .on('GET', '/rest/v1/class_group', { body: [] })
        .on('GET', '/rest/v1/exercise', {
          body: [{ ...SUM, test: [], subjects: [], exercise_assignment: [] }],
        })
        .on('GET', '/rest/v1/subject', { body: [] });

      const bank = await service.listBank({ kind: 'all' });

      expect(bank.exercises[0].studentCount).toBe(0);
    });

    it('returns an exercise with all its tests in order, its subjects and its use', async () => {
      server.on('GET', '/rest/v1/exercise', {
        body: {
          ...SUM,
          test: [testRow({ id: 't-1' }), testRow({ id: 't-2', is_hidden: true })],
          exercise_subject: [{ subject_id: 'subject-1' }],
          exercise_assignment: [{ class_group: DAW }],
        },
      });

      const entry = await service.getWithTests('sum');

      expect(entry.exercise).toEqual(expect.objectContaining({ id: 'sum' }));
      expect(entry.exercise).not.toHaveProperty('test');
      expect(entry.tests.map((test) => test.isHidden)).toEqual([false, true]);
      expect(entry.subjectIds).toEqual(['subject-1']);
      expect(entry).toMatchObject({ studentCount: 30, groups: [DAW] });

      // An exercise nobody started is not among the counts
      server.on('POST', '/rest/v1/rpc/exercise_student_counts', { body: [] });
      expect((await service.getWithTests('sum')).studentCount).toBe(0);
      expect(server.sentTo('GET', '/rest/v1/exercise')[0].params.get('test.order')).toBe(
        'position.asc',
      );
    });
  });

  describe('saving', () => {
    beforeEach(() => {
      server.on('POST', '/rest/v1/rpc/save_exercise', { body: exerciseRow({ id: 'product' }) });
    });

    it('creates an exercise with its tests and subjects in one call', async () => {
      const exercise = await service.create(DRAFT);

      expect(exercise.id).toBe('product');
      expect(server.requests[0].body).toEqual({
        target_exercise_id: null,
        fields: {
          title: 'Producto',
          statement: 'Escribe `product(numbers)`.',
          difficulty: 'medium',
          topics: ['Vectores'],
          source_locale: 'es',
          translations: DRAFT.translations,
          function_name: 'product',
          parameters: ['numbers'],
          max_repeated_failures: 2,
          max_idle_minutes: 5,
        },
        tests: [{ input: [[2, 3]], expected_output: 6, is_hidden: false }],
        subject_ids: ['subject-1'],
      });
    });

    it('updates an exercise', async () => {
      await service.update('sum', DRAFT);

      expect(server.requests[0].body).toMatchObject({ target_exercise_id: 'sum' });
    });

    it("is forbidden for another teacher's exercise, which the RLS does not find", async () => {
      server.on('POST', '/rest/v1/rpc/save_exercise', {
        status: 400,
        body: { code: 'P0002', message: 'Exercise not found' },
      });

      await expect(service.update('other', DRAFT)).rejects.toMatchObject({ kind: 'not_found' });
    });
  });

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
