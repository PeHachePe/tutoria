import { TestBed } from '@angular/core/testing';

import type { ExerciseDraft } from '../exercise-service';
import {
  assignmentId,
  blockAssignmentId,
  DAW_EXAM_BLOCK,
  DAW_HIDDEN_BLOCK,
  DAW_RESIT_BLOCK,
  DAW_WEB_FIRST_BLOCK,
  exerciseId,
  testId,
} from './fixtures/exercises';
import { fixtureId } from './fixtures/fixture-id';
import { SEED } from './fixtures/seed';
import { ADVANCED_PROGRAMMING_ID, BASIC_PROGRAMMING_ID, WEB_CLIENT_ID } from './fixtures/subjects';
import {
  ADMIN_ID,
  DAM_GROUP_ID,
  DAM_STUDENT_IDS,
  DAW_GROUP_ID,
  DAW_STUDENT_IDS,
  DAW_WEB_GROUP_ID,
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
  parameters: ['numbers'],
  maxRepeatedFailures: 2,
  maxIdleMinutes: 5,
  subjectIds: [BASIC_PROGRAMMING_ID],
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
    it("lists the student's visible exercises of every group, with the attempt that counts", async () => {
      db.setSession(DAW_STUDENT_IDS[1]); // Hugo

      const entries = await service.listAssigned(DAW_STUDENT_IDS[1]);

      const visible = SEED.assignments
        .filter((a) => [DAW_GROUP_ID, DAW_WEB_GROUP_ID].includes(a.groupId) && !a.isHidden)
        .filter((a) => a.blockId !== fixtureId('block', DAW_HIDDEN_BLOCK))
        .filter((a) => a.blockId !== fixtureId('block', DAW_EXAM_BLOCK)) // Not open yet
        .map((a) => a.id)
        .sort();
      // By group, block and place: compared without the order here
      expect(entries.map((entry) => entry.assignmentId).sort()).toEqual(visible);
      expect(entries.slice(0, 8).map((entry) => entry.assignmentId)).toEqual(
        [1, 2, 3, 4, 5, 6, 7, 8].map((n) => assignmentId(DAW_GROUP_ID, n)),
      );
      const statusOf = (id: string) => entries.find((entry) => entry.assignmentId === id)?.status;
      expect(
        [
          ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => assignmentId(DAW_GROUP_ID, n)),
          blockAssignmentId(DAW_RESIT_BLOCK, 3),
          blockAssignmentId(DAW_RESIT_BLOCK, 4),
          blockAssignmentId(DAW_WEB_FIRST_BLOCK, 9),
          blockAssignmentId(DAW_WEB_FIRST_BLOCK + 1, 10),
        ].map(statusOf),
      ).toEqual([
        'submitted',
        'submitted',
        'submitted',
        'tests_failed',
        'tests_failed',
        'in_progress',
        'not_started',
        'not_started',
        'not_started',
        'tests_failed',
        'not_started',
        'not_started',
      ]);
      expect(entries[0]).toMatchObject({
        exercise: SEED.exercises[0],
        group: { id: DAW_GROUP_ID, name: '1.º DAW A', subject: SEED.subjects[0] },
        block: { id: fixtureId('block', 1), title: 'Tema 1: Bucles y condicionales' },
        practice: null,
        repetitions: 0,
      });
      expect(entries.find((entry) => entry.group.id === DAW_WEB_GROUP_ID)?.group).toEqual({
        id: DAW_WEB_GROUP_ID,
        name: '1.º DAW A',
        subject: SEED.subjects[2],
      });
    });

    it('keeps the first submitted attempt as the one that counts and the practice apart', async () => {
      db.setSession(DAW_STUDENT_IDS[0]); // Lucía, who repeated the first exercise
      const first = SEED.attempts.find(
        (a) => a.userId === DAW_STUDENT_IDS[0] && a.exerciseId === exerciseId(1) && a.number === 1,
      );

      const [entry] = await service.listAssigned(DAW_STUDENT_IDS[0]);

      expect(entry).toMatchObject({
        status: 'submitted',
        updatedAt: first?.updatedAt,
        practice: { number: 2, status: 'submitted' },
        repetitions: 1,
      });
    });

    it('leaves out what the teacher hides, but not for the teacher', async () => {
      const hidden = [
        blockAssignmentId(DAW_RESIT_BLOCK, 2),
        ...SEED.assignments
          .filter((a) => a.blockId === fixtureId('block', DAW_HIDDEN_BLOCK))
          .map((a) => a.id),
      ];
      db.setSession(DAW_STUDENT_IDS[0]);
      const seen = (await service.listAssigned(DAW_STUDENT_IDS[0])).map((e) => e.assignmentId);

      db.setSession(TEACHER_ID);
      const all = (await service.listAssigned(DAW_STUDENT_IDS[0])).map((e) => e.assignmentId);

      expect(hidden).toHaveLength(3);
      expect(seen.some((id) => hidden.includes(id))).toBe(false);
      expect(all.filter((id) => hidden.includes(id))).toHaveLength(3);
    });

    it('leaves out a block until it opens, but not for the teacher', async () => {
      const block = fixtureId('block', DAW_RESIT_BLOCK);
      const inBlock = SEED.assignments.filter((a) => a.blockId === block).map((a) => a.id);
      const opensAt = (offset: number) => new Date(Date.now() + offset).toISOString();
      const schedule = (offset: number) =>
        db.update('classBlocks', (rows) =>
          rows.map((row) => (row.id === block ? { ...row, opensAt: opensAt(offset) } : row)),
        );
      const seenBy = async (userId: string) => {
        db.setSession(userId);
        const assigned = await service.listAssigned(DAW_STUDENT_IDS[0]);
        return assigned.filter((entry) => inBlock.includes(entry.assignmentId));
      };

      schedule(60_000);
      expect(await seenBy(DAW_STUDENT_IDS[0])).toHaveLength(0);
      expect(await seenBy(TEACHER_ID)).toHaveLength(inBlock.length);

      schedule(-60_000);
      expect((await seenBy(DAW_STUDENT_IDS[0])).length).toBeGreaterThan(0);
    });

    it('counts the hints asked in the attempt that counts and the highest level reached', async () => {
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

      // Elena: the 15 exercises of basic programming and the 15 of advanced programming
      await expect(service.listAssigned(DAM_STUDENT_IDS[0])).resolves.toHaveLength(30);
    });

    it('requires a session', async () => {
      await expect(service.listAssigned(DAW_STUDENT_IDS[0])).rejects.toMatchObject({
        kind: 'unauthorized',
      });
    });
  });

  describe('getDetail', () => {
    it('returns the exercise of the assignment, where it is, its visible tests and the hidden count', async () => {
      db.setSession(DAW_STUDENT_IDS[0]);
      db.update('tests', (tests) => [...tests].reverse());

      const detail = await service.getDetail(blockAssignmentId(DAW_RESIT_BLOCK, 3));

      expect(detail).toMatchObject({
        exercise: { functionName: 'sum' },
        assignmentId: blockAssignmentId(DAW_RESIT_BLOCK, 3),
        group: { id: DAW_GROUP_ID, subject: SEED.subjects[0] },
        block: { title: 'Recuperación del tema 2' },
        hiddenTestCount: 2,
      });
      expect(detail.visibleTests.map((test) => test.id)).toEqual(
        [0, 1, 2, 3].map((p) => testId(3, p)),
      );
    });

    it('hides from a student the assignments of other groups and the hidden ones', async () => {
      db.setSession(DAM_STUDENT_IDS[0]);
      await expect(service.getDetail(assignmentId(DAW_GROUP_ID, 8))).rejects.toMatchObject({
        kind: 'not_found',
      });

      db.setSession(DAW_STUDENT_IDS[0]);
      await expect(service.getDetail(blockAssignmentId(DAW_RESIT_BLOCK, 2))).rejects.toMatchObject({
        kind: 'not_found',
      });
    });

    it('shows the teacher of the group the hidden ones too, not another teacher', async () => {
      db.setSession(TEACHER_ID);
      await expect(service.getDetail(blockAssignmentId(DAW_RESIT_BLOCK, 2))).resolves.toBeTruthy();

      db.setSession(OTHER_TEACHER_ID);
      await expect(service.getDetail(assignmentId(DAW_GROUP_ID, 8))).rejects.toMatchObject({
        kind: 'not_found',
      });
    });

    it('fails for an unknown assignment', async () => {
      db.setSession(TEACHER_ID);

      await expect(service.getDetail('missing')).rejects.toMatchObject({ kind: 'not_found' });
    });
  });

  describe("the teacher's bank", () => {
    beforeEach(() => db.setSession(TEACHER_ID));

    /** The students with an attempt at exercise `n`, in any group. */
    function studentsOf(n: number): number {
      return new Set(
        SEED.attempts.filter((a) => a.exerciseId === exerciseId(n)).map((a) => a.userId),
      ).size;
    }

    /** The exercises of the seed meant for any of the subjects. */
    function exercisesOf(...subjectIds: string[]) {
      return SEED.exercises.filter((exercise) =>
        SEED.exerciseSubjects.some(
          (row) => row.exerciseId === exercise.id && subjectIds.includes(row.subjectId),
        ),
      );
    }

    it("brings by default the exercises of the teacher's subjects, with their tests and use", async () => {
      const bank = await service.listBank({ kind: 'mine' });

      expect(bank.subjects).toEqual(SEED.subjects);
      // Marta teaches basic programming and web development: not advanced programming
      expect(bank.mySubjectIds).toEqual([BASIC_PROGRAMMING_ID, WEB_CLIENT_ID]);
      expect(bank.exercises.map((entry) => entry.exercise)).toEqual(
        exercisesOf(BASIC_PROGRAMMING_ID, WEB_CLIENT_ID),
      );
      expect(bank.exercises.length).toBeLessThan(SEED.exercises.length);
      expect(bank.exercises[0]).toEqual({
        exercise: SEED.exercises[0],
        subjectIds: [BASIC_PROGRAMMING_ID],
        testCount: 5,
        studentCount: studentsOf(1),
        // Only the groups of the teacher: the other teacher's DAM B is not hers
        groups: [{ id: DAW_GROUP_ID, name: '1.º DAW A' }],
      });
      expect(studentsOf(1)).toBeGreaterThan(0);
    });

    it('brings a subject, or every exercise', async () => {
      const advanced = await service.listBank({
        kind: 'subject',
        subjectId: ADVANCED_PROGRAMMING_ID,
      });
      expect(advanced.exercises.map((entry) => entry.exercise)).toEqual(
        exercisesOf(ADVANCED_PROGRAMMING_ID),
      );
      // Its other subjects come too, for its chips
      expect(advanced.exercises[0].subjectIds).toContain(BASIC_PROGRAMMING_ID);

      const all = await service.listBank({ kind: 'all' });
      expect(all.exercises.map((entry) => entry.exercise)).toEqual(SEED.exercises);
    });

    it('brings every exercise as «mine» to a user who teaches no group', async () => {
      db.setSession(ADMIN_ID);

      const bank = await service.listBank({ kind: 'mine' });

      expect(bank.mySubjectIds).toEqual([]);
      expect(bank.exercises).toHaveLength(SEED.exercises.length);
    });

    it('lists the subjects', async () => {
      await expect(service.listSubjects()).resolves.toEqual(SEED.subjects);
    });

    it('lists the newest exercises first', async () => {
      const exercise = await service.create(DRAFT);

      const bank = await service.listBank({ kind: 'mine' });

      expect(bank.exercises[0].exercise).toEqual(exercise);
      expect(bank.exercises[0]).toMatchObject({ testCount: 2, studentCount: 0, groups: [] });
    });

    it('shows the administrator every group where an exercise is assigned', async () => {
      db.setSession(ADMIN_ID);

      const bank = await service.listBank({ kind: 'all' });

      expect(bank.exercises[0].groups).toEqual([
        { id: DAM_GROUP_ID, name: '1.º DAM B' },
        { id: DAW_GROUP_ID, name: '1.º DAW A' },
      ]);
    });

    it('gets an exercise with all its tests, hidden ones included, its subjects and use', async () => {
      const entry = await service.getWithTests(exerciseId(1));

      expect(entry.exercise).toEqual(SEED.exercises[0]);
      expect(entry.tests.map((test) => test.isHidden)).toEqual([false, false, false, true, true]);
      expect(entry.subjectIds).toEqual([BASIC_PROGRAMMING_ID]);
      expect(entry.studentCount).toBe(studentsOf(1));
      expect(entry.groups).toEqual([{ id: DAW_GROUP_ID, name: '1.º DAW A' }]);
    });

    it('is not available to students', async () => {
      db.setSession(DAW_STUDENT_IDS[0]);

      await expect(service.listBank({ kind: 'mine' })).rejects.toMatchObject({ kind: 'forbidden' });
      await expect(service.listSubjects()).rejects.toMatchObject({ kind: 'forbidden' });
      await expect(service.getWithTests(exerciseId(1))).rejects.toMatchObject({
        kind: 'forbidden',
      });
      await expect(service.create(DRAFT)).rejects.toMatchObject({ kind: 'forbidden' });
    });

    it('creates an exercise with its tests and subjects', async () => {
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
        parameters: ['numbers'],
        maxRepeatedFailures: 2,
        maxIdleMinutes: 5,
        createdBy: TEACHER_ID,
        createdAt: NOW,
        updatedAt: NOW,
        archivedAt: null,
      });
      const { tests, subjectIds } = await service.getWithTests(exercise.id);
      expect(tests).toEqual(
        DRAFT.tests.map((test) => ({ ...test, id: expect.any(String), exerciseId: exercise.id })),
      );
      expect(subjectIds).toEqual([BASIC_PROGRAMMING_ID]);
    });

    it('rejects names that are not identifiers, as the checks of the table do', async () => {
      for (const draft of [
        { ...DRAFT, functionName: 'año' },
        { ...DRAFT, parameters: ['first number'] },
        { ...DRAFT, parameters: ['a', 'a'] },
      ]) {
        await expect(service.create(draft)).rejects.toMatchObject({ kind: 'invalid' });
      }
      expect(db.tables().exercises).toHaveLength(SEED.exercises.length);
    });

    it('updates an exercise and replaces its tests and subjects', async () => {
      const draft = {
        ...DRAFT,
        tests: [DRAFT.tests[0]],
        subjectIds: [BASIC_PROGRAMMING_ID, ADVANCED_PROGRAMMING_ID],
      };

      const exercise = await service.update(exerciseId(1), draft);

      expect(exercise).toMatchObject({
        id: exerciseId(1),
        title: DRAFT.title,
        parameters: ['numbers'],
        createdBy: TEACHER_ID,
        createdAt: SEED.exercises[0].createdAt,
        updatedAt: NOW,
      });
      const { tests, subjectIds } = await service.getWithTests(exerciseId(1));
      expect(tests).toEqual([
        { ...DRAFT.tests[0], id: expect.any(String), exerciseId: exerciseId(1) },
      ]);
      expect(subjectIds).toEqual([BASIC_PROGRAMMING_ID, ADVANCED_PROGRAMMING_ID]);
      expect(db.tables().exercises).toHaveLength(SEED.exercises.length);
    });

    it("does not let a teacher change or delete another teacher's exercise", async () => {
      const others = SEED.exercises.find((exercise) => exercise.createdBy === OTHER_TEACHER_ID);
      expect(others).toBeDefined();
      const id = others?.id ?? '';

      await expect(service.update(id, DRAFT)).rejects.toMatchObject({ kind: 'forbidden' });
      await expect(service.remove(id)).rejects.toMatchObject({ kind: 'forbidden' });
    });

    it('lets the administrator change any exercise', async () => {
      db.setSession(ADMIN_ID);

      await expect(service.update(exerciseId(1), DRAFT)).resolves.toMatchObject({
        createdBy: TEACHER_ID,
      });
    });

    it('removes an exercise nobody has attempted, with its tests, subjects and assignments', async () => {
      // Exercise 20, of web development, is only in the groups of its author
      const id = exerciseId(20);
      db.update('attempts', (rows) => rows.filter((a) => a.exerciseId !== id));
      expect(db.tables().assignments.some((a) => a.exerciseId === id)).toBe(true);

      await service.remove(id);

      const tables = db.tables();
      expect(tables.exercises.some((e) => e.id === id)).toBe(false);
      expect(tables.tests.some((t) => t.exerciseId === id)).toBe(false);
      expect(tables.exerciseSubjects.some((t) => t.exerciseId === id)).toBe(false);
      expect(tables.assignments.some((a) => a.exerciseId === id)).toBe(false);
    });

    it('does not remove an exercise assigned in the groups of another teacher', async () => {
      // Exercise 8, of basic programming, is also in 1.º DAM B, of the other teacher
      const id = exerciseId(8);
      db.update('attempts', (rows) => rows.filter((a) => a.exerciseId !== id));
      expect(
        db.tables().assignments.some((a) => a.exerciseId === id && a.groupId === DAM_GROUP_ID),
      ).toBe(true);

      await expect(service.remove(id)).rejects.toMatchObject({ kind: 'invalid' });
      db.setSession(ADMIN_ID);
      await expect(service.remove(id)).resolves.toBeUndefined();
    });

    it('does not remove an exercise with attempts, to keep their history', async () => {
      await expect(service.remove(exerciseId(1))).rejects.toMatchObject({ kind: 'invalid' });
      expect(db.tables().exercises).toHaveLength(SEED.exercises.length);
    });

    it('archives an exercise with attempts and brings it back, keeping its assignments', async () => {
      const archived = await service.setArchived(exerciseId(1), true);

      expect(archived.archivedAt).toEqual(expect.any(String));
      const bank = await service.listBank({ kind: 'all' });
      expect(bank.exercises.find((e) => e.exercise.id === exerciseId(1))?.exercise).toEqual(
        archived,
      );
      expect(db.tables().assignments.some((a) => a.exerciseId === exerciseId(1))).toBe(true);
      await expect(service.setArchived(exerciseId(1), false)).resolves.toMatchObject({
        archivedAt: null,
      });
    });

    it('archives only the exercises the user may edit', async () => {
      db.setSession(OTHER_TEACHER_ID);

      await expect(service.setArchived(exerciseId(1), true)).rejects.toMatchObject({
        kind: 'forbidden',
      });
      await expect(service.setArchived('missing', true)).rejects.toMatchObject({
        kind: 'not_found',
      });
    });

    it('fails to update or remove an unknown exercise', async () => {
      await expect(service.update('missing', DRAFT)).rejects.toMatchObject({ kind: 'not_found' });
      await expect(service.remove('missing')).rejects.toMatchObject({ kind: 'not_found' });
    });
  });

  describe('translate', () => {
    function request(from: 'es' | 'en' | 'ca', to: 'es' | 'en' | 'ca') {
      const exercise = db.tables().exercises.find((row) => row.id === exerciseId(3));
      if (!exercise) throw new Error('No exercise 3');
      const { title, statement, topics } = exercise;
      const texts =
        from === exercise.sourceLocale ? { title, statement, topics } : exercise.translations[from];
      if (!texts) throw new Error(`No ${from} texts`);
      return {
        exercise,
        request: { from, to, texts, functionName: 'sum', parameters: ['values'] },
      };
    }

    it('gives the translation of an exercise with the same texts, from any of its languages', async () => {
      db.setSession(TEACHER_ID);
      const fromSource = request('es', 'en');
      await expect(service.translate(fromSource.request)).resolves.toEqual(
        fromSource.exercise.translations.en,
      );
      const between = request('en', 'ca');
      await expect(service.translate(between.request)).resolves.toEqual(
        between.exercise.translations.ca,
      );
    });

    it('without one, the original marked with the language', async () => {
      db.setSession(ADMIN_ID);
      const texts = { title: 'Nuevo', statement: 'Algo nuevo.', topics: ['Bucles'] };

      await expect(
        service.translate({ from: 'es', to: 'en', texts, functionName: 'f', parameters: [] }),
      ).resolves.toEqual({ ...texts, title: '[en] Nuevo' });
    });

    it('is only for the staff', async () => {
      db.setSession(DAW_STUDENT_IDS[0]);
      const texts = { title: 'Nuevo', statement: 'Algo nuevo.', topics: [] };

      await expect(
        service.translate({ from: 'es', to: 'en', texts, functionName: 'f', parameters: [] }),
      ).rejects.toMatchObject({ kind: 'forbidden' });
    });
  });
});
