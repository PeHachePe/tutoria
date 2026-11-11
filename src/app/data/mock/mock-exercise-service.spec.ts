import { TestBed } from '@angular/core/testing';

import type { ExerciseDraft } from '../exercise-service';
import { assignmentId, exerciseId, testId } from './fixtures/exercises';
import { SEED } from './fixtures/seed';
import {
  ADMIN_ID,
  DAM_GROUP_ID,
  DAM_STUDENT_IDS,
  DAW_GROUP_ID,
  DAW_STUDENT_IDS,
  OTHER_TEACHER_ID,
  TEACHER_ID,
} from './fixtures/users';
import { MockDb } from './mock-db';
import { MockExerciseService } from './mock-exercise-service';
import { MockNetwork } from './mock-network';

const NOW = '2026-11-10T09:30:00.000Z';

const DRAFT: ExerciseDraft = {
  title: 'Producto de un vector',
  statement: 'Escribe una función `product`…',
  difficulty: 'medium',
  topics: ['Vectores', 'acumulador'],
  sourceLocale: 'es',
  translations: {
    en: {
      title: 'Product of an array',
      statement: 'Write a function `product`…',
      topics: ['Arrays', 'accumulator'],
    },
  },
  functionName: 'product',
  maxRepeatedFailures: 2,
  maxIdleMinutes: 5,
  tests: [
    { input: [[2, 3]], expectedOutput: 6, isHidden: false, position: 0 },
    { input: [[]], expectedOutput: 1, isHidden: true, position: 1 },
  ],
};

describe('MockExerciseService', () => {
  let service: MockExerciseService;
  let db: MockDb;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    TestBed.configureTestingModule({ providers: [MockExerciseService] });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    db = TestBed.inject(MockDb);
    service = TestBed.inject(MockExerciseService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  describe('listAssigned', () => {
    it("lists the student's exercises by session with the status of their attempt", async () => {
      db.setSession(DAW_STUDENT_IDS[1]); // Hugo

      const entries = await service.listAssigned(DAW_STUDENT_IDS[1]);

      expect(entries.map((entry) => entry.session)).toEqual([1, 1, 2, 2, 3, 4, 4, 4]);
      expect(entries.map((entry) => entry.status)).toEqual([
        'submitted',
        'submitted',
        'submitted',
        'tests_failed',
        'tests_failed',
        'in_progress',
        'not_started',
        'not_started',
      ]);
      expect(entries[0]).toMatchObject({
        exercise: SEED.exercises[0],
        assignmentId: assignmentId(DAW_GROUP_ID, 1),
        session: 1,
        status: 'submitted',
      });
    });

    it('adds the title of each session and when the latest attempt changed', async () => {
      db.setSession(DAW_STUDENT_IDS[1]); // Hugo
      const attemptOf = (n: number) =>
        SEED.attempts.find(
          (a) => a.userId === DAW_STUDENT_IDS[1] && a.exerciseId === exerciseId(n),
        );

      const entries = await service.listAssigned(DAW_STUDENT_IDS[1]);

      expect(entries.map((entry) => entry.sessionTitle)).toEqual([
        'Bucles y condicionales',
        'Bucles y condicionales',
        'Vectores',
        'Vectores',
        'Recorridos de vectores',
        'Cadenas y formato',
        'Cadenas y formato',
        'Cadenas y formato',
      ]);
      expect(entries[0].updatedAt).toBe(attemptOf(1)?.updatedAt);
      expect(entries[7].updatedAt).toBeNull();
    });

    it('leaves the title out of a session that has none', async () => {
      db.setSession(DAM_STUDENT_IDS[0]);

      const entries = await service.listAssigned(DAM_STUDENT_IDS[0]);

      expect(entries.map((entry) => entry.sessionTitle)).toEqual([
        'Primeros bucles',
        'Primeros bucles',
        null,
        null,
      ]);
    });

    it('counts the hints asked in the latest attempt and the highest level reached', async () => {
      db.setSession(DAW_STUDENT_IDS[1]); // Hugo
      const attempt = SEED.attempts.find(
        (a) => a.userId === DAW_STUDENT_IDS[1] && a.exerciseId === exerciseId(6),
      );
      const base = { ...SEED.interactions[0], attemptId: attempt?.id ?? '' };
      db.update('interactions', () => [
        { ...base, id: 'i1', trigger: 'hint', hintLevel: 1 },
        { ...base, id: 'i2', trigger: 'question', hintLevel: 2 },
        { ...base, id: 'i3', trigger: 'hint', hintLevel: 2 },
        { ...base, id: 'i4', attemptId: 'another-attempt', trigger: 'hint', hintLevel: 3 },
      ]);

      const entries = await service.listAssigned(DAW_STUDENT_IDS[1]);

      expect(entries[5]).toMatchObject({ hintCount: 2, hintLevel: 2 });
      expect(entries[0]).toMatchObject({ hintCount: 0, hintLevel: null });
      expect(entries[7]).toMatchObject({ hintCount: 0, hintLevel: null });
    });

    it("does not let a student list another student's exercises", async () => {
      db.setSession(DAW_STUDENT_IDS[0]);

      await expect(service.listAssigned(DAW_STUDENT_IDS[1])).rejects.toMatchObject({
        kind: 'forbidden',
      });
    });

    it("lets a teacher list a student's exercises", async () => {
      db.setSession(OTHER_TEACHER_ID);

      await expect(service.listAssigned(DAM_STUDENT_IDS[0])).resolves.toHaveLength(4);
    });

    it('requires a session', async () => {
      await expect(service.listAssigned(DAW_STUDENT_IDS[0])).rejects.toMatchObject({
        kind: 'unauthorized',
      });
    });
  });

  describe('getDetail', () => {
    it('returns the exercise with its visible tests in order and the number of hidden ones', async () => {
      db.setSession(DAW_STUDENT_IDS[0]);
      db.update('tests', (tests) => [...tests].reverse());

      const detail = await service.getDetail(exerciseId(3));

      expect(detail.exercise.functionName).toBe('sum');
      expect(detail.visibleTests.map((test) => test.id)).toEqual(
        [0, 1, 2, 3].map((p) => testId(3, p)),
      );
      expect(detail.hiddenTestCount).toBe(2);
    });

    it('hides from a student the exercises not assigned to their groups', async () => {
      db.setSession(DAM_STUDENT_IDS[0]);

      await expect(service.getDetail(exerciseId(8))).rejects.toMatchObject({ kind: 'not_found' });
    });

    it('shows teachers any exercise of the bank', async () => {
      db.setSession(OTHER_TEACHER_ID);

      await expect(service.getDetail(exerciseId(8))).resolves.toMatchObject({
        exercise: { id: exerciseId(8) },
      });
    });

    it('fails for an unknown exercise', async () => {
      db.setSession(TEACHER_ID);

      await expect(service.getDetail('missing')).rejects.toMatchObject({ kind: 'not_found' });
    });
  });

  describe("the teacher's bank", () => {
    beforeEach(() => db.setSession(TEACHER_ID));

    it('lists every exercise and one with all its tests, hidden ones included', async () => {
      await expect(service.list()).resolves.toEqual(SEED.exercises);

      const { exercise, tests } = await service.getWithTests(exerciseId(1));
      expect(exercise).toEqual(SEED.exercises[0]);
      expect(tests.map((test) => test.isHidden)).toEqual([false, false, false, true, true]);
    });

    it('is not available to students', async () => {
      db.setSession(DAW_STUDENT_IDS[0]);

      await expect(service.list()).rejects.toMatchObject({ kind: 'forbidden' });
      await expect(service.getWithTests(exerciseId(1))).rejects.toMatchObject({
        kind: 'forbidden',
      });
      await expect(service.create(DRAFT)).rejects.toMatchObject({ kind: 'forbidden' });
    });

    it('creates an exercise with its tests', async () => {
      const exercise = await service.create(DRAFT);

      expect(exercise).toEqual({
        id: expect.any(String),
        title: DRAFT.title,
        statement: DRAFT.statement,
        difficulty: 'medium',
        topics: ['Vectores', 'acumulador'],
        sourceLocale: 'es',
        translations: DRAFT.translations,
        language: 'javascript',
        functionName: 'product',
        maxRepeatedFailures: 2,
        maxIdleMinutes: 5,
        createdBy: TEACHER_ID,
        createdAt: NOW,
        updatedAt: NOW,
      });
      const { tests } = await service.getWithTests(exercise.id);
      expect(tests).toEqual(
        DRAFT.tests.map((test) => ({ ...test, id: expect.any(String), exerciseId: exercise.id })),
      );
    });

    it('updates an exercise and replaces its tests', async () => {
      const draft = { ...DRAFT, tests: [DRAFT.tests[0]] };

      const exercise = await service.update(exerciseId(1), draft);

      expect(exercise).toMatchObject({
        id: exerciseId(1),
        title: DRAFT.title,
        createdAt: SEED.exercises[0].createdAt,
        updatedAt: NOW,
      });
      const { tests } = await service.getWithTests(exerciseId(1));
      expect(tests).toEqual([
        { ...DRAFT.tests[0], id: expect.any(String), exerciseId: exerciseId(1) },
      ]);
      expect(db.tables().exercises).toHaveLength(8);
    });

    it('removes an exercise nobody has attempted, with its tests and assignments', async () => {
      db.update('attempts', (rows) => rows.filter((a) => a.exerciseId !== exerciseId(8)));

      await service.remove(exerciseId(8));

      const tables = db.tables();
      expect(tables.exercises.some((e) => e.id === exerciseId(8))).toBe(false);
      expect(tables.tests.some((t) => t.exerciseId === exerciseId(8))).toBe(false);
      expect(tables.assignments.some((a) => a.exerciseId === exerciseId(8))).toBe(false);
    });

    it('does not remove an exercise with attempts, to keep their history', async () => {
      await expect(service.remove(exerciseId(1))).rejects.toMatchObject({ kind: 'invalid' });
      expect(db.tables().exercises).toHaveLength(8);
    });

    it('fails to update or remove an unknown exercise', async () => {
      await expect(service.update('missing', DRAFT)).rejects.toMatchObject({ kind: 'not_found' });
      await expect(service.remove('missing')).rejects.toMatchObject({ kind: 'not_found' });
    });
  });

  describe('assignments', () => {
    it('lists the assignments of a group by session to its teacher and to the administrator', async () => {
      db.setSession(TEACHER_ID);
      const sessions = (await service.listAssignments(DAW_GROUP_ID)).map((a) => a.session);
      expect(sessions).toEqual([1, 1, 2, 2, 3, 4, 4, 4]);

      db.setSession(ADMIN_ID);
      await expect(service.listAssignments(DAM_GROUP_ID)).resolves.toHaveLength(4);
    });

    it("does not let a teacher manage another teacher's group", async () => {
      db.setSession(OTHER_TEACHER_ID);

      await expect(service.listAssignments(DAW_GROUP_ID)).rejects.toMatchObject({
        kind: 'forbidden',
      });
      await expect(
        service.assign({ groupId: DAW_GROUP_ID, exerciseId: exerciseId(1), session: 5 }),
      ).rejects.toMatchObject({ kind: 'forbidden' });
      await expect(service.unassign(assignmentId(DAW_GROUP_ID, 1))).rejects.toMatchObject({
        kind: 'forbidden',
      });
    });

    it('fails for an unknown group', async () => {
      db.setSession(ADMIN_ID);

      await expect(service.listAssignments('missing')).rejects.toMatchObject({ kind: 'not_found' });
    });

    it('assigns an exercise to a group in a session', async () => {
      db.setSession(OTHER_TEACHER_ID);
      const assignment = { groupId: DAM_GROUP_ID, exerciseId: exerciseId(5), session: 3 };

      const created = await service.assign(assignment);

      expect(created).toEqual({ id: expect.any(String), ...assignment });
      expect(await service.listAssignments(DAM_GROUP_ID)).toContainEqual(created);
    });

    it('rejects a repeated assignment or an unknown exercise', async () => {
      db.setSession(TEACHER_ID);

      await expect(
        service.assign({ groupId: DAW_GROUP_ID, exerciseId: exerciseId(1), session: 1 }),
      ).rejects.toMatchObject({ kind: 'invalid' });
      await expect(
        service.assign({ groupId: DAW_GROUP_ID, exerciseId: 'missing', session: 1 }),
      ).rejects.toMatchObject({ kind: 'not_found' });
    });

    it('unassigns, keeping the attempts without their assignment', async () => {
      db.setSession(TEACHER_ID);
      const id = assignmentId(DAW_GROUP_ID, 1);

      const linked = db.tables().attempts.filter((a) => a.assignmentId === id);

      await service.unassign(id);

      const { assignments, attempts } = db.tables();
      expect(linked.length).toBeGreaterThan(0);
      expect(assignments.some((a) => a.id === id)).toBe(false);
      expect(attempts).toHaveLength(SEED.attempts.length);
      expect(
        linked.every((a) => attempts.find((row) => row.id === a.id)?.assignmentId === null),
      ).toBe(true);
      expect(attempts.some((a) => a.assignmentId === assignmentId(DAM_GROUP_ID, 1))).toBe(true);
    });
  });
});
