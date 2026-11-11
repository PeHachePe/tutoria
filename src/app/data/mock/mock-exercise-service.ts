import { inject, Service } from '@angular/core';

import { DataError } from '../data-error';
import type {
  AssignedExercise,
  Exercise,
  ExerciseAssignment,
  ExerciseDetail,
  Test,
} from '../exercise';
import { ExerciseDraft, ExerciseService, ExerciseWithTests } from '../exercise-service';
import { type AssignmentCard, assignedExercise, summarizeAttempt } from '../attempt-progress';
import {
  canManageGroup,
  canSeeAssignment,
  enrolledGroupIds,
  findRow,
  findVisibleAssignment,
  now,
} from './mock-access';
import { MockDb } from './mock-db';
import { MockNetwork } from './mock-network';

/** Exercises, tests and assignments in MockDb. The bank is shared by every teacher (2.3). */
@Service({ autoProvided: false })
export class MockExerciseService extends ExerciseService {
  private readonly db = inject(MockDb);
  private readonly network = inject(MockNetwork);

  listAssigned(userId: string): Promise<AssignedExercise[]> {
    return this.network.request(() => {
      const user = this.db.requireUser();
      if (user.role === 'student' && user.id !== userId) {
        throw new DataError('forbidden');
      }
      const tables = this.db.tables();
      const groupIds = enrolledGroupIds(tables, userId);
      return tables.assignments
        .filter(
          (assignment) =>
            groupIds.has(assignment.groupId) && canSeeAssignment(tables, user, assignment),
        )
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((assignment) => {
          const attempts = tables.attempts
            .filter((a) => a.userId === userId && a.assignmentId === assignment.id)
            .map((attempt) =>
              summarizeAttempt(
                attempt,
                tables.interactions.filter((i) => i.attemptId === attempt.id),
              ),
            );
          return assignedExercise(this.card(assignment), attempts);
        });
    });
  }

  getDetail(assignmentId: string): Promise<ExerciseDetail> {
    return this.network.request(() => {
      const user = this.db.requireUser();
      const assignment = findVisibleAssignment(this.db.tables(), user, assignmentId);
      const tests = this.testsOf(assignment.exerciseId);
      return {
        ...this.card(assignment),
        visibleTests: tests.filter((test) => !test.isHidden),
        hiddenTestCount: tests.filter((test) => test.isHidden).length,
      };
    });
  }

  list(): Promise<Exercise[]> {
    return this.network.request(() => {
      this.db.requireUser('teacher', 'admin');
      return [...this.db.tables().exercises];
    });
  }

  getWithTests(exerciseId: string): Promise<ExerciseWithTests> {
    return this.network.request(() => {
      this.db.requireUser('teacher', 'admin');
      return {
        exercise: findRow(this.db.tables().exercises, exerciseId),
        tests: this.testsOf(exerciseId),
      };
    });
  }

  create(draft: ExerciseDraft): Promise<Exercise> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      const createdAt = now();
      const fields = exerciseFields(draft);
      const exercise: Exercise = {
        id: crypto.randomUUID(),
        ...fields,
        language: 'javascript',
        createdBy: user.id,
        createdAt,
        updatedAt: createdAt,
      };
      this.db.update('exercises', (rows) => [...rows, exercise]);
      this.replaceTests(exercise.id, draft);
      return exercise;
    });
  }

  update(exerciseId: string, draft: ExerciseDraft): Promise<Exercise> {
    return this.network.request(() => {
      this.db.requireUser('teacher', 'admin');
      const fields = exerciseFields(draft);
      const exercise: Exercise = {
        ...findRow(this.db.tables().exercises, exerciseId),
        ...fields,
        updatedAt: now(),
      };
      this.db.update('exercises', (rows) =>
        rows.map((row) => (row.id === exerciseId ? exercise : row)),
      );
      this.replaceTests(exerciseId, draft);
      return exercise;
    });
  }

  remove(exerciseId: string): Promise<void> {
    return this.network.request(() => {
      this.db.requireUser('teacher', 'admin');
      const tables = this.db.tables();
      findRow(tables.exercises, exerciseId);
      if (tables.attempts.some((attempt) => attempt.exerciseId === exerciseId)) {
        throw new DataError('invalid', 'An exercise with attempts keeps their history');
      }
      this.db.update('exercises', (rows) => rows.filter((row) => row.id !== exerciseId));
      this.db.update('tests', (rows) => rows.filter((row) => row.exerciseId !== exerciseId));
      this.db.update('assignments', (rows) => rows.filter((row) => row.exerciseId !== exerciseId));
    });
  }

  listAssignments(groupId: string): Promise<ExerciseAssignment[]> {
    return this.network.request(() => {
      this.requireGroupManager(groupId);
      return this.db
        .tables()
        .assignments.filter((assignment) => assignment.groupId === groupId)
        .sort((a, b) => a.id.localeCompare(b.id));
    });
  }

  assign(assignment: Omit<ExerciseAssignment, 'id'>): Promise<ExerciseAssignment> {
    return this.network.request(() => {
      this.requireGroupManager(assignment.groupId);
      const tables = this.db.tables();
      findRow(tables.exercises, assignment.exerciseId);
      if (findRow(tables.classBlocks, assignment.blockId).groupId !== assignment.groupId) {
        throw new DataError('invalid', 'The block is of another group');
      }
      const repeated = tables.assignments.some(
        (row) => row.blockId === assignment.blockId && row.exerciseId === assignment.exerciseId,
      );
      if (repeated) {
        throw new DataError('invalid', 'The exercise is already in that block');
      }
      const created: ExerciseAssignment = { id: crypto.randomUUID(), ...assignment };
      this.db.update('assignments', (rows) => [...rows, created]);
      return created;
    });
  }

  unassign(assignmentId: string): Promise<void> {
    return this.network.request(() => {
      const assignment = findRow(this.db.tables().assignments, assignmentId);
      this.requireGroupManager(assignment.groupId);
      this.db.update('assignments', (rows) => rows.filter((row) => row.id !== assignmentId));
      // Like `on delete set null`: the attempts and their history stay.
      this.db.update('attempts', (rows) =>
        rows.map((row) =>
          row.assignmentId === assignmentId ? { ...row, assignmentId: null } : row,
        ),
      );
    });
  }

  /** The exercise of the assignment, with its group, subject and block. */
  private card(assignment: ExerciseAssignment): AssignmentCard {
    const tables = this.db.tables();
    const group = findRow(tables.groups, assignment.groupId);
    return {
      exercise: findRow(tables.exercises, assignment.exerciseId),
      assignmentId: assignment.id,
      group: { id: group.id, name: group.name, subject: findRow(tables.subjects, group.subjectId) },
      block: findRow(tables.classBlocks, assignment.blockId),
    };
  }

  private testsOf(exerciseId: string): Test[] {
    return this.db
      .tables()
      .tests.filter((test) => test.exerciseId === exerciseId)
      .sort((a, b) => a.position - b.position);
  }

  private replaceTests(exerciseId: string, draft: ExerciseDraft): void {
    const tests: Test[] = draft.tests.map((test) => ({
      ...test,
      id: crypto.randomUUID(),
      exerciseId,
    }));
    this.db.update('tests', (rows) => [
      ...rows.filter((row) => row.exerciseId !== exerciseId),
      ...tests,
    ]);
  }

  private requireGroupManager(groupId: string): void {
    const user = this.db.requireUser();
    if (!canManageGroup(user, findRow(this.db.tables().groups, groupId))) {
      throw new DataError('forbidden');
    }
  }
}

/** The columns of `exercise` that the teacher edits; the tests go to their own table. */
function exerciseFields(draft: ExerciseDraft) {
  const {
    title,
    statement,
    difficulty,
    topics,
    sourceLocale,
    translations,
    functionName,
    maxRepeatedFailures,
    maxIdleMinutes,
  } = draft;
  return {
    title,
    statement,
    difficulty,
    topics,
    sourceLocale,
    translations,
    functionName,
    maxRepeatedFailures,
    maxIdleMinutes,
  };
}
