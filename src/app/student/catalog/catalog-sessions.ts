import type { AttemptStatus } from '../../data/attempt';
import type { AssignedExercise } from '../../data/exercise';

/** The exercises of one session of the catalog. */
export interface CatalogSession {
  readonly session: number;
  readonly title: string | null;
  readonly entries: readonly AssignedExercise[];
  /** How many of them are passed (D-027). */
  readonly passed: number;
  /** Every exercise of the session is submitted: the catalog folds it away at first. */
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
    .filter((entry) => isOpen(entry.status))
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  if (open.length > 0) {
    return { entry: open[0], kind: 'resume' };
  }
  const fresh = entries.find((entry) => entry.status === 'not_started');
  return fresh ? { entry: fresh, kind: 'start' } : null;
}

/** «Superados» counts the exercises that passed every test, submitted or not yet (D-027). */
export function isPassed(status: AttemptStatus): boolean {
  return status === 'passed' || status === 'submitted';
}

/**
 * The assigned exercises grouped by session, in ascending order. Inside a session they keep the order
 * of the service, so the catalog does not depend on the order the data arrives in.
 */
export function groupBySession(entries: readonly AssignedExercise[]): CatalogSession[] {
  const bySession = new Map<number, AssignedExercise[]>();
  for (const entry of entries) {
    const session = bySession.get(entry.session);
    if (session) {
      session.push(entry);
    } else {
      bySession.set(entry.session, [entry]);
    }
  }
  return [...bySession]
    .sort(([a], [b]) => a - b)
    .map(([session, sessionEntries]) => {
      const passed = sessionEntries.filter((entry) => isPassed(entry.status)).length;
      return {
        session,
        title: sessionEntries[0].sessionTitle,
        entries: sessionEntries,
        passed,
        complete: sessionEntries.every((entry) => entry.status === 'submitted'),
      };
    });
}
