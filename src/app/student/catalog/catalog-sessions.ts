import type { AttemptStatus } from '../../data/attempt';
import type { AssignedExercise } from '../../data/exercise';

/** The exercises of one session of the catalog. */
export interface CatalogSession {
  readonly session: number;
  readonly entries: readonly AssignedExercise[];
  /** How many of them are passed (D-027). */
  readonly passed: number;
  /** Every exercise of the session is passed: the catalog folds it away at first. */
  readonly complete: boolean;
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
        entries: sessionEntries,
        passed,
        complete: passed === sessionEntries.length,
      };
    });
}
