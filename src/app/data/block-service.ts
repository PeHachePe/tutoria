import type { AssignedGroup, ClassBlock, Exercise, ExerciseAssignment } from './exercise';
import type { ContentLocale } from './localized-text';

/** A block as the teacher edits it: its title in the language they write in and its translations. */
export interface BlockDraft {
  readonly title: string;
  readonly sourceLocale: ContentLocale;
  readonly translations: ClassBlock['translations'];
  readonly isHidden: boolean;
  /** ISO date when its students start to see it, or null (4.3d). */
  readonly opensAt: string | null;
}

/** A group whose blocks the teacher plans, with its year: the same class of two years apart. */
export interface PlannedGroup extends AssignedGroup {
  readonly schoolYear: string;
  /**
   * Its class is open (5.2f, D-082): of this year or a later one, or reopened. The blocks of a
   * closed one are read only, and copied into another group.
   */
  readonly open: boolean;
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
 * administration changes them, only while its class is open (5.2f), and only what nobody started is
 * deleted (D-058). A closed group fails as each write fails in Supabase: `forbidden` to create,
 * assign, reorder, move or copy into it, `not_found` to change and `invalid` to delete.
 */
export abstract class BlockService {
  /** The groups the user teaches, or every group for an administrator, by name and subject. */
  abstract listGroups(): Promise<PlannedGroup[]>;

  /** Every block of the group, hidden ones included, with its exercises. `not_found` for others. */
  abstract listBlocks(groupId: string): Promise<PlannedBlock[]>;

  /** A new block after the others. */
  abstract createBlock(groupId: string, draft: BlockDraft): Promise<ClassBlock>;

  abstract updateBlock(blockId: string, draft: BlockDraft): Promise<ClassBlock>;

  /** With its assignments. `invalid` if a student started any of them: hide it instead. */
  abstract removeBlock(blockId: string): Promise<void>;

  /**
   * Several blocks at once, with their assignments (5.2f): those nobody started. How many were
   * deleted; the others (started, or of a closed class) stay, as the RLS leaves them.
   */
  abstract removeBlocks(blockIds: readonly string[]): Promise<number>;

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

  /**
   * Moves the assignment to `position` (1-based, up to one after the last) of another block of its
   * group (4.3d), started or not: the attempts keep pointing to it. `invalid` if the exercise is
   * already in that block.
   */
  /**
   * The blocks of another group after those of this one (5.2c, D-079), in their order, with their
   * exercises, order, visibility and translations; with their dates moved to the year of this group
   * in whole weeks, or without them. How many blocks were copied. `not_found` for a group of others
   * and `invalid` for the same group.
   */
  abstract copyBlocks(
    sourceGroupId: string,
    targetGroupId: string,
    withDates: boolean,
  ): Promise<number>;

  abstract moveAssignment(
    assignmentId: string,
    blockId: string,
    position: number,
  ): Promise<ExerciseAssignment>;
}
