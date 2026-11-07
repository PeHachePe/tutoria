import { inject, Service } from '@angular/core';

import type { Attempt, AttemptHistory } from '../attempt';
import { AttemptService } from '../attempt-service';
import { DataError } from '../data-error';
import { canSeeStudentData, enrolledGroupIds, findRow, now } from './mock-access';
import { MockDb } from './mock-db';
import { MockNetwork } from './mock-network';

/** Attempts in MockDb. Applies the status transitions of 2.4, as the server will. */
@Service({ autoProvided: false })
export class MockAttemptService extends AttemptService {
  private readonly db = inject(MockDb);
  private readonly network = inject(MockNetwork);

  openOrCreate(exerciseId: string): Promise<Attempt> {
    return this.network.request(() => {
      const user = this.db.requireUser();
      const tables = this.db.tables();
      const exercise = findRow(tables.exercises, exerciseId);
      const existing = tables.attempts
        .filter((attempt) => attempt.userId === user.id && attempt.exerciseId === exerciseId)
        .at(-1);
      if (existing) {
        return existing;
      }
      const groupIds = enrolledGroupIds(tables, user.id);
      const assignment = tables.assignments.find(
        (candidate) => candidate.exerciseId === exerciseId && groupIds.has(candidate.groupId),
      );
      if (user.role === 'student' && !assignment) {
        throw new DataError('not_found');
      }
      const createdAt = now();
      const attempt: Attempt = {
        id: crypto.randomUUID(),
        exerciseId,
        userId: user.id,
        assignmentId: assignment?.id ?? null,
        currentCode: `// Escribe aquí la función ${exercise.functionName}\n`,
        finalCode: null,
        status: 'in_progress',
        startedAt: createdAt,
        finishedAt: null,
        updatedAt: createdAt,
      };
      this.db.update('attempts', (rows) => [...rows, attempt]);
      return attempt;
    });
  }

  saveCode(attemptId: string, code: string): Promise<Attempt> {
    return this.network.request(() => {
      const attempt = this.ownAttempt(attemptId);
      if (attempt.status === 'submitted') {
        throw new DataError('invalid', 'A submitted attempt cannot change');
      }
      if (code === attempt.currentCode) {
        return attempt;
      }
      // Editing invalidates the last run, as the server trigger will do.
      return this.replace({
        ...attempt,
        currentCode: code,
        status: 'in_progress',
        updatedAt: now(),
      });
    });
  }

  submit(attemptId: string): Promise<Attempt> {
    return this.network.request(() => {
      const attempt = this.ownAttempt(attemptId);
      if (attempt.status !== 'passed') {
        throw new DataError('invalid', 'Only a passed attempt can be submitted');
      }
      const submittedAt = now();
      this.db.update('events', (rows) => [
        ...rows,
        {
          id: crypto.randomUUID(),
          attemptId,
          type: 'submit',
          timestamp: submittedAt,
          detail: null,
        },
      ]);
      return this.replace({
        ...attempt,
        status: 'submitted',
        finalCode: attempt.currentCode,
        finishedAt: submittedAt,
        updatedAt: submittedAt,
      });
    });
  }

  history(attemptId: string): Promise<AttemptHistory> {
    return this.network.request(() => {
      const user = this.db.requireUser();
      const tables = this.db.tables();
      const attempt = findRow(tables.attempts, attemptId);
      if (!canSeeStudentData(tables, user, attempt.userId)) {
        throw new DataError('not_found');
      }
      return {
        attempt,
        events: tables.events
          .filter((event) => event.attemptId === attemptId)
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
        interactions: tables.interactions
          .filter((interaction) => interaction.attemptId === attemptId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      };
    });
  }

  /** The signed-in user's attempt; anybody else's is `not_found`, as row level security hides it. */
  private ownAttempt(attemptId: string): Attempt {
    const user = this.db.requireUser();
    const attempt = findRow(this.db.tables().attempts, attemptId);
    if (attempt.userId !== user.id) {
      throw new DataError('not_found');
    }
    return attempt;
  }

  private replace(attempt: Attempt): Attempt {
    this.db.update('attempts', (rows) =>
      rows.map((row) => (row.id === attempt.id ? attempt : row)),
    );
    return attempt;
  }
}
