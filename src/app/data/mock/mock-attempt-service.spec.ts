import { TestBed } from '@angular/core/testing';

import type { Attempt } from '../attempt';
import { assignmentId, blockAssignmentId, DAW_RESIT_BLOCK, exerciseId } from './fixtures/exercises';
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

/** Assignment of exercise `n` in its topic of 1.º DAW A. */
function assignmentAt(n: number): string {
  return assignmentId(DAW_GROUP_ID, n);
}

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
    it('creates attempt 1, empty and in progress, at the assignment', async () => {
      const attempt = await service.openOrCreate(assignmentAt(3));

      expect(attempt).toEqual({
        id: expect.any(String),
        exerciseId: exerciseId(3),
        userId: STUDENT,
        assignmentId: assignmentAt(3),
        number: 1,
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
      const first = await service.openOrCreate(assignmentAt(3));

      await expect(service.openOrCreate(assignmentAt(3))).resolves.toEqual(first);
      expect(db.tables().attempts).toHaveLength(1);
    });

    it('opens another attempt for the same exercise in another block', async () => {
      const topic = await service.openOrCreate(assignmentAt(3));
      const resit = await service.openOrCreate(blockAssignmentId(DAW_RESIT_BLOCK, 3));

      expect(resit.id).not.toBe(topic.id);
      expect(resit).toMatchObject({ exerciseId: exerciseId(3), number: 1 });
    });

    it('opens the latest attempt or, with its number, an earlier one, never creating it', async () => {
      const first = setStatus(await service.openOrCreate(assignmentAt(3)), 'submitted');
      const second = await service.retry(assignmentAt(3));

      await expect(service.openOrCreate(assignmentAt(3))).resolves.toEqual(second);
      await expect(service.openOrCreate(assignmentAt(3), 1)).resolves.toEqual(first);
      await expect(service.openOrCreate(assignmentAt(3), 3)).rejects.toMatchObject({
        kind: 'not_found',
      });
    });

    it('does not let a student open an assignment of another group or a hidden one', async () => {
      await expect(
        service.openOrCreate(blockAssignmentId(DAW_RESIT_BLOCK, 2)),
      ).rejects.toMatchObject({ kind: 'not_found' });
      db.setSession(DAM_STUDENT_IDS[0]);
      await expect(service.openOrCreate(assignmentAt(8))).rejects.toMatchObject({
        kind: 'not_found',
      });
    });

    it('lets the teacher of the group try its exercises, the hidden ones too', async () => {
      db.setSession(TEACHER_ID);

      const attempt = await service.openOrCreate(blockAssignmentId(DAW_RESIT_BLOCK, 2));

      expect(attempt).toMatchObject({ userId: TEACHER_ID, exerciseId: exerciseId(2) });
    });

    it('fails for an unknown assignment or without a session', async () => {
      await expect(service.openOrCreate('missing')).rejects.toMatchObject({ kind: 'not_found' });
      db.setSession(null);
      await expect(service.openOrCreate(assignmentAt(1))).rejects.toMatchObject({
        kind: 'unauthorized',
      });
    });
  });

  describe('list', () => {
    it("lists the student's attempts at the assignment by number, not those of others", async () => {
      const first = setStatus(await service.openOrCreate(assignmentAt(3)), 'submitted');
      await service.openOrCreate(assignmentAt(4));
      db.setSession(DAW_STUDENT_IDS[1]);
      await service.openOrCreate(assignmentAt(3));
      db.setSession(STUDENT);
      const second = await service.retry(assignmentAt(3));

      await expect(service.list(assignmentAt(3))).resolves.toEqual([first, second]);
    });
  });

  describe('retry («Practicar de nuevo»)', () => {
    it('starts the next attempt, empty, once the latest is submitted', async () => {
      setStatus(await service.openOrCreate(assignmentAt(3)), 'submitted');
      vi.setSystemTime(LATER);

      const again = await service.retry(assignmentAt(3));

      expect(again).toMatchObject({
        assignmentId: assignmentAt(3),
        number: 2,
        currentCode: '',
        status: 'in_progress',
        startedAt: LATER,
      });
    });

    it('returns the latest attempt while it is open, as another tab practised first', async () => {
      setStatus(await service.openOrCreate(assignmentAt(3)), 'submitted');
      const again = await service.retry(assignmentAt(3));

      await expect(service.retry(assignmentAt(3))).resolves.toEqual(again);
      expect(db.tables().attempts).toHaveLength(2);
    });

    it('needs an attempt and an assignment the student sees', async () => {
      await expect(service.retry(assignmentAt(3))).rejects.toMatchObject({ kind: 'invalid' });
      await expect(service.retry(blockAssignmentId(DAW_RESIT_BLOCK, 2))).rejects.toMatchObject({
        kind: 'not_found',
      });
    });
  });

  describe('saveCode (2.4)', () => {
    it('saves the code and keeps an attempt in progress, leaving the others alone', async () => {
      const attempt = await service.openOrCreate(assignmentAt(3));
      const other = await service.openOrCreate(assignmentAt(4));
      vi.setSystemTime(LATER);

      const saved = await service.saveCode(attempt.id, 'function suma() {}');

      expect(saved).toEqual({ ...attempt, currentCode: 'function suma() {}', updatedAt: LATER });
      expect(db.tables().attempts).toEqual([saved, other]);
    });

    it.each(['tests_failed', 'passed'] as const)(
      'takes an attempt in %s back to in_progress',
      async (status) => {
        const attempt = setStatus(await service.openOrCreate(assignmentAt(3)), status);

        const saved = await service.saveCode(attempt.id, 'otro código');

        expect(saved.status).toBe('in_progress');
      },
    );

    it('changes nothing when the code is the same', async () => {
      const attempt = setStatus(await service.openOrCreate(assignmentAt(3)), 'passed');
      vi.setSystemTime(LATER);

      await expect(service.saveCode(attempt.id, attempt.currentCode)).resolves.toEqual(attempt);
    });

    it('rejects changes to a submitted attempt', async () => {
      const attempt = setStatus(await service.openOrCreate(assignmentAt(3)), 'submitted');

      await expect(service.saveCode(attempt.id, 'x')).rejects.toMatchObject({ kind: 'invalid' });
    });

    it("does not find another student's attempt", async () => {
      const attempt = await service.openOrCreate(assignmentAt(3));
      db.setSession(DAW_STUDENT_IDS[1]);

      await expect(service.saveCode(attempt.id, 'x')).rejects.toMatchObject({
        kind: 'not_found',
      });
    });
  });

  describe('submit (2.4)', () => {
    it('submits a passed attempt, freezing its code, and records the submit event', async () => {
      const attempt = setStatus(await service.openOrCreate(assignmentAt(3)), 'passed');
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
        const attempt = setStatus(await service.openOrCreate(assignmentAt(3)), status);

        await expect(service.submit(attempt.id)).rejects.toMatchObject({ kind: 'invalid' });
        expect(db.tables().events).toEqual([]);
      },
    );
  });

  describe('history', () => {
    it('returns the attempt with its events and interactions in time order', async () => {
      const attempt = await service.openOrCreate(assignmentAt(3));
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
      const attempt = await service.openOrCreate(assignmentAt(3));

      db.setSession(TEACHER_ID);
      await expect(service.history(attempt.id)).resolves.toMatchObject({ attempt });
      db.setSession(ADMIN_ID);
      await expect(service.history(attempt.id)).resolves.toMatchObject({ attempt });
    });

    it('is not visible to other students or to the teacher of another group', async () => {
      const attempt = await service.openOrCreate(assignmentAt(3));

      db.setSession(DAW_STUDENT_IDS[1]);
      await expect(service.history(attempt.id)).rejects.toMatchObject({ kind: 'not_found' });
      db.setSession(OTHER_TEACHER_ID);
      await expect(service.history(attempt.id)).rejects.toMatchObject({ kind: 'not_found' });
    });
  });
});
