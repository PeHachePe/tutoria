import type { AssignedGroup, ClassBlock, Exercise, ExerciseAssignment } from './exercise';
import type { ContentLocale } from './localized-text';

/** A block as the teacher edits it: its title in the language they write in and its translations. */
export interface BlockDraft {
  readonly title: string;
  readonly sourceLocale: ContentLocale;
  readonly translations: ClassBlock['translations'];
  readonly isHidden: boolean;
}

/** What the teacher changes of an assignment besides its order. */
export interface AssignmentChanges {
  readonly isHidden?: boolean;
  /** ISO date, or null to remove it. */
  readonly dueAt?: string | null;
}

/** An exercise of a block, with how many students started it there: then it cannot be removed. */
export interface PlannedAssignment {
  readonly assignment: ExerciseAssignment;
  readonly exercise: Exercise;
  /** Students with an attempt at this assignment, practice aside. */
  readonly studentCount: number;
}

/** A block of the group with its exercises, both in order. */
export interface PlannedBlock {
  readonly block: ClassBlock;
  readonly assignments: readonly PlannedAssignment[];
}

/**
 * The blocks of a group and what is assigned in them (4.3b, D-046). Abstract class without a
 * decorator: it is the injection token (4.2, D-005). Only the teacher of the group or the
 * administration changes them, and only what nobody started is deleted (D-058).
 */
export abstract class BlockService {
  /** The groups the user teaches, or every group for an administrator, by name and subject. */
  abstract listGroups(): Promise<AssignedGroup[]>;

  /** Every block of the group, hidden ones included, with its exercises. `not_found` for others. */
  abstract listBlocks(groupId: string): Promise<PlannedBlock[]>;

  /** A new block after the others. */
  abstract createBlock(groupId: string, draft: BlockDraft): Promise<ClassBlock>;

  abstract updateBlock(blockId: string, draft: BlockDraft): Promise<ClassBlock>;

  /** With its assignments. `invalid` if a student started any of them: hide it instead. */
  abstract removeBlock(blockId: string): Promise<void>;

  /** `blockIds` are every block of the group in the new order. */
  abstract reorderBlocks(groupId: string, blockIds: readonly string[]): Promise<void>;

  /** Assigns the exercises after those of the block, in the order given, visible and without date. */
  abstract assign(blockId: string, exerciseIds: readonly string[]): Promise<ExerciseAssignment[]>;

  abstract updateAssignment(
    assignmentId: string,
    changes: AssignmentChanges,
  ): Promise<ExerciseAssignment>;

  /** `invalid` if a student started it: their attempts keep it. */
  abstract unassign(assignmentId: string): Promise<void>;

  /** `assignmentIds` are every assignment of the block in the new order. */
  abstract reorderAssignments(blockId: string, assignmentIds: readonly string[]): Promise<void>;
}
