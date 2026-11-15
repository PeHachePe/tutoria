import { TestBed } from '@angular/core/testing';

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
  });

  afterEach(() => localStorage.clear());

  describe('listGroups', () => {
    it('lists the groups of the teacher with their subject, by name and subject', async () => {
      const groups = await service.listGroups();

      expect(groups.map((group) => [group.name, group.subject.name])).toEqual([
        ['1.º DAW A', 'Desarrollo web en entorno cliente'],
        ['1.º DAW A', 'Programación básica'],
      ]);
    });

    it('lists every group to the administrator, and none to a student', async () => {
      db.setSession(ADMIN_ID);
      await expect(service.listGroups()).resolves.toHaveLength(SEED.groups.length);

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
        position: 9,
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
      expect(blocks.map((entry) => entry.block.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
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
    });
  });
});
