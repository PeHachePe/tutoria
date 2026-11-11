import { isStuck } from '../../../shared/is-stuck';
import { SAMPLE_CODE } from './activity';
import { fixtureId } from './fixture-id';
import { SEED } from './seed';
import {
  DAM_GROUP_ID,
  DAM_STUDENT_IDS,
  DAW_GROUP_ID,
  DAW_STUDENT_IDS,
  DAM_ADVANCED_GROUP_ID,
  DAW_WEB_GROUP_ID,
  DISABLED_STUDENT_ID,
} from './users';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;

/** Runs the sample code of exercise `n` against one test, as the code runner will (2.5). */
function runSample(code: string, functionName: string, input: readonly unknown[]): unknown {
  const fn = new Function(`${code}\nreturn ${functionName};`)() as (...args: unknown[]) => unknown;
  return JSON.parse(JSON.stringify(fn(...input)) ?? 'null');
}

describe('seed fixtures', () => {
  it('builds valid fixture ids', () => {
    expect(fixtureId('user', 1)).toBe('10000000-0000-4000-8000-000000000001');
    expect(fixtureId('event', 123)).toBe('90000000-0000-4000-8000-000000000123');
  });

  it('gives every row a unique, valid UUID', () => {
    const tables = [
      SEED.users,
      SEED.subjects,
      SEED.groups,
      SEED.enrollments,
      SEED.classBlocks,
      SEED.exercises,
      SEED.tests,
      SEED.assignments,
      SEED.attempts,
      SEED.interactions,
      SEED.events,
    ];
    for (const rows of tables) {
      const ids = rows.map((row) => row.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every((id) => UUID.test(id))).toBe(true);
    }
  });

  it('has one admin, two teachers, four groups and a disabled student outside them', () => {
    const roles = SEED.users.map((user) => user.role);
    const emails = SEED.users.map((user) => user.email);

    expect(roles.filter((role) => role === 'admin')).toHaveLength(1);
    expect(roles.filter((role) => role === 'teacher')).toHaveLength(2);
    expect(new Set(emails).size).toBe(emails.length);
    expect(SEED.groups.map((group) => group.name)).toEqual([
      '1.º DAW A',
      '1.º DAM B',
      '1.º DAW A',
      '1.º DAM B',
    ]);
    expect(SEED.enrollments.filter((e) => e.groupId === DAW_GROUP_ID)).toHaveLength(24);
    expect(SEED.enrollments.filter((e) => e.groupId === DAW_WEB_GROUP_ID)).toHaveLength(24);
    expect(SEED.enrollments.filter((e) => e.groupId === DAM_ADVANCED_GROUP_ID)).toHaveLength(6);
    expect(SEED.enrollments.filter((e) => e.groupId === DAM_GROUP_ID)).toHaveLength(6);
    expect(SEED.users.find((user) => user.id === DISABLED_STUDENT_ID)?.status).toBe('disabled');
    expect(SEED.enrollments.some((e) => e.userId === DISABLED_STUDENT_ID)).toBe(false);
  });

  it('has three subjects, each group in one, and the exercises of the bank in theirs (2.5c)', () => {
    const subjectIds = new Set(SEED.subjects.map((subject) => subject.id));

    expect(SEED.subjects).toHaveLength(3);
    expect(SEED.groups.every((group) => subjectIds.has(group.subjectId))).toBe(true);
    expect(new Set(SEED.groups.map((group) => group.subjectId)).size).toBe(3);
    // Every exercise serves some subject, and some serve two
    expect(new Set(SEED.exerciseSubjects.map((row) => row.exerciseId))).toEqual(
      new Set(SEED.exercises.map((exercise) => exercise.id)),
    );
    expect(SEED.exerciseSubjects.length).toBeGreaterThan(SEED.exercises.length);
    // At least 15 per subject (2.5c)
    for (const subject of SEED.subjects) {
      const count = SEED.exerciseSubjects.filter((row) => row.subjectId === subject.id).length;
      expect(count, subject.name).toBeGreaterThanOrEqual(15);
    }
    // Each group has every exercise of its subject in some block
    for (const group of SEED.groups) {
      const assigned = new Set(
        SEED.assignments.filter((a) => a.groupId === group.id).map((a) => a.exerciseId),
      );
      const ofSubject = SEED.exerciseSubjects
        .filter((row) => row.subjectId === group.subjectId)
        .map((row) => row.exerciseId);
      expect(
        ofSubject.every((id) => assigned.has(id)),
        group.id,
      ).toBe(true);
    }
  });

  it('has 42 exercises with 3 or 4 visible tests and two hidden ones at the end', () => {
    expect(SEED.exercises).toHaveLength(42);
    for (const exercise of SEED.exercises) {
      const tests = SEED.tests.filter((test) => test.exerciseId === exercise.id);
      const hidden = tests.filter((test) => test.isHidden);

      expect(tests.length - hidden.length).toBeGreaterThanOrEqual(3);
      expect(tests.length - hidden.length).toBeLessThanOrEqual(4);
      expect(hidden).toEqual(tests.slice(-2));
      expect(tests.map((test) => test.position)).toEqual(tests.map((_, index) => index));
      expect(exercise.statement).toContain(`\`${exercise.functionName}\``);
    }
  });

  it('gives every exercise the contents of the table in 2.5', () => {
    expect(SEED.exercises.slice(0, 10).map((exercise) => exercise.topics)).toEqual([
      ['Bucles', 'rangos', 'condicionales'],
      ['Bucles', 'salida formateada'],
      ['Vectores', 'acumulador', 'vector vacío'],
      ['Vectores', 'comparación', 'casos límite'],
      ['Vectores', 'índices', 'intercambio'],
      ['Cadenas', 'recorrido y conteo'],
      ['Acumuladores', 'formato de salida'],
      ['Búsqueda secuencial', 'condición compuesta'],
      ['Cadenas', 'validación de formularios'],
      ['Objetos', 'URL'],
    ]);
  });

  it('has sample solutions that pass every test and mistakes that fail some', () => {
    SEED.exercises.forEach((exercise, index) => {
      const tests = SEED.tests.filter((test) => test.exerciseId === exercise.id);
      const { partial, solved } = SAMPLE_CODE[index + 1];

      for (const test of tests) {
        expect(runSample(solved, exercise.functionName, test.input), exercise.title).toEqual(
          test.expectedOutput,
        );
      }
      const failures = tests.filter(
        (test) =>
          JSON.stringify(runSample(partial, exercise.functionName, test.input)) !==
          JSON.stringify(test.expectedOutput),
      );
      expect(failures.length, exercise.title).toBeGreaterThan(0);
    });
  });

  it('numbers the blocks of each group from 1, every one with exercises of its own group', () => {
    for (const group of SEED.groups) {
      const positions = SEED.classBlocks
        .filter((block) => block.groupId === group.id)
        .map((block) => block.position)
        .sort((a, b) => a - b);
      expect(positions).toEqual(positions.map((_, index) => index + 1));
    }
    for (const block of SEED.classBlocks) {
      const assignments = SEED.assignments.filter((a) => a.blockId === block.id);
      expect(assignments.length, block.title).toBeGreaterThan(0);
      expect(assignments.every((a) => a.groupId === block.groupId)).toBe(true);
    }
  });

  it('repeats an exercise in a resit and hides a block and an assignment', () => {
    const blockOf = (assignmentId: string | null) =>
      SEED.classBlocks.find(
        (block) => block.id === SEED.assignments.find((a) => a.id === assignmentId)?.blockId,
      );
    const repeated = SEED.assignments.filter(
      (a) => a.groupId === DAW_GROUP_ID && a.exerciseId === SEED.exercises[3].id,
    );

    expect(repeated.map((a) => blockOf(a.id)?.title)).toEqual([
      'Tema 2: Vectores',
      'Recuperación del tema 2',
    ]);
    expect(SEED.classBlocks.filter((block) => block.isHidden)).toHaveLength(1);
    expect(SEED.assignments.filter((a) => a.isHidden)).toHaveLength(1);
  });

  it('numbers the attempts of each student at an assignment from 1, the next ones after a submitted one', () => {
    const keys = SEED.attempts.map((a) => `${a.userId}/${a.assignmentId}/${a.number}`);
    expect(new Set(keys).size).toBe(keys.length);

    for (const attempt of SEED.attempts.filter((a) => a.number > 1)) {
      const previous = SEED.attempts.find(
        (a) =>
          a.userId === attempt.userId &&
          a.assignmentId === attempt.assignmentId &&
          a.number === attempt.number - 1,
      );
      expect(previous?.status).toBe('submitted');
      expect(previous!.finishedAt! < attempt.startedAt).toBe(true);
    }
    expect(SEED.attempts.filter((a) => a.number > 1)).toHaveLength(2);
  });

  it('opens every attempt through a visible assignment of a group of the student', () => {
    for (const attempt of SEED.attempts) {
      const assignment = SEED.assignments.find((a) => a.id === attempt.assignmentId);
      const enrolled = SEED.enrollments.some(
        (e) => e.userId === attempt.userId && e.groupId === assignment?.groupId,
      );
      const block = SEED.classBlocks.find((b) => b.id === assignment?.blockId);
      expect(assignment?.exerciseId).toBe(attempt.exerciseId);
      expect(enrolled).toBe(true);
      expect(assignment?.isHidden || block?.isHidden).toBe(false);
    }
  });

  it('keeps every attempt consistent with its events (2.4)', () => {
    for (const attempt of SEED.attempts) {
      const events = SEED.events.filter((event) => event.attemptId === attempt.id);
      const runs = events.filter((event) => event.type === 'run');
      const lastRun = runs.at(-1);
      const submitIndex = events.findIndex((event) => event.type === 'submit');

      if (attempt.status === 'submitted') {
        const runBeforeSubmit = events
          .slice(0, submitIndex)
          .filter((e) => e.type === 'run')
          .at(-1);
        expect(runBeforeSubmit?.detail.failed).toBe(0);
        expect(attempt.finalCode).toBe(attempt.currentCode);
        expect(attempt.finishedAt).not.toBeNull();
      } else {
        expect(submitIndex).toBe(-1);
        expect(attempt.finalCode).toBeNull();
        expect(attempt.finishedAt).toBeNull();
      }
      if (attempt.status === 'passed') expect(lastRun?.detail.failed).toBe(0);
      if (attempt.status === 'tests_failed') expect(lastRun?.detail.failed).toBeGreaterThan(0);
      if (attempt.status === 'in_progress') expect(runs).toHaveLength(0);
      expect(attempt.startedAt <= attempt.updatedAt).toBe(true);
    }
  });

  it('links every event and interaction to an attempt, with hint levels from 1 to 3', () => {
    const attemptIds = new Set(SEED.attempts.map((attempt) => attempt.id));

    expect(SEED.events.every((event) => attemptIds.has(event.attemptId))).toBe(true);
    expect(SEED.interactions.every((i) => attemptIds.has(i.attemptId))).toBe(true);
    expect(new Set(SEED.interactions.map((i) => i.hintLevel))).toEqual(new Set([1, 2, 3]));
    expect(SEED.interactions.filter((i) => i.elusion)).toHaveLength(1);
  });

  it('leaves the web client subject of 1.º DAW A mostly not started', () => {
    const webAssignments = new Set(
      SEED.assignments.filter((a) => a.groupId === DAW_WEB_GROUP_ID).map((a) => a.id),
    );
    const started = SEED.attempts.filter((a) => webAssignments.has(a.assignmentId ?? ''));

    expect(started.length).toBeGreaterThan(0);
    expect(started.length).toBeLessThan(DAW_STUDENT_IDS.length / 4);
  });

  it('gives every student of 1.º DAW A some history, the first four the richest', () => {
    const attemptsOf = (userId: string) => SEED.attempts.filter((a) => a.userId === userId);

    expect(DAW_STUDENT_IDS.every((id) => attemptsOf(id).length > 0)).toBe(true);
    expect(DAM_STUDENT_IDS.every((id) => attemptsOf(id).length > 0)).toBe(true);
    const eventsOf = (userId: string) =>
      SEED.events.filter((event) => attemptsOf(userId).some((a) => a.id === event.attemptId));
    expect(eventsOf(DAW_STUDENT_IDS[1]).filter((e) => e.type === 'hint_requested').length).toBe(
      Math.max(
        ...DAW_STUDENT_IDS.map(
          (id) => eventsOf(id).filter((e) => e.type === 'hint_requested').length,
        ),
      ),
    );
    expect(eventsOf(DAW_STUDENT_IDS[3]).some((e) => e.type === 'paste')).toBe(true);
  });

  it('shows fewer hints per attempt as the topics of 1.º DAW A go by', () => {
    const topics = SEED.classBlocks.filter((b) => b.groupId === DAW_GROUP_ID).slice(0, 4);
    const hintsPerAttempt = topics.map((block) => {
      const assignmentIds = SEED.assignments.filter((a) => a.blockId === block.id).map((a) => a.id);
      const attempts = SEED.attempts.filter(
        (a) => a.number === 1 && assignmentIds.includes(a.assignmentId ?? ''),
      );
      const hints = SEED.events.filter(
        (e) => e.type === 'hint_requested' && attempts.some((a) => a.id === e.attemptId),
      );
      return hints.length / attempts.length;
    });

    for (let i = 1; i < hintsPerAttempt.length; i++) {
      expect(hintsPerAttempt[i]).toBeLessThan(hintsPerAttempt[i - 1]);
    }
  });

  it('marks as stuck, at the end of a block, an attempt that keeps failing the same test', () => {
    const hugoAttempt = SEED.attempts.find(
      (a) => a.userId === DAW_STUDENT_IDS[1] && a.status === 'tests_failed',
    );
    const exercise = SEED.exercises.find((e) => e.id === hugoAttempt?.exerciseId);
    const events = SEED.events.filter((e) => e.attemptId === hugoAttempt?.id);

    expect(hugoAttempt && exercise).toBeTruthy();
    expect(isStuck(hugoAttempt!, events, exercise!, Date.parse(hugoAttempt!.updatedAt))).toBe(true);
  });
});
