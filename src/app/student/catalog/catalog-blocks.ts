import type { AttemptStatus } from '../../data/attempt';
import type { AssignedExercise, AssignedGroup, ClassBlock } from '../../data/exercise';

/** The exercises of one group of the student: a tab of the catalog (2.5c). */
export interface CatalogGroup {
  readonly group: AssignedGroup;
  readonly entries: readonly AssignedExercise[];
}

/** The exercises of one block of the catalog. */
export interface CatalogBlock {
  readonly block: ClassBlock;
  readonly entries: readonly AssignedExercise[];
  /** How many of them are passed (D-027). */
  readonly passed: number;
  /** Every exercise of the block is submitted: the catalog folds it away at first. */
  readonly complete: boolean;
}

/** Where the student picks up: the open attempt changed last or, without one, the next exercise. */
export interface NextExercise {
  readonly entry: AssignedExercise;
  readonly kind: 'resume' | 'start';
}

/** Open attempts: started and not submitted. */
export function isOpen(status: AttemptStatus): boolean {
  return status !== 'not_started' && status !== 'submitted';
}

/** «Superados» counts the exercises that passed every test, submitted or not yet (D-027). */
export function isPassed(status: AttemptStatus): boolean {
  return status === 'passed' || status === 'submitted';
}

/**
 * The attempt the student works on: the practice while it is open, otherwise the one that counts.
 * It decides the button of the card and where the student picks up.
 */
export function currentAttempt(entry: AssignedExercise): {
  readonly status: AttemptStatus;
  readonly updatedAt: string | null;
} {
  const { practice } = entry;
  return practice && isOpen(practice.status)
    ? { status: practice.status, updatedAt: practice.updatedAt }
    : { status: entry.status, updatedAt: entry.updatedAt };
}

/** How many exercises are in each status, for the counters of the catalog. */
export function countByStatus(
  entries: readonly AssignedExercise[],
): Readonly<Record<AttemptStatus, number>> {
  const counts: Record<AttemptStatus, number> = {
    not_started: 0,
    in_progress: 0,
    tests_failed: 0,
    passed: 0,
    submitted: 0,
  };
  for (const entry of entries) {
    counts[entry.status]++;
  }
  return counts;
}

/** The exercise the catalog suggests, or null when everything is submitted. */
export function nextExercise(entries: readonly AssignedExercise[]): NextExercise | null {
  const open = entries
    .map((entry) => ({ entry, ...currentAttempt(entry) }))
    .filter(({ status }) => isOpen(status))
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  if (open.length > 0) {
    return { entry: open[0].entry, kind: 'resume' };
  }
  const fresh = entries.find((entry) => entry.status === 'not_started');
  return fresh ? { entry: fresh, kind: 'start' } : null;
}

/** The exercises by group, in the order the groups first appear, keeping the order of the service. */
export function groupByGroup(entries: readonly AssignedExercise[]): CatalogGroup[] {
  const byGroup = new Map<string, { group: AssignedGroup; entries: AssignedExercise[] }>();
  for (const entry of entries) {
    const found = byGroup.get(entry.group.id);
    if (found) {
      found.entries.push(entry);
    } else {
      byGroup.set(entry.group.id, { group: entry.group, entries: [entry] });
    }
  }
  return [...byGroup.values()];
}

/**
 * The exercises of a group by block, in the order of the blocks. Inside a block they keep the order
 * of the service, so the catalog does not depend on the order the data arrives in.
 */
export function groupByBlock(entries: readonly AssignedExercise[]): CatalogBlock[] {
  const byBlock = new Map<string, { block: ClassBlock; entries: AssignedExercise[] }>();
  for (const entry of entries) {
    const found = byBlock.get(entry.block.id);
    if (found) {
      found.entries.push(entry);
    } else {
      byBlock.set(entry.block.id, { block: entry.block, entries: [entry] });
    }
  }
  return [...byBlock.values()]
    .sort((a, b) => a.block.position - b.block.position)
    .map(({ block, entries: blockEntries }) => ({
      block,
      entries: blockEntries,
      passed: blockEntries.filter((entry) => isPassed(entry.status)).length,
      complete: blockEntries.every((entry) => entry.status === 'submitted'),
    }));
}

/**
 * After submitting, the next exercise of the same block not submitted yet: those after it first,
 * then those before. Null when the rest of the block is submitted.
 */
export function nextInBlock(
  entries: readonly AssignedExercise[],
  assignmentId: string,
): AssignedExercise | null {
  const current = entries.find((entry) => entry.assignmentId === assignmentId);
  if (!current) return null;
  const block = entries.filter((entry) => entry.block.id === current.block.id);
  const index = block.indexOf(current);
  const ordered = [...block.slice(index + 1), ...block.slice(0, index)];
  return ordered.find((entry) => entry.status !== 'submitted') ?? null;
}
