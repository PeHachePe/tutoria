import { inject, Service } from '@angular/core';

import {
  type AssignmentChanges,
  type BlockDraft,
  BlockService,
  type PlannedBlock,
} from '../block-service';
import { DataError } from '../data-error';
import type { AssignedGroup, ClassBlock, ExerciseAssignment } from '../exercise';
import type { ClassGroup } from '../user';
import { canManageGroup, findRow } from './mock-access';
import { MockDb } from './mock-db';
import { MockNetwork } from './mock-network';

/**
 * Blocks and assignments in MockDb, with the rules of the RLS of 4.3b: another teacher's groups are
 * `not_found`, and only what nobody started is deleted.
 */
@Service({ autoProvided: false })
export class MockBlockService extends BlockService {
  private readonly db = inject(MockDb);
  private readonly network = inject(MockNetwork);

  listGroups(): Promise<AssignedGroup[]> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      const tables = this.db.tables();
      return tables.groups
        .filter((group) => canManageGroup(user, group))
        .map((group) => ({
          id: group.id,
          name: group.name,
          subject: findRow(tables.subjects, group.subjectId),
        }))
        .sort(
          (a, b) =>
            a.name.localeCompare(b.name, 'es') ||
            a.subject.name.localeCompare(b.subject.name, 'es'),
        );
    });
  }

  listBlocks(groupId: string): Promise<PlannedBlock[]> {
    return this.network.request(() => {
      this.findGroup(groupId);
      const tables = this.db.tables();
      return tables.classBlocks
        .filter((block) => block.groupId === groupId)
        .sort(byPosition)
        .map((block) => ({
          block,
          assignments: tables.assignments
            .filter((assignment) => assignment.blockId === block.id)
            .sort(byPosition)
            .map((assignment) => ({
              assignment,
              exercise: findRow(tables.exercises, assignment.exerciseId),
              studentCount: this.studentsOf(assignment.id),
            })),
        }));
    });
  }

  createBlock(groupId: string, draft: BlockDraft): Promise<ClassBlock> {
    return this.network.request(() => {
      this.findGroup(groupId);
      checkTitles(draft);
      const positions = this.db
        .tables()
        .classBlocks.filter((block) => block.groupId === groupId)
        .map((block) => block.position);
      const block: ClassBlock = {
        id: crypto.randomUUID(),
        groupId,
        position: Math.max(0, ...positions) + 1,
        ...draft,
      };
      this.db.update('classBlocks', (rows) => [...rows, block]);
      return block;
    });
  }

  updateBlock(blockId: string, draft: BlockDraft): Promise<ClassBlock> {
    return this.network.request(() => {
      const current = this.findBlock(blockId);
      checkTitles(draft);
      const block: ClassBlock = { ...current, ...draft };
      this.db.update('classBlocks', (rows) =>
        rows.map((row) => (row.id === blockId ? block : row)),
      );
      return block;
    });
  }

  removeBlock(blockId: string): Promise<void> {
    return this.network.request(() => {
      this.findBlock(blockId);
      const started = this.db
        .tables()
        .assignments.some((row) => row.blockId === blockId && this.studentsOf(row.id) > 0);
      if (started) {
        throw new DataError('invalid', 'A block somebody started keeps their attempts');
      }
      this.db.update('classBlocks', (rows) => rows.filter((row) => row.id !== blockId));
      this.db.update('assignments', (rows) => rows.filter((row) => row.blockId !== blockId));
    });
  }

  reorderBlocks(groupId: string, blockIds: readonly string[]): Promise<void> {
    return this.network.request(() => {
      this.findGroup(groupId);
      const blocks = this.db.tables().classBlocks.filter((block) => block.groupId === groupId);
      const positions = newPositions(blocks, blockIds);
      this.db.update('classBlocks', (rows) => rows.map((row) => withPosition(row, positions)));
    });
  }

  assign(blockId: string, exerciseIds: readonly string[]): Promise<ExerciseAssignment[]> {
    return this.network.request(() => {
      const block = this.findBlock(blockId);
      const tables = this.db.tables();
      exerciseIds.forEach((id) => findRow(tables.exercises, id));
      const current = tables.assignments.filter((row) => row.blockId === blockId);
      const all = [...current.map((row) => row.exerciseId), ...exerciseIds];
      if (new Set(all).size < all.length) {
        throw new DataError('invalid', 'An exercise is only once in a block');
      }
      const last = Math.max(0, ...current.map((row) => row.position));
      const created = exerciseIds.map((exerciseId, index): ExerciseAssignment => ({
        id: crypto.randomUUID(),
        groupId: block.groupId,
        blockId,
        exerciseId,
        position: last + index + 1,
        isHidden: false,
        dueAt: null,
      }));
      this.db.update('assignments', (rows) => [...rows, ...created]);
      return created;
    });
  }

  updateAssignment(assignmentId: string, changes: AssignmentChanges): Promise<ExerciseAssignment> {
    return this.network.request(() => {
      const assignment = { ...this.findAssignment(assignmentId), ...changes };
      this.db.update('assignments', (rows) =>
        rows.map((row) => (row.id === assignmentId ? assignment : row)),
      );
      return assignment;
    });
  }

  unassign(assignmentId: string): Promise<void> {
    return this.network.request(() => {
      this.findAssignment(assignmentId);
      if (this.studentsOf(assignmentId) > 0) {
        throw new DataError('invalid', 'An assignment somebody started keeps their attempts');
      }
      this.db.update('assignments', (rows) => rows.filter((row) => row.id !== assignmentId));
    });
  }

  reorderAssignments(blockId: string, assignmentIds: readonly string[]): Promise<void> {
    return this.network.request(() => {
      this.findBlock(blockId);
      const assignments = this.db.tables().assignments.filter((row) => row.blockId === blockId);
      const positions = newPositions(assignments, assignmentIds);
      this.db.update('assignments', (rows) => rows.map((row) => withPosition(row, positions)));
    });
  }

  /** The group, if the user manages it; any other is `not_found`, as the RLS hides its blocks. */
  private findGroup(groupId: string): ClassGroup {
    const user = this.db.requireUser('teacher', 'admin');
    const group = findRow(this.db.tables().groups, groupId);
    if (!canManageGroup(user, group)) {
      throw new DataError('not_found');
    }
    return group;
  }

  private findBlock(blockId: string): ClassBlock {
    const block = findRow(this.db.tables().classBlocks, blockId);
    this.findGroup(block.groupId);
    return block;
  }

  private findAssignment(assignmentId: string): ExerciseAssignment {
    const assignment = findRow(this.db.tables().assignments, assignmentId);
    this.findGroup(assignment.groupId);
    return assignment;
  }

  /** Students with an attempt at the assignment. */
  private studentsOf(assignmentId: string): number {
    const attempts = this.db.tables().attempts.filter((row) => row.assignmentId === assignmentId);
    return new Set(attempts.map((attempt) => attempt.userId)).size;
  }
}

function byPosition(a: { readonly position: number }, b: { readonly position: number }): number {
  return a.position - b.position;
}

function withPosition<Row extends { readonly id: string; readonly position: number }>(
  row: Row,
  positions: ReadonlyMap<string, number>,
): Row {
  const position = positions.get(row.id);
  return position === undefined ? row : { ...row, position };
}

/** The checks of `class_block`: neither the title nor a translation is blank. */
function checkTitles(draft: BlockDraft): void {
  const titles = [draft.title, ...Object.values(draft.translations).map((text) => text.title)];
  if (titles.some((title) => title.trim() === '')) {
    throw new DataError('invalid', 'A block needs a title in every language it has');
  }
}

/** The position of each row in `ids`, which must be every row once, as the reorder functions ask. */
function newPositions(
  rows: readonly { readonly id: string }[],
  ids: readonly string[],
): ReadonlyMap<string, number> {
  const known = new Set(rows.map((row) => row.id));
  if (
    new Set(ids).size !== ids.length ||
    ids.length !== known.size ||
    !ids.every((id) => known.has(id))
  ) {
    throw new DataError('invalid', 'The new order must have every row once');
  }
  return new Map(ids.map((id, index) => [id, index + 1]));
}
