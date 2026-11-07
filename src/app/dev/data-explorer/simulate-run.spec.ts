import { TestBed } from '@angular/core/testing';

import { exerciseId, testId } from '../../data/mock/fixtures/exercises';
import { DAW_STUDENT_IDS } from '../../data/mock/fixtures/users';
import { MockDb } from '../../data/mock/mock-db';
import { simulateRun } from './simulate-run';

const NOW = '2026-11-10T09:30:00.000Z';

describe('simulateRun', () => {
  let db: MockDb;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    db = TestBed.inject(MockDb);
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  /** Lucía's attempt at exercise 8, which the seed leaves in `passed`. */
  function luciaAttempt() {
    return db
      .tables()
      .attempts.find((a) => a.userId === DAW_STUDENT_IDS[0] && a.exerciseId === exerciseId(8))!;
  }

  it('marks the attempt as passed and records a run with every test passing', () => {
    const attempt = luciaAttempt();
    const others = db.tables().attempts.filter((a) => a.id !== attempt.id);

    const updated = simulateRun(db, attempt.id, true);

    expect(updated).toEqual({ ...attempt, status: 'passed', updatedAt: NOW });
    expect(db.tables().attempts.filter((a) => a.id !== attempt.id)).toEqual(others);
    expect(db.tables().events.at(-1)).toEqual({
      id: expect.any(String),
      attemptId: attempt.id,
      type: 'run',
      timestamp: NOW,
      detail: { passed: 5, failed: 0, failedTestIds: [] },
    });
  });

  it('marks the attempt with failed tests, the first test failing', () => {
    const attempt = luciaAttempt();

    expect(simulateRun(db, attempt.id, false).status).toBe('tests_failed');
    expect(db.tables().events.at(-1)?.detail).toEqual({
      passed: 4,
      failed: 1,
      failedTestIds: [testId(8, 0)],
    });
  });

  it('rejects a submitted attempt or an unknown one', () => {
    const submitted = db.tables().attempts.find((a) => a.status === 'submitted')!;

    expect(() => simulateRun(db, submitted.id, true)).toThrowError(
      expect.objectContaining({ kind: 'invalid' }),
    );
    expect(() => simulateRun(db, 'missing', true)).toThrowError(
      expect.objectContaining({ kind: 'not_found' }),
    );
  });
});
