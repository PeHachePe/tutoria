import { inject, Service } from '@angular/core';

import type { Attempt, AttemptHistory } from '../attempt';
import { AttemptService } from '../attempt-service';
import { DataError } from '../data-error';
import type { ExerciseAssignment } from '../exercise';
import {
  canSeeStudentData,
  findOwnAttempt,
  findRow,
  findVisibleAssignment,
  now,
} from './mock-access';
import { MockDb } from './mock-db';
import { MockNetwork } from './mock-network';

/** Attempts in MockDb. Applies the status transitions of 2.4, as the server will. */
@Service({ autoProvided: false })
export class MockAttemptService extends AttemptService {
  private readonly db = inject(MockDb);
  private readonly network = inject(MockNetwork);

  openOrCreate(assignmentId: string, number?: number): Promise<Attempt> {
    return this.network.request(() => {
      const user = this.db.requireUser();
      const assignment = findVisibleAssignment(this.db.tables(), user, assignmentId);
      const own = this.ownAt(assignmentId);
      if (number !== undefined) {
        const found = own.find((attempt) => attempt.number === number);
        if (!found) throw new DataError('not_found');
        return found;
      }
      return own.at(-1) ?? this.create(assignment, 1);
    });
  }

  list(assignmentId: string): Promise<Attempt[]> {
    return this.network.request(() => this.ownAt(assignmentId));
  }

  retry(assignmentId: string): Promise<Attempt> {
    return this.network.request(() => {
      const user = this.db.requireUser();
      const assignment = findVisibleAssignment(this.db.tables(), user, assignmentId);
      const latest = this.ownAt(assignmentId).at(-1);
      if (!latest) {
        throw new DataError('invalid', 'Only a submitted attempt can be practised again');
      }
      // Still open: another tab practised first, so both take the same attempt
      return latest.status === 'submitted' ? this.create(assignment, latest.number + 1) : latest;
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

  /** The signed-in user's attempts at the assignment, by number. */
  private ownAt(assignmentId: string): Attempt[] {
    const user = this.db.requireUser();
    return this.db
      .tables()
      .attempts.filter(
        (attempt) => attempt.userId === user.id && attempt.assignmentId === assignmentId,
      )
      .sort((a, b) => a.number - b.number);
  }

  /** A new attempt in `in_progress`, empty: the editor shows how to start as a placeholder. */
  private create(assignment: ExerciseAssignment, number: number): Attempt {
    const createdAt = now();
    const attempt: Attempt = {
      id: crypto.randomUUID(),
      exerciseId: assignment.exerciseId,
      userId: this.db.requireUser().id,
      assignmentId: assignment.id,
      number,
      currentCode: '',
      finalCode: null,
      status: 'in_progress',
      startedAt: createdAt,
      finishedAt: null,
      updatedAt: createdAt,
    };
    this.db.update('attempts', (rows) => [...rows, attempt]);
    return attempt;
  }

  private ownAttempt(attemptId: string): Attempt {
    return findOwnAttempt(this.db.tables(), this.db.requireUser(), attemptId);
  }

  private replace(attempt: Attempt): Attempt {
    this.db.update('attempts', (rows) =>
      rows.map((row) => (row.id === attempt.id ? attempt : row)),
    );
    return attempt;
  }
}
