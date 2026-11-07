import type { Attempt } from '../../data/attempt';
import { DataError } from '../../data/data-error';
import { findRow, now } from '../../data/mock/mock-access';
import type { MockDb } from '../../data/mock/mock-db';

/**
 * Stands in for the code runner until step 1.5: marks the attempt as passed or with failed tests
 * and records the `run` event, as the server will. Mock data only; the failing test is the first one.
 */
export function simulateRun(db: MockDb, attemptId: string, passed: boolean): Attempt {
  const tables = db.tables();
  const attempt = findRow(tables.attempts, attemptId);
  if (attempt.status === 'submitted') {
    throw new DataError('invalid', 'A submitted attempt cannot run again');
  }
  const tests = tables.tests
    .filter((test) => test.exerciseId === attempt.exerciseId)
    .sort((a, b) => a.position - b.position);
  const failedTestIds = passed ? [] : tests.slice(0, 1).map((test) => test.id);
  const timestamp = now();
  const updated: Attempt = {
    ...attempt,
    status: passed ? 'passed' : 'tests_failed',
    updatedAt: timestamp,
  };
  db.update('attempts', (rows) => rows.map((row) => (row.id === attemptId ? updated : row)));
  db.update('events', (rows) => [
    ...rows,
    {
      id: crypto.randomUUID(),
      attemptId,
      type: 'run',
      timestamp,
      detail: {
        passed: tests.length - failedTestIds.length,
        failed: failedTestIds.length,
        failedTestIds,
      },
    },
  ]);
  return updated;
}
