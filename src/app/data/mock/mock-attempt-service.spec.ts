import { TestBed } from '@angular/core/testing';

import type { Attempt } from '../attempt';
import { assignmentId, exerciseId } from './fixtures/exercises';
import {
  ADMIN_ID,
  DAM_STUDENT_IDS,
  DAW_GROUP_ID,
  DAW_STUDENT_IDS,
  OTHER_TEACHER_ID,
  TEACHER_ID,
} from './fixtures/users';
import { MockAttemptService } from './mock-attempt-service';
import { MockDb } from './mock-db';
import { MockNetwork } from './mock-network';

const NOW = '2026-11-10T09:30:00.000Z';
const LATER = '2026-11-10T09:45:00.000Z';
/** A student of 1.º DAW A whose attempts the tests create. */
const STUDENT = DAW_STUDENT_IDS[0];

describe('MockAttemptService', () => {
  let service: MockAttemptService;
  let db: MockDb;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    TestBed.configureTestingModule({ providers: [MockAttemptService] });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    db = TestBed.inject(MockDb);
    db.update('attempts', () => []);
    db.update('events', () => []);
    db.update('interactions', () => []);
    db.setSession(STUDENT);
    service = TestBed.inject(MockAttemptService);
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  /** Sets the status of an attempt as the code runner (or the server) would. */
  function setStatus(attempt: Attempt, status: Attempt['status']): Attempt {
    const changed = { ...attempt, status };
    db.update('attempts', (rows) => rows.map((row) => (row.id === attempt.id ? changed : row)));
    return changed;
  }

  describe('openOrCreate', () => {
    it('creates an empty attempt in progress, linked to the assignment', async () => {
      const attempt = await service.openOrCreate(exerciseId(3));

      expect(attempt).toEqual({
        id: expect.any(String),
        exerciseId: exerciseId(3),
        userId: STUDENT,
        assignmentId: assignmentId(DAW_GROUP_ID, 3),
        currentCode: '',
        finalCode: null,
        status: 'in_progress',
        startedAt: NOW,
        finishedAt: null,
        updatedAt: NOW,
      });
      expect(db.tables().attempts).toEqual([attempt]);
    });

    it('opens the existing attempt instead of creating another', async () => {
      const first = await service.openOrCreate(exerciseId(3));

      await expect(service.openOrCreate(exerciseId(3))).resolves.toEqual(first);
      expect(db.tables().attempts).toHaveLength(1);
    });

    it('does not let a student open an exercise not assigned to their groups', async () => {
      db.setSession(DAM_STUDENT_IDS[0]);

      await expect(service.openOrCreate(exerciseId(8))).rejects.toMatchObject({
        kind: 'not_found',
      });
    });

    it('lets a teacher try any exercise, without an assignment', async () => {
      db.setSession(TEACHER_ID);

      const attempt = await service.openOrCreate(exerciseId(8));

      expect(attempt.assignmentId).toBeNull();
    });

    it('fails for an unknown exercise or without a session', async () => {
      await expect(service.openOrCreate('missing')).rejects.toMatchObject({ kind: 'not_found' });
      db.setSession(null);
      await expect(service.openOrCreate(exerciseId(1))).rejects.toMatchObject({
        kind: 'unauthorized',
      });
    });
  });

  describe('saveCode (2.4)', () => {
    it('saves the code and keeps an attempt in progress, leaving the others alone', async () => {
      const attempt = await service.openOrCreate(exerciseId(3));
      const other = await service.openOrCreate(exerciseId(4));
      vi.setSystemTime(LATER);

      const saved = await service.saveCode(attempt.id, 'function suma() {}');

      expect(saved).toEqual({ ...attempt, currentCode: 'function suma() {}', updatedAt: LATER });
      expect(db.tables().attempts).toEqual([saved, other]);
    });

    it.each(['tests_failed', 'passed'] as const)(
      'takes an attempt in %s back to in_progress',
      async (status) => {
        const attempt = setStatus(await service.openOrCreate(exerciseId(3)), status);

        const saved = await service.saveCode(attempt.id, 'otro código');

        expect(saved.status).toBe('in_progress');
      },
    );

    it('changes nothing when the code is the same', async () => {
      const attempt = setStatus(await service.openOrCreate(exerciseId(3)), 'passed');
      vi.setSystemTime(LATER);

      await expect(service.saveCode(attempt.id, attempt.currentCode)).resolves.toEqual(attempt);
    });

    it('rejects changes to a submitted attempt', async () => {
      const attempt = setStatus(await service.openOrCreate(exerciseId(3)), 'submitted');

      await expect(service.saveCode(attempt.id, 'x')).rejects.toMatchObject({ kind: 'invalid' });
    });

    it("does not find another student's attempt", async () => {
      const attempt = await service.openOrCreate(exerciseId(3));
      db.setSession(DAW_STUDENT_IDS[1]);

      await expect(service.saveCode(attempt.id, 'x')).rejects.toMatchObject({
        kind: 'not_found',
      });
    });
  });

  describe('submit (2.4)', () => {
    it('submits a passed attempt, freezing its code, and records the submit event', async () => {
      const attempt = setStatus(await service.openOrCreate(exerciseId(3)), 'passed');
      vi.setSystemTime(LATER);

      const submitted = await service.submit(attempt.id);

      expect(submitted).toEqual({
        ...attempt,
        status: 'submitted',
        finalCode: attempt.currentCode,
        finishedAt: LATER,
        updatedAt: LATER,
      });
      expect(db.tables().events).toEqual([
        {
          id: expect.any(String),
          attemptId: attempt.id,
          type: 'submit',
          timestamp: LATER,
          detail: null,
        },
      ]);
    });

    it.each(['in_progress', 'tests_failed', 'submitted'] as const)(
      'rejects submitting from %s',
      async (status) => {
        const attempt = setStatus(await service.openOrCreate(exerciseId(3)), status);

        await expect(service.submit(attempt.id)).rejects.toMatchObject({ kind: 'invalid' });
        expect(db.tables().events).toEqual([]);
      },
    );
  });

  describe('history', () => {
    it('returns the attempt with its events and interactions in time order', async () => {
      const attempt = await service.openOrCreate(exerciseId(3));
      const base = { attemptId: attempt.id, detail: null };
      db.update('events', () => [
        {
          ...base,
          id: 'e2',
          type: 'focus_gained',
          timestamp: '2026-11-10T09:40:00.000Z',
          detail: { awayMs: 300_000 },
        },
        { ...base, id: 'e1', type: 'focus_lost', timestamp: '2026-11-10T09:35:00.000Z' },
        { ...base, id: 'other', attemptId: 'other', type: 'focus_lost', timestamp: NOW },
      ]);
      const interaction = {
        attemptId: attempt.id,
        trigger: 'hint',
        hintLevel: 1,
        studentMessage: null,
        transcript: '¿Qué valor tiene tu variable?',
        emotion: 'encouragement',
        intensity: 1,
        elusion: false,
        promptVersion: 'v0',
      } as const;
      db.update('interactions', () => [
        { ...interaction, id: 'i2', createdAt: '2026-11-10T09:50:00.000Z' },
        { ...interaction, id: 'i1', createdAt: '2026-11-10T09:31:00.000Z' },
      ]);

      const history = await service.history(attempt.id);

      expect(history.attempt).toEqual(attempt);
      expect(history.events.map((event) => event.id)).toEqual(['e1', 'e2']);
      expect(history.interactions.map((i) => i.id)).toEqual(['i1', 'i2']);
    });

    it('is visible to the teacher of the group and to the administrator', async () => {
      const attempt = await service.openOrCreate(exerciseId(3));

      db.setSession(TEACHER_ID);
      await expect(service.history(attempt.id)).resolves.toMatchObject({ attempt });
      db.setSession(ADMIN_ID);
      await expect(service.history(attempt.id)).resolves.toMatchObject({ attempt });
    });

    it('is not visible to other students or to the teacher of another group', async () => {
      const attempt = await service.openOrCreate(exerciseId(3));

      db.setSession(DAW_STUDENT_IDS[1]);
      await expect(service.history(attempt.id)).rejects.toMatchObject({ kind: 'not_found' });
      db.setSession(OTHER_TEACHER_ID);
      await expect(service.history(attempt.id)).rejects.toMatchObject({ kind: 'not_found' });
    });
  });
});
