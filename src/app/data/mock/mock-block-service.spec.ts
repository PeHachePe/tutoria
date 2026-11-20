import { TestBed } from '@angular/core/testing';

import { withoutHistory } from './fixtures/history';
import type { BlockDraft } from '../block-service';
import {
  assignmentId,
  blockAssignmentId,
  DAW_HIDDEN_BLOCK,
  exerciseId,
} from './fixtures/exercises';
import { fixtureId } from './fixtures/fixture-id';
import { SEED } from './fixtures/seed';
import {
  ADMIN_ID,
  DAM_GROUP_ID,
  DAW_GROUP_ID,
  DAW_STUDENT_IDS,
  DAW_WEB_GROUP_ID,
  OTHER_TEACHER_ID,
  TEACHER_ID,
} from './fixtures/users';
import { MockBlockService } from './mock-block-service';
import { MockDb } from './mock-db';
import { MockNetwork } from './mock-network';

const DRAFT: BlockDraft = {
  title: 'Examen del primer trimestre',
  sourceLocale: 'es',
  translations: { en: { title: 'First term exam' } },
  isHidden: true,
  opensAt: '2026-12-14T08:00:00.000Z',
};

/** «Tema 1» of 1.º DAW A, with attempts. */
const STARTED_BLOCK = fixtureId('block', 1);
/** «Repaso final» of 1.º DAW A, hidden and not started: exercises 5 and 8. */
const FREE_BLOCK = fixtureId('block', DAW_HIDDEN_BLOCK);

function blockIdsOf(groupId: string): string[] {
  return SEED.classBlocks
    .filter((block) => block.groupId === groupId)
    .sort((a, b) => a.position - b.position)
    .map((block) => block.id);
}

describe('MockBlockService', () => {
  let service: MockBlockService;
  let db: MockDb;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [MockBlockService] });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    db = TestBed.inject(MockDb);
    service = TestBed.inject(MockBlockService);
    db.setSession(TEACHER_ID);
    // This year alone: the classes and students of the years before are not what these test
    withoutHistory(db);
  });

  afterEach(() => localStorage.clear());

  describe('listGroups', () => {
    it('lists the groups of the teacher with their subject, by name and subject', async () => {
      const groups = await service.listGroups();

      expect(groups.map((group) => [group.name, group.schoolYear, group.subject.name])).toEqual([
        ['1.º DAW A', '2026/27', 'Desarrollo web en entorno cliente'],
        ['1.º DAW A', '2026/27', 'Programación básica'],
      ]);
    });

    it('lists every group to the administrator, and none to a student', async () => {
      db.setSession(ADMIN_ID);
      await expect(service.listGroups()).resolves.toHaveLength(db.tables().groups.length);

      db.setSession(DAW_STUDENT_IDS[0]);
      await expect(service.listGroups()).rejects.toMatchObject({ kind: 'forbidden' });
    });
  });

  describe('listBlocks', () => {
    it('lists every block of the group in order, with its exercises in order and who started them', async () => {
      const blocks = await service.listBlocks(DAW_GROUP_ID);

      expect(blocks.map((entry) => entry.block.id)).toEqual(blockIdsOf(DAW_GROUP_ID));
      const [first] = blocks;
      expect(first.assignments.map((entry) => entry.exercise.id)).toEqual([
        exerciseId(1),
        exerciseId(2),
      ]);
      expect(first.assignments[0].studentCount).toBeGreaterThan(0);
      const hidden = blocks.find((entry) => entry.block.id === FREE_BLOCK);
      expect(hidden?.block.isHidden).toBe(true);
      expect(hidden?.assignments.every((entry) => entry.studentCount === 0)).toBe(true);
    });

    it('does not find the group of another teacher', async () => {
      await expect(service.listBlocks(DAM_GROUP_ID)).rejects.toMatchObject({ kind: 'not_found' });
      await expect(service.listBlocks('missing')).rejects.toMatchObject({ kind: 'not_found' });
    });
  });

  describe('blocks', () => {
    it('creates a block after the others', async () => {
      const block = await service.createBlock(DAW_GROUP_ID, DRAFT);

      expect(block).toEqual({
        id: expect.any(String),
        groupId: DAW_GROUP_ID,
        position: 10,
        ...DRAFT,
      });
      const blocks = await service.listBlocks(DAW_GROUP_ID);
      expect(blocks.at(-1)).toEqual({ block, assignments: [] });
    });

    it('creates the first block of a group as the first', async () => {
      db.update('classBlocks', (rows) => rows.filter((row) => row.groupId !== DAW_GROUP_ID));
      db.update('assignments', (rows) => rows.filter((row) => row.groupId !== DAW_GROUP_ID));

      await expect(service.createBlock(DAW_GROUP_ID, DRAFT)).resolves.toMatchObject({
        position: 1,
      });
    });

    it('rejects a blank title', async () => {
      await expect(
        service.createBlock(DAW_GROUP_ID, { ...DRAFT, title: '  ' }),
      ).rejects.toMatchObject({ kind: 'invalid' });
      await expect(
        service.updateBlock(FREE_BLOCK, { ...DRAFT, translations: { en: { title: ' ' } } }),
      ).rejects.toMatchObject({ kind: 'invalid' });
    });

    it('changes the title, translations and visibility of a block', async () => {
      const block = await service.updateBlock(FREE_BLOCK, DRAFT);

      expect(block).toMatchObject({ id: FREE_BLOCK, position: 8, ...DRAFT });
      expect(db.tables().classBlocks.find((row) => row.id === FREE_BLOCK)).toEqual(block);
    });

    it('removes a block nobody started, with its assignments', async () => {
      await service.removeBlock(FREE_BLOCK);

      expect(db.tables().classBlocks.some((row) => row.id === FREE_BLOCK)).toBe(false);
      expect(db.tables().assignments.some((row) => row.blockId === FREE_BLOCK)).toBe(false);
    });

    it('keeps a block somebody started', async () => {
      await expect(service.removeBlock(STARTED_BLOCK)).rejects.toMatchObject({ kind: 'invalid' });
    });

    it('reorders the blocks of the group', async () => {
      const reversed = blockIdsOf(DAW_GROUP_ID).reverse();

      await service.reorderBlocks(DAW_GROUP_ID, reversed);

      const blocks = await service.listBlocks(DAW_GROUP_ID);
      expect(blocks.map((entry) => entry.block.id)).toEqual(reversed);
      expect(blocks.map((entry) => entry.block.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('rejects an order without every block of the group once', async () => {
      const ids = blockIdsOf(DAW_GROUP_ID);

      await expect(service.reorderBlocks(DAW_GROUP_ID, ids.slice(1))).rejects.toMatchObject({
        kind: 'invalid',
      });
      await expect(
        service.reorderBlocks(DAW_GROUP_ID, [ids[0], ...ids.slice(0, -1)]),
      ).rejects.toMatchObject({ kind: 'invalid' });
    });

    it("does not touch the blocks of another teacher's group", async () => {
      db.setSession(OTHER_TEACHER_ID);

      await expect(service.createBlock(DAW_GROUP_ID, DRAFT)).rejects.toMatchObject({
        kind: 'not_found',
      });
      await expect(service.updateBlock(FREE_BLOCK, DRAFT)).rejects.toMatchObject({
        kind: 'not_found',
      });
      await expect(service.removeBlock(FREE_BLOCK)).rejects.toMatchObject({ kind: 'not_found' });
      await expect(
        service.reorderBlocks(DAW_GROUP_ID, blockIdsOf(DAW_GROUP_ID)),
      ).rejects.toMatchObject({ kind: 'not_found' });
    });
  });

  describe('assignments', () => {
    it('assigns exercises after those of the block, visible and without due date', async () => {
      const created = await service.assign(FREE_BLOCK, [exerciseId(1), exerciseId(3)]);

      expect(created).toEqual([
        {
          id: expect.any(String),
          groupId: DAW_GROUP_ID,
          blockId: FREE_BLOCK,
          exerciseId: exerciseId(1),
          position: 3,
          isHidden: false,
          dueAt: null,
        },
        expect.objectContaining({ exerciseId: exerciseId(3), position: 4 }),
      ]);
      const blocks = await service.listBlocks(DAW_GROUP_ID);
      const block = blocks.find((entry) => entry.block.id === FREE_BLOCK);
      expect(block?.assignments.map((entry) => entry.exercise.id)).toEqual(
        [5, 8, 1, 3].map(exerciseId),
      );
    });

    it('rejects an exercise already in the block or repeated, and an unknown one', async () => {
      await expect(service.assign(FREE_BLOCK, [exerciseId(5)])).rejects.toMatchObject({
        kind: 'invalid',
      });
      await expect(
        service.assign(FREE_BLOCK, [exerciseId(1), exerciseId(1)]),
      ).rejects.toMatchObject({ kind: 'invalid' });
      await expect(service.assign(FREE_BLOCK, ['missing'])).rejects.toMatchObject({
        kind: 'not_found',
      });
    });

    it('changes whether an assignment is hidden and its due date', async () => {
      const id = blockAssignmentId(DAW_HIDDEN_BLOCK, 5);

      const dated = await service.updateAssignment(id, { dueAt: '2026-12-01T22:59:00.000Z' });
      const hidden = await service.updateAssignment(id, { isHidden: true });

      expect(dated).toMatchObject({ id, isHidden: false, dueAt: '2026-12-01T22:59:00.000Z' });
      expect(hidden).toMatchObject({ id, isHidden: true, dueAt: '2026-12-01T22:59:00.000Z' });
      await expect(service.updateAssignment(id, { dueAt: null })).resolves.toMatchObject({
        dueAt: null,
      });
    });

    it('unassigns an exercise nobody started, and keeps one somebody did', async () => {
      const free = blockAssignmentId(DAW_HIDDEN_BLOCK, 5);

      await service.unassign(free);

      expect(db.tables().assignments.some((row) => row.id === free)).toBe(false);
      await expect(service.unassign(assignmentId(DAW_GROUP_ID, 1))).rejects.toMatchObject({
        kind: 'invalid',
      });
    });

    it('reorders the exercises of a block', async () => {
      const ids = [blockAssignmentId(DAW_HIDDEN_BLOCK, 8), blockAssignmentId(DAW_HIDDEN_BLOCK, 5)];

      await service.reorderAssignments(FREE_BLOCK, ids);

      const blocks = await service.listBlocks(DAW_GROUP_ID);
      const block = blocks.find((entry) => entry.block.id === FREE_BLOCK);
      expect(block?.assignments.map((entry) => entry.assignment.id)).toEqual(ids);
      expect(block?.assignments.map((entry) => entry.assignment.position)).toEqual([1, 2]);
      await expect(service.reorderAssignments(FREE_BLOCK, [ids[0]])).rejects.toMatchObject({
        kind: 'invalid',
      });
    });

    it('moves an exercise somebody started to a place of another block of the group', async () => {
      const started = assignmentId(DAW_GROUP_ID, 1);

      const moved = await service.moveAssignment(started, FREE_BLOCK, 2);

      expect(moved).toMatchObject({ id: started, blockId: FREE_BLOCK, position: 2 });
      const blocks = await service.listBlocks(DAW_GROUP_ID);
      const target = blocks.find((entry) => entry.block.id === FREE_BLOCK);
      expect(target?.assignments.map((entry) => entry.exercise.id)).toEqual(
        [5, 1, 8].map(exerciseId),
      );
      expect(target?.assignments.map((entry) => entry.assignment.position)).toEqual([1, 2, 3]);
      expect(target?.assignments[1].studentCount).toBeGreaterThan(0);
      const source = blocks.find((entry) => entry.block.id === STARTED_BLOCK);
      expect(source?.assignments.map((entry) => entry.assignment.position)).toEqual([1]);
    });

    it('moves an exercise after the last of the block', async () => {
      await expect(
        service.moveAssignment(assignmentId(DAW_GROUP_ID, 2), FREE_BLOCK, 3),
      ).resolves.toMatchObject({ position: 3 });
    });

    it('rejects a move within the block, to a block that has it or past its last place', async () => {
      const id = blockAssignmentId(DAW_HIDDEN_BLOCK, 5);

      await expect(service.moveAssignment(id, FREE_BLOCK, 1)).rejects.toMatchObject({
        kind: 'invalid',
      });
      // Exercise 5 is also in «Tema 3»
      await expect(service.moveAssignment(id, fixtureId('block', 3), 1)).rejects.toMatchObject({
        kind: 'invalid',
      });
      await expect(
        service.moveAssignment(assignmentId(DAW_GROUP_ID, 1), FREE_BLOCK, 4),
      ).rejects.toMatchObject({ kind: 'invalid' });
      await expect(
        service.moveAssignment(assignmentId(DAW_GROUP_ID, 1), FREE_BLOCK, 0),
      ).rejects.toMatchObject({ kind: 'invalid' });
    });

    it('does not move an exercise to a block of another group', async () => {
      db.setSession(ADMIN_ID);

      await expect(
        service.moveAssignment(assignmentId(DAW_GROUP_ID, 1), fixtureId('block', 7), 1),
      ).rejects.toMatchObject({ kind: 'not_found' });
    });

    it("does not touch the assignments of another teacher's group", async () => {
      db.setSession(OTHER_TEACHER_ID);
      const id = blockAssignmentId(DAW_HIDDEN_BLOCK, 5);

      await expect(service.assign(FREE_BLOCK, [exerciseId(1)])).rejects.toMatchObject({
        kind: 'not_found',
      });
      await expect(service.updateAssignment(id, { isHidden: true })).rejects.toMatchObject({
        kind: 'not_found',
      });
      await expect(service.unassign(id)).rejects.toMatchObject({ kind: 'not_found' });
      await expect(service.reorderAssignments(FREE_BLOCK, [id])).rejects.toMatchObject({
        kind: 'not_found',
      });
      await expect(service.moveAssignment(id, STARTED_BLOCK, 1)).rejects.toMatchObject({
        kind: 'not_found',
      });
    });
  });

  describe('copyBlocks', () => {
    it('copies the blocks of a group after those of another, with their exercises and dates', async () => {
      const before = blockIdsOf(DAW_WEB_GROUP_ID);
      const sources = blockIdsOf(DAW_GROUP_ID);

      await expect(service.copyBlocks(DAW_GROUP_ID, DAW_WEB_GROUP_ID, true)).resolves.toBe(
        sources.length,
      );

      const blocks = await service.listBlocks(DAW_WEB_GROUP_ID);
      const source = await service.listBlocks(DAW_GROUP_ID);
      expect(blocks.slice(0, before.length).map((row) => row.block.id)).toEqual(before);
      const copies = blocks.slice(before.length);
      const shape = (rows: typeof blocks) =>
        rows.map(({ block, assignments }) => [
          block.title,
          block.isHidden,
          block.opensAt,
          assignments.map(({ assignment }) => [
            assignment.exerciseId,
            assignment.isHidden,
            assignment.dueAt,
          ]),
        ]);
      // The same year: the same dates
      expect(shape(copies)).toEqual(shape(source));
      expect(copies.every((row) => row.assignments.every((a) => a.studentCount === 0))).toBe(true);
    });

    it('copies without dates', async () => {
      await service.copyBlocks(DAW_GROUP_ID, DAW_WEB_GROUP_ID, false);

      const copied = db
        .tables()
        .assignments.filter(
          (row) => row.groupId === DAW_WEB_GROUP_ID && !SEED.assignments.includes(row),
        );
      expect(copied.length).toBeGreaterThan(0);
      expect(copied.every((row) => row.dueAt === null)).toBe(true);
    });

    it('does not copy from or into a group of another teacher, nor into the same', async () => {
      await expect(service.copyBlocks(DAM_GROUP_ID, DAW_GROUP_ID, true)).rejects.toMatchObject({
        kind: 'not_found',
      });
      await expect(service.copyBlocks(DAW_GROUP_ID, DAW_GROUP_ID, true)).rejects.toMatchObject({
        kind: 'invalid',
      });
      expect(db.tables().classBlocks).toEqual(SEED.classBlocks);
    });
  });
});
