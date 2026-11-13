import type { Attempt, AttemptHistory } from './attempt';
import type { ClassBlock, Exercise, Test } from './exercise';
import type { ProcessEvent } from './process-event';
import type { Subject } from './subject';
import type { TutorInteraction } from './tutor';

/** A group the teacher follows live, with what its selectors need. */
export interface LiveGroup {
  readonly id: string;
  readonly name: string;
  readonly subject: Subject;
  /** Every block of the group in order, hidden ones included: the teacher sees them all. */
  readonly blocks: readonly ClassBlock[];
  /** The block of the attempt that changed last, or null if nobody has started yet. */
  readonly latestBlockId: string | null;
}

/** A student of the group. */
export interface LiveStudent {
  readonly id: string;
  readonly name: string;
}

/** An exercise of the block, as the panel reads it. */
export interface LiveExercise {
  readonly assignmentId: string;
  /** With its thresholds, which decide when a student is stuck (2.7). */
  readonly exercise: Exercise;
  /** Visible and hidden tests, in order: the teacher sees which one the class fails. */
  readonly tests: readonly Test[];
}

/** What a block of a group looks like now: the starting point of the live updates. */
export interface LiveSnapshot {
  /** Sorted by name. */
  readonly students: readonly LiveStudent[];
  /** In the order of the block. */
  readonly exercises: readonly LiveExercise[];
  /** Every attempt at the assignments of the block, practice included. */
  readonly attempts: readonly Attempt[];
  readonly events: readonly ProcessEvent[];
}

/** A change in a group while the teacher watches it. */
export type LiveUpdate =
  | { readonly type: 'attempt'; readonly attempt: Attempt }
  | { readonly type: 'event'; readonly event: ProcessEvent }
  /** What the student asked the tutor and its answer, for the detail of the attempt (4.2). */
  | { readonly type: 'interaction'; readonly interaction: TutorInteraction };

/**
 * An attempt with all the teacher needs to read how it went (RF-12): whose it is, the exercise
 * with its tests, where it was assigned, and its events and tutor interactions in order.
 */
export interface LiveAttemptDetail extends AttemptHistory {
  readonly groupId: string;
  readonly blockId: string;
  readonly student: LiveStudent;
  readonly exercise: LiveExercise;
}

/**
 * Live activity of the groups of a teacher (RF-11). Abstract class without a decorator: it is the
 * injection token (4.2, D-005).
 */
export abstract class LiveService {
  /** The groups of the teacher, or every group for an administrator, sorted by name and subject. */
  abstract listGroups(): Promise<LiveGroup[]>;

  /** The students, exercises, attempts and events of a block. */
  abstract snapshot(groupId: string, blockId: string): Promise<LiveSnapshot>;

  /**
   * An attempt at an assignment of a group of the teacher, with its events and interactions in
   * order. Throws `DataError('not_found')` for any other, as the RLS hides it.
   */
  abstract attemptDetail(attemptId: string): Promise<LiveAttemptDetail>;

  /**
   * Calls `onUpdate` with each attempt that changes and each new event and tutor interaction the
   * teacher can see; the caller keeps those of the group. Returns the function that stops watching.
   */
  abstract watch(groupId: string, onUpdate: (update: LiveUpdate) => void): () => void;
}
