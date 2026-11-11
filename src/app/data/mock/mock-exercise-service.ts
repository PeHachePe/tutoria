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
import type { HintLevel, TutorInteraction } from '../tutor';
import { canManageGroup, enrolledGroupIds, findRow, now } from './mock-access';
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
        .filter((assignment) => groupIds.has(assignment.groupId))
        .sort((a, b) => a.session - b.session)
        .map((assignment) => {
          const attempt = tables.attempts
            .filter((a) => a.userId === userId && a.exerciseId === assignment.exerciseId)
            .at(-1);
          const interactions = attempt
            ? tables.interactions.filter((i) => i.attemptId === attempt.id)
            : [];
          return {
            exercise: findRow(tables.exercises, assignment.exerciseId),
            assignmentId: assignment.id,
            session: assignment.session,
            sessionTitle:
              tables.classSessions.find(
                (s) => s.groupId === assignment.groupId && s.number === assignment.session,
              )?.title ?? null,
            updatedAt: attempt?.updatedAt ?? null,
            status: attempt?.status ?? 'not_started',
            hintCount: interactions.filter((i) => i.trigger === 'hint').length,
            hintLevel: highestLevel(interactions),
          };
        });
    });
  }

  getDetail(exerciseId: string): Promise<ExerciseDetail> {
    return this.network.request(() => {
      const user = this.db.requireUser();
      const tables = this.db.tables();
      const exercise = findRow(tables.exercises, exerciseId);
      const groupIds = enrolledGroupIds(tables, user.id);
      const assigned = tables.assignments.some(
        (assignment) => assignment.exerciseId === exerciseId && groupIds.has(assignment.groupId),
      );
      if (user.role === 'student' && !assigned) {
        throw new DataError('not_found');
      }
      const tests = this.testsOf(exerciseId);
      return {
        exercise,
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
        .sort((a, b) => a.session - b.session);
    });
  }

  assign(assignment: Omit<ExerciseAssignment, 'id'>): Promise<ExerciseAssignment> {
    return this.network.request(() => {
      this.requireGroupManager(assignment.groupId);
      const tables = this.db.tables();
      findRow(tables.exercises, assignment.exerciseId);
      const repeated = tables.assignments.some(
        (row) =>
          row.groupId === assignment.groupId &&
          row.exerciseId === assignment.exerciseId &&
          row.session === assignment.session,
      );
      if (repeated) {
        throw new DataError('invalid', 'The exercise is already assigned to that session');
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
/** Highest hint level among the tutor's answers to an attempt, or null without any. */
function highestLevel(interactions: readonly TutorInteraction[]): HintLevel | null {
  return interactions.reduce<HintLevel | null>(
    (level, interaction) =>
      level === null || interaction.hintLevel > level ? interaction.hintLevel : level,
    null,
  );
}

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
