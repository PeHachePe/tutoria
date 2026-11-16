import { inject, Service } from '@angular/core';

import { assignedExercise, type AttemptSummary, summarizeAttempt } from '../attempt-progress';
import { DataError } from '../data-error';
import type { AssignedExercise, AssignedGroup, Exercise, ExerciseDetail } from '../exercise';
import {
  type BankExercise,
  type BankScope,
  type ExerciseBank,
  type ExerciseDraft,
  ExerciseService,
  type ExerciseUsage,
  type ExerciseWithTests,
  scopeSubjectIds,
  type TranslationRequest,
} from '../exercise-service';
import type { ExerciseText } from '../localized-text';
import type { Subject } from '../subject';
import type { HintLevel } from '../tutor';
import type { Json } from './database.types';
import { SUPABASE_CLIENT } from './supabase-client';
import { toFunctionDataError, unwrap } from './supabase-error';
import {
  type Row,
  toClassBlock,
  toExercise,
  toIso,
  toIsoOrNull,
  toSubject,
  toTest,
} from './supabase-rows';

/** The Edge Function that drafts a translation (`supabase/functions/translate`). */
export const TRANSLATE_FUNCTION = 'translate';

/**
 * Exercises, tests and assignments in Supabase. The RLS decides what each user reads (2.1): a
 * student only gets the exercises assigned to their groups and their visible tests.
 */
@Service({ autoProvided: false })
export class SupabaseExerciseService extends ExerciseService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  /**
   * Two requests at once, whatever the number of cards: the assignments the student sees (the RLS
   * leaves out the hidden ones), with their exercise, block, group and subject, and the student's
   * attempts, with what the tutor answered in them.
   */
  async listAssigned(userId: string): Promise<AssignedExercise[]> {
    const [assignments, attempts] = await Promise.all([
      this.supabase
        .from('exercise_assignment')
        .select(
          'id, due_at, exercise(*), class_block(*), class_group!inner(id, name, subject(*), enrollment!inner(user_id))',
        )
        .eq('class_group.enrollment.user_id', userId)
        .order('position'),
      this.supabase
        .from('attempt')
        .select('assignment_id, number, status, updated_at, tutor_interaction(trigger, hint_level)')
        .eq('user_id', userId),
    ]);
    const attemptsOf = new Map<string, AttemptSummary[]>();
    for (const attempt of unwrap(attempts)) {
      if (attempt.assignment_id === null) continue;
      const summary = summarizeAttempt(
        { number: attempt.number, status: attempt.status, updatedAt: toIso(attempt.updated_at) },
        attempt.tutor_interaction.map(({ trigger, hint_level }) => ({
          trigger,
          // Checks of the table keep it between 1 and 3
          hintLevel: hint_level as HintLevel,
        })),
      );
      attemptsOf.set(attempt.assignment_id, [
        ...(attemptsOf.get(attempt.assignment_id) ?? []),
        summary,
      ]);
    }
    return unwrap(assignments).map((assignment) =>
      assignedExercise(
        {
          exercise: toExercise(assignment.exercise),
          assignmentId: assignment.id,
          group: toAssignedGroup(assignment.class_group),
          block: toClassBlock(assignment.class_block),
          dueAt: toIsoOrNull(assignment.due_at),
        },
        attemptsOf.get(assignment.id) ?? [],
      ),
    );
  }

  /**
   * The assignment with its exercise, its visible tests, its block and its group; then how many
   * hidden tests it has, which needs the exercise.
   */
  async getDetail(assignmentId: string): Promise<ExerciseDetail> {
    const assignment = unwrap(
      await this.supabase
        .from('exercise_assignment')
        .select(
          'id, due_at, exercise(*, test(*)), class_block(*), class_group(id, name, subject(*))',
        )
        .eq('id', assignmentId)
        .eq('exercise.test.is_hidden', false)
        .order('position', { referencedTable: 'exercise.test' })
        .single(),
    );
    const { test, ...exercise } = assignment.exercise;
    const hidden = unwrap(
      await this.supabase.rpc('hidden_test_count', { target_exercise_id: exercise.id }),
    );
    return {
      exercise: toExercise(exercise),
      assignmentId: assignment.id,
      group: toAssignedGroup(assignment.class_group),
      block: toClassBlock(assignment.class_block),
      dueAt: toIsoOrNull(assignment.due_at),
      visibleTests: test.map(toTest),
      hiddenTestCount: hidden,
    };
  }

  async listSubjects(): Promise<Subject[]> {
    return unwrap(await this.supabase.from('subject').select().order('name')).map(toSubject);
  }

  /**
   * First the subjects of the user's groups (the RLS gives a teacher only theirs), then, at once,
   * the exercises of the scope with how many tests they have, all their subjects and the groups of
   * the user where they are assigned; every subject; and how many students started each one.
   */
  async listBank(scope: BankScope): Promise<ExerciseBank> {
    const mySubjectIds = await this.mySubjectIds();
    const wanted = scopeSubjectIds(scope, mySubjectIds);
    let query = this.supabase
      .from('exercise')
      .select(
        // `subjects` keeps them all for the chips; `scope`, inner, only filters
        `*, test(count), subjects:exercise_subject(subject_id), exercise_assignment(class_group(id, name))${wanted ? ', scope:exercise_subject!inner(subject_id)' : ''}`,
      )
      .order('created_at', { ascending: false });
    if (wanted) query = query.in('scope.subject_id', [...wanted]);
    const [exercises, subjects, counts] = await Promise.all([
      query,
      this.listSubjects(),
      this.studentCounts(),
    ]);
    const entries = (unwrap(exercises) as unknown as BankRow[]).map(
      // `scope` only filters: `toExercise` takes the columns it knows
      ({ test, subjects: rows, exercise_assignment, ...row }): BankExercise => ({
        exercise: toExercise(row),
        subjectIds: rows.map((subject) => subject.subject_id),
        testCount: test[0]?.count ?? 0,
        studentCount: counts.get(row.id) ?? 0,
        groups: groupsOf(exercise_assignment),
      }),
    );
    return { exercises: entries, subjects, mySubjectIds };
  }

  /** The subjects of the groups the user teaches, once each; the session is read without a request. */
  private async mySubjectIds(): Promise<string[]> {
    const { data } = await this.supabase.auth.getSession();
    const rows = unwrap(
      await this.supabase
        .from('class_group')
        .select('subject_id')
        .eq('teacher_id', data.session?.user.id ?? ''),
    );
    return [...new Set(rows.map((row) => row.subject_id))];
  }

  async getWithTests(exerciseId: string): Promise<ExerciseWithTests> {
    const [row, counts] = await Promise.all([
      this.supabase
        .from('exercise')
        .select(
          '*, test(*), exercise_subject(subject_id), exercise_assignment(class_group(id, name))',
        )
        .eq('id', exerciseId)
        .order('position', { referencedTable: 'test' })
        .single(),
      this.studentCounts(),
    ]);
    const { test, exercise_subject, exercise_assignment, ...exercise } = unwrap(row);
    return {
      exercise: toExercise(exercise),
      tests: test.map(toTest),
      subjectIds: exercise_subject.map((subject) => subject.subject_id),
      ...usage(exerciseId, counts, exercise_assignment),
    };
  }

  /** `save_exercise` writes the exercise, its tests and its subjects at once (D-057). */
  create(draft: ExerciseDraft): Promise<Exercise> {
    return this.save(null, draft);
  }

  update(exerciseId: string, draft: ExerciseDraft): Promise<Exercise> {
    return this.save(exerciseId, draft);
  }

  private async save(exerciseId: string | null, draft: ExerciseDraft): Promise<Exercise> {
    const row = unwrap(
      await this.supabase.rpc('save_exercise', {
        // A null id creates the exercise; the generated types only know the string
        target_exercise_id: exerciseId as string,
        fields: {
          title: draft.title,
          statement: draft.statement,
          difficulty: draft.difficulty,
          topics: [...draft.topics],
          source_locale: draft.sourceLocale,
          // Texts and JSON values: what the checks of the tables accept
          translations: draft.translations as Json,
          function_name: draft.functionName,
          parameters: [...draft.parameters],
          max_repeated_failures: draft.maxRepeatedFailures,
          max_idle_minutes: draft.maxIdleMinutes,
        },
        tests: draft.tests.map((test) => ({
          input: test.input as Json,
          expected_output: test.expectedOutput as Json,
          is_hidden: test.isHidden,
        })),
        subject_ids: [...draft.subjectIds],
      }),
    );
    return toExercise(row);
  }

  /** How many students started each exercise, in any group (`exercise_student_counts`). */
  private async studentCounts(): Promise<ReadonlyMap<string, number>> {
    const rows = unwrap(await this.supabase.rpc('exercise_student_counts'));
    return new Map(rows.map((row) => [row.exercise_id, row.student_count]));
  }

  /**
   * `invalid` (23503) for an exercise with attempts (`on delete restrict`) or assigned in the
   * groups of another teacher (`exercise_kept_by_others`).
   */
  async remove(exerciseId: string): Promise<void> {
    const deleted = unwrap(
      await this.supabase.from('exercise').delete().eq('id', exerciseId).select('id'),
    );
    if (deleted.length === 0) throw new DataError('not_found');
  }

  /** The RLS lets only its author or the administration change it; others get `not_found`. */
  async setArchived(exerciseId: string, archived: boolean): Promise<Exercise> {
    const row = unwrap(
      await this.supabase
        .from('exercise')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', exerciseId)
        .select()
        .single(),
    );
    return toExercise(row);
  }

  /** The Edge Function `translate`, with the models of the tutor (4.3c, D-059). */
  async translate(request: TranslationRequest): Promise<ExerciseText> {
    const { data, error } = await this.supabase.functions.invoke<ExerciseText>(TRANSLATE_FUNCTION, {
      body: request,
    });
    if (error) throw toFunctionDataError(error);
    if (!data) throw new DataError('unknown', 'The translation came back empty');
    return data;
  }
}

/** The group of an assignment, with its subject. */
function toAssignedGroup(row: {
  id: string;
  name: string;
  subject: Row<'subject'>;
}): AssignedGroup {
  return { id: row.id, name: row.name, subject: toSubject(row.subject) };
}

/** A row of the bank as the query of `listBank` brings it. */
type BankRow = Row<'exercise'> & {
  test: { count: number }[];
  subjects: { subject_id: string }[];
  exercise_assignment: { class_group: { id: string; name: string } }[];
  scope?: unknown;
};

/** The groups of the assignments the user reads, once each, by name. */
function groupsOf(
  assignments: readonly { class_group: { id: string; name: string } }[],
): ExerciseUsage['groups'] {
  const groups = new Map(assignments.map(({ class_group }) => [class_group.id, class_group]));
  return [...groups.values()]
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function usage(
  exerciseId: string,
  counts: ReadonlyMap<string, number>,
  assignments: readonly { class_group: { id: string; name: string } }[],
): ExerciseUsage {
  return { studentCount: counts.get(exerciseId) ?? 0, groups: groupsOf(assignments) };
}
