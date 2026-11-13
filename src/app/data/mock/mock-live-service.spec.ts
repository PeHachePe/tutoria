import { TestBed } from '@angular/core/testing';

import type { Attempt } from '../attempt';
import type { LiveUpdate } from '../live-service';
import { assignmentId, DAW_RESIT_BLOCK } from './fixtures/exercises';
import { fixtureId } from './fixtures/fixture-id';
import { SEED } from './fixtures/seed';
import {
  ADMIN_ID,
  DAM_GROUP_ID,
  DAW_GROUP_ID,
  DAW_STUDENT_IDS,
  DAW_WEB_GROUP_ID,
  TEACHER_ID,
} from './fixtures/users';
import { MockDb } from './mock-db';
import { MockLiveService } from './mock-live-service';
import { MockNetwork } from './mock-network';

const FIRST_BLOCK = fixtureId('block', 1);

describe('MockLiveService', () => {
  let service: MockLiveService;
  let db: MockDb;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [MockLiveService] });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    db = TestBed.inject(MockDb);
    service = TestBed.inject(MockLiveService);
  });

  afterEach(() => localStorage.clear());

  describe('listGroups', () => {
    it("lists the teacher's groups by name and subject, with blocks and the latest one", async () => {
      db.setSession(TEACHER_ID);

      const groups = await service.listGroups();

      expect(groups.map((group) => [group.id, group.subject.name])).toEqual([
        [DAW_WEB_GROUP_ID, 'Desarrollo web en entorno cliente'],
        [DAW_GROUP_ID, 'Programación básica'],
      ]);
      const daw = groups[1];
      expect(daw.blocks.map((block) => block.position)).toEqual(
        [...daw.blocks.map((block) => block.position)].sort((a, b) => a - b),
      );
      expect(daw.blocks.some((block) => block.isHidden)).toBe(true);
      expect(daw.latestBlockId).toBe(fixtureId('block', DAW_RESIT_BLOCK));
    });

    it('lists every group for an administrator, null without attempts', async () => {
      db.setSession(ADMIN_ID);
      db.update('attempts', () => []);

      const groups = await service.listGroups();

      expect(groups).toHaveLength(SEED.groups.length);
      expect(groups.every((group) => group.latestBlockId === null)).toBe(true);
    });

    it('is forbidden for a student', async () => {
      db.setSession(DAW_STUDENT_IDS[0]);

      await expect(service.listGroups()).rejects.toMatchObject({ kind: 'forbidden' });
    });
  });

  describe('snapshot', () => {
    it('gives the students, exercises, attempts and events of a block', async () => {
      db.setSession(TEACHER_ID);

      const snapshot = await service.snapshot(DAW_GROUP_ID, FIRST_BLOCK);

      expect(snapshot.students).toHaveLength(DAW_STUDENT_IDS.length);
      expect(snapshot.students[0].name.localeCompare(snapshot.students[1].name, 'es')).toBe(-1);
      expect(snapshot.exercises.map((entry) => entry.assignmentId)).toEqual([
        assignmentId(DAW_GROUP_ID, 1),
        assignmentId(DAW_GROUP_ID, 2),
      ]);
      const positions = snapshot.exercises[0].tests.map((test) => test.position);
      expect(positions.length).toBeGreaterThan(1);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      const ids = new Set(snapshot.exercises.map((entry) => entry.assignmentId));
      expect(snapshot.attempts.length).toBeGreaterThan(0);
      expect(snapshot.attempts.every((attempt) => ids.has(attempt.assignmentId ?? ''))).toBe(true);
      const attemptIds = new Set(snapshot.attempts.map((attempt) => attempt.id));
      expect(snapshot.events.length).toBeGreaterThan(0);
      expect(snapshot.events.every((event) => attemptIds.has(event.attemptId))).toBe(true);
    });

    it.each([
      ['a group of another teacher', DAM_GROUP_ID, fixtureId('block', 7)],
      ['a block of another group', DAW_GROUP_ID, fixtureId('block', 7)],
    ])('does not find %s', async (_, groupId, blockId) => {
      db.setSession(TEACHER_ID);

      await expect(service.snapshot(groupId, blockId)).rejects.toMatchObject({
        kind: 'not_found',
      });
    });
  });

  describe('attemptDetail', () => {
    /** An attempt of the seed with events and more than one tutor interaction. */
    const talkative = () =>
      SEED.attempts.find(
        (attempt) =>
          attempt.assignmentId !== null &&
          SEED.interactions.filter((i) => i.attemptId === attempt.id).length > 1 &&
          SEED.events.some((e) => e.attemptId === attempt.id),
      ) as Attempt;

    it('gives the attempt with its student, exercise, group, block, events and interactions', async () => {
      db.setSession(TEACHER_ID);
      const attempt = talkative();
      const assignment = SEED.assignments.find((a) => a.id === attempt.assignmentId);

      const detail = await service.attemptDetail(attempt.id);

      expect(detail.attempt).toEqual(attempt);
      expect(detail.groupId).toBe(assignment?.groupId);
      expect(detail.blockId).toBe(assignment?.blockId);
      expect(detail.student).toEqual({
        id: attempt.userId,
        name: SEED.users.find((user) => user.id === attempt.userId)?.name,
      });
      expect(detail.exercise.assignmentId).toBe(attempt.assignmentId);
      expect(detail.exercise.exercise.id).toBe(attempt.exerciseId);
      const positions = detail.exercise.tests.map((test) => test.position);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      expect(detail.events.length).toBeGreaterThan(0);
      expect(detail.events.every((event) => event.attemptId === attempt.id)).toBe(true);
      const times = detail.events.map((event) => event.timestamp);
      expect(times).toEqual([...times].sort());
      expect(detail.interactions.length).toBeGreaterThan(0);
      const created = detail.interactions.map((interaction) => interaction.createdAt);
      expect(created).toEqual([...created].sort());
    });

    it('is open to an administrator', async () => {
      db.setSession(ADMIN_ID);

      await expect(service.attemptDetail(talkative().id)).resolves.toBeDefined();
    });

    it.each([
      [
        'an attempt of a group of another teacher',
        () => ({ assignmentId: assignmentId(DAM_GROUP_ID, 1) }),
      ],
      ['an attempt without assignment', () => ({ assignmentId: null })],
    ])('hides %s', async (_, change) => {
      db.setSession(TEACHER_ID);
      const attempt = { ...talkative(), id: 'hidden-attempt', ...change() };
      db.update('attempts', (rows) => [...rows, attempt]);

      await expect(service.attemptDetail(attempt.id)).rejects.toMatchObject({ kind: 'not_found' });
    });

    it('does not find an unknown attempt', async () => {
      db.setSession(TEACHER_ID);

      await expect(service.attemptDetail('unknown')).rejects.toMatchObject({ kind: 'not_found' });
    });

    it('is forbidden for a student', async () => {
      db.setSession(DAW_STUDENT_IDS[0]);

      await expect(service.attemptDetail(talkative().id)).rejects.toMatchObject({
        kind: 'forbidden',
      });
    });
  });

  describe('watch', () => {
    const attempt = (): Attempt => ({
      ...SEED.attempts[0],
      id: 'new-attempt',
      assignmentId: assignmentId(DAW_GROUP_ID, 1),
    });

    function watch(groupId = DAW_GROUP_ID): LiveUpdate[] {
      const updates: LiveUpdate[] = [];
      service.watch(groupId, (update) => updates.push(update));
      return updates;
    }

    it('tells the new and changed attempts of the group and the new events and interactions of its attempts', () => {
      db.setSession(TEACHER_ID);
      const updates = watch();
      const event = { ...SEED.events[0], id: 'new-event', attemptId: 'new-attempt' };
      const other = { ...SEED.events[0], id: 'other-event', attemptId: 'elsewhere' };
      const interaction = {
        ...SEED.interactions[0],
        id: 'new-interaction',
        attemptId: 'new-attempt',
      };
      const otherInteraction = { ...interaction, id: 'other-interaction', attemptId: 'elsewhere' };

      db.update('attempts', (rows) => [...rows, attempt()]);
      db.update('events', (rows) => [...rows, event, other]);
      db.update('interactions', (rows) => [...rows, interaction, otherInteraction]);
      db.update('users', (rows) => [...rows]);

      expect(updates).toEqual([
        { type: 'attempt', attempt: attempt() },
        { type: 'event', event },
        { type: 'interaction', interaction },
      ]);
    });

    it('ignores the attempts of other groups and the attempts without assignment', () => {
      db.setSession(TEACHER_ID);
      const updates = watch(DAW_WEB_GROUP_ID);

      db.update('attempts', (rows) => [...rows, attempt(), { ...attempt(), assignmentId: null }]);

      expect(updates).toEqual([]);
    });

    it('stops when asked', () => {
      db.setSession(TEACHER_ID);
      const updates: LiveUpdate[] = [];
      const stop = service.watch(DAW_GROUP_ID, (update) => updates.push(update));

      stop();
      db.update('attempts', (rows) => [...rows, attempt()]);

      expect(updates).toEqual([]);
    });

    it.each([
      ['a group of another teacher', TEACHER_ID, DAM_GROUP_ID],
      ['an unknown group', TEACHER_ID, 'unknown'],
      ['no session', null, DAW_GROUP_ID],
    ])('sees nothing of %s', (_, userId, groupId) => {
      db.setSession(userId);
      const updates = watch(groupId);

      db.update('attempts', (rows) => [...rows, attempt()]);

      expect(updates).toEqual([]);
      expect(service.watch(groupId, () => undefined)()).toBeUndefined();
    });
  });
});
