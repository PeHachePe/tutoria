import { inject, Service } from '@angular/core';

import { DataError } from '../data-error';
import type {
  AssignedExercise,
  Exercise,
  ExerciseAssignment,
  ExerciseDetail,
  Test,
} from '../exercise';
import {
  type BankScope,
  type ExerciseBank,
  scopeSubjectIds,
  type ExerciseDraft,
  ExerciseService,
  type ExerciseUsage,
  type ExerciseWithTests,
  type TranslationRequest,
} from '../exercise-service';
import type { ContentLocale, ExerciseText } from '../localized-text';
import type { Subject } from '../subject';
import type { AppUser } from '../user';
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
import { isIdentifier } from '../exercise-names';

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
      return (
        tables.assignments
          .filter(
            (assignment) =>
              groupIds.has(assignment.groupId) && canSeeAssignment(tables, user, assignment),
          )
          // By group, block and place in the block, as the catalog shows them
          .sort(
            (a, b) =>
              a.groupId.localeCompare(b.groupId) ||
              findRow(tables.classBlocks, a.blockId).position -
                findRow(tables.classBlocks, b.blockId).position ||
              a.position - b.position,
          )
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
          })
      );
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

  listSubjects(): Promise<Subject[]> {
    return this.network.request(() => {
      this.db.requireUser('teacher', 'admin');
      return [...this.db.tables().subjects];
    });
  }

  listBank(scope: BankScope): Promise<ExerciseBank> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      const tables = this.db.tables();
      const mySubjectIds = [
        ...new Set(
          tables.groups.filter((group) => group.teacherId === user.id).map((g) => g.subjectId),
        ),
      ];
      const wanted = scopeSubjectIds(scope, mySubjectIds);
      const exercises = tables.exercises
        .filter(
          (exercise) =>
            wanted === null ||
            tables.exerciseSubjects.some(
              (row) => row.exerciseId === exercise.id && wanted.includes(row.subjectId),
            ),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((exercise) => ({
          exercise,
          subjectIds: this.subjectsOf(exercise.id),
          testCount: tables.tests.filter((test) => test.exerciseId === exercise.id).length,
          ...this.usageOf(user, exercise.id),
        }));
      return { exercises, subjects: [...tables.subjects], mySubjectIds };
    });
  }

  getWithTests(exerciseId: string): Promise<ExerciseWithTests> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      return {
        exercise: findRow(this.db.tables().exercises, exerciseId),
        tests: this.testsOf(exerciseId),
        subjectIds: this.subjectsOf(exerciseId),
        ...this.usageOf(user, exerciseId),
      };
    });
  }

  create(draft: ExerciseDraft): Promise<Exercise> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      checkNames(draft);
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
      this.replaceSubjects(exercise.id, draft);
      return exercise;
    });
  }

  update(exerciseId: string, draft: ExerciseDraft): Promise<Exercise> {
    return this.network.request(() => {
      const current = this.findEditable(exerciseId);
      checkNames(draft);
      const fields = exerciseFields(draft);
      const exercise: Exercise = {
        ...current,
        ...fields,
        updatedAt: now(),
      };
      this.db.update('exercises', (rows) =>
        rows.map((row) => (row.id === exerciseId ? exercise : row)),
      );
      this.replaceTests(exerciseId, draft);
      this.replaceSubjects(exerciseId, draft);
      return exercise;
    });
  }

  remove(exerciseId: string): Promise<void> {
    return this.network.request(() => {
      this.findEditable(exerciseId);
      const tables = this.db.tables();
      if (tables.attempts.some((attempt) => attempt.exerciseId === exerciseId)) {
        throw new DataError('invalid', 'An exercise with attempts keeps their history');
      }
      this.db.update('exercises', (rows) => rows.filter((row) => row.id !== exerciseId));
      this.db.update('tests', (rows) => rows.filter((row) => row.exerciseId !== exerciseId));
      this.db.update('exerciseSubjects', (rows) =>
        rows.filter((row) => row.exerciseId !== exerciseId),
      );
      this.db.update('assignments', (rows) => rows.filter((row) => row.exerciseId !== exerciseId));
    });
  }

  /**
   * Without a model, a draft from the data: the translation of an exercise with the same texts, as
   * those of the seed, or the original marked with the language, to review as the real one.
   */
  translate({ from, to, texts }: TranslationRequest): Promise<ExerciseText> {
    return this.network.request(() => {
      this.db.requireUser('teacher', 'admin');
      for (const exercise of this.db.tables().exercises) {
        const original = textIn(exercise, from);
        const translation = textIn(exercise, to);
        if (translation && original && sameText(original, texts)) return translation;
      }
      return { ...texts, title: `[${to}] ${texts.title}` };
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
      dueAt: assignment.dueAt,
    };
  }

  private testsOf(exerciseId: string): Test[] {
    return this.db
      .tables()
      .tests.filter((test) => test.exerciseId === exerciseId)
      .sort((a, b) => a.position - b.position);
  }

  private subjectsOf(exerciseId: string): string[] {
    return this.db
      .tables()
      .exerciseSubjects.filter((row) => row.exerciseId === exerciseId)
      .map((row) => row.subjectId);
  }

  /** Like the RLS: the students of every group count, but only the user's groups are named. */
  private usageOf(user: AppUser, exerciseId: string): ExerciseUsage {
    const tables = this.db.tables();
    const students = tables.attempts
      .filter((attempt) => attempt.exerciseId === exerciseId)
      .map((attempt) => attempt.userId);
    const groupIds = new Set(
      tables.assignments.filter((a) => a.exerciseId === exerciseId).map((a) => a.groupId),
    );
    const groups = tables.groups
      .filter((group) => groupIds.has(group.id) && canManageGroup(user, group))
      .map(({ id, name }) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { studentCount: new Set(students).size, groups };
  }

  /** Only its author or the administration changes or deletes an exercise (D-057). */
  private findEditable(exerciseId: string): Exercise {
    const user = this.db.requireUser('teacher', 'admin');
    const exercise = findRow(this.db.tables().exercises, exerciseId);
    if (user.role !== 'admin' && exercise.createdBy !== user.id) {
      throw new DataError('forbidden');
    }
    return exercise;
  }

  private replaceSubjects(exerciseId: string, draft: ExerciseDraft): void {
    this.db.update('exerciseSubjects', (rows) => [
      ...rows.filter((row) => row.exerciseId !== exerciseId),
      ...draft.subjectIds.map((subjectId) => ({ exerciseId, subjectId })),
    ]);
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
    parameters,
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
    parameters,
    maxRepeatedFailures,
    maxIdleMinutes,
  };
}

/** The checks of `exercise`: the function and its parameters are distinct identifiers. */
function checkNames(draft: ExerciseDraft): void {
  const names = [draft.functionName, ...draft.parameters];
  if (!names.every(isIdentifier) || new Set(draft.parameters).size < draft.parameters.length) {
    throw new DataError('invalid', 'The function and its parameters need distinct identifiers');
  }
}

/** The texts of an exercise in `locale`, if it has them. */
function textIn(exercise: Exercise, locale: ContentLocale): ExerciseText | undefined {
  if (exercise.sourceLocale !== locale) return exercise.translations[locale];
  const { title, statement, topics } = exercise;
  return { title, statement, topics };
}

function sameText(a: ExerciseText, b: ExerciseText): boolean {
  return a.title.trim() === b.title.trim() && a.statement.trim() === b.statement.trim();
}
